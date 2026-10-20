import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Unstable_DevWorker, unstable_dev } from "wrangler";

// wrangler's HTTPS dev listener uses a self-signed certificate.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const devOptions = {
	config: "wrangler.test.jsonc",
	experimental: {
		disableExperimentalWarning: true,
		disableDevRegistry: true,
		watch: false,
	},
	persist: false,
	ip: "127.0.0.1",
	local: true,
	logLevel: "error" as const,
};

/**
 * Boots the Worker entry inside workerd. Fastify's route compiler calls
 * `new Function()`, which workerd only allows during isolate startup. A
 * regression that moves `listen` into `fetch` fails these requests.
 */
describe("worker under workerd", () => {
	let worker: Unstable_DevWorker;

	beforeAll(async () => {
		worker = await unstable_dev("worker/index.ts", {
			...devOptions,
			port: 18787,
			inspectorPort: 19229,
			// Production Workers see the client https URL. The default wrangler
			// listener is http and would hide that. The dev proxy's https mode
			// is what the stamp has to follow.
			localProtocol: "https",
		});
	}, 120_000);

	afterAll(async () => {
		await worker?.stop();
	});

	it("serves mock routes and https bin URLs", async () => {
		const get = await worker.fetch("https://mockhttp.org/get");
		expect(get.status, await textOf(get)).toBe(200);
		expect(await get.json()).toMatchObject({ method: "GET" });

		const ip = await worker.fetch("https://mockhttp.org/ip", {
			headers: { "cf-connecting-ip": "203.0.113.10" },
		});
		expect(ip.status, await textOf(ip)).toBe(200);
		expect(await ip.json()).toMatchObject({ ip: "203.0.113.10" });

		const listed = await worker.fetch("https://mockhttp.org/bins");
		expect(listed.status, await textOf(listed)).toBe(200);
		expect(await listed.json()).toEqual({ bins: [] });

		const created = await worker.fetch("https://mockhttp.org/bins", {
			method: "POST",
		});
		expect(created.status, await textOf(created)).toBe(200);
		const bin = (await created.json()) as { id: string; url: string };
		expect(bin.url).toBe(`https://mockhttp.org/b/${bin.id}`);

		const captured = await worker.fetch(`https://mockhttp.org/b/${bin.id}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ ok: true }),
		});
		expect(captured.status, await textOf(captured)).toBe(200);
		expect(await captured.json()).toMatchObject({ ok: true, binId: bin.id });

		const localHttp = await unstable_dev("worker/index.ts", {
			...devOptions,
			port: 18789,
			inspectorPort: 19231,
			localProtocol: "http",
		});
		try {
			const httpBin = await localHttp.fetch("https://mockhttp.org/bins", {
				method: "POST",
			});
			expect(httpBin.status, await textOf(httpBin)).toBe(200);
			const httpBody = (await httpBin.json()) as { id: string; url: string };
			// wrangler dev's default listener is HTTP, so the Worker request URL
			// is http even when the test asked for https. The bin URL follows that.
			expect(httpBody.url).toBe(`http://mockhttp.org/b/${httpBody.id}`);
		} finally {
			await localHttp.stop();
		}
	}, 60_000);
});

describe("worker mongo connect under workerd", () => {
	let worker: Unstable_DevWorker;

	beforeAll(async () => {
		worker = await unstable_dev("worker/index.ts", {
			...devOptions,
			port: 18788,
			inspectorPort: 19230,
			// Nothing is listening here. Startup must still succeed; the client
			// connects on the first bin write.
			vars: {
				MONGODB_URI: "mongodb://127.0.0.1:1/mockhttp",
			},
		});
	}, 120_000);

	afterAll(async () => {
		await worker?.stop();
	});

	it("does not connect to MongoDB until a bin is used", async () => {
		const get = await worker.fetch("https://mockhttp.org/get");
		expect(get.status, await textOf(get)).toBe(200);

		const health = await worker.fetch("https://mockhttp.org/healthz");
		const healthBody = await health.text();
		expect(health.status, healthBody).toBe(503);
		expect(healthBody).toContain('"store":"mongo"');
		expect(healthBody).toContain('"connected":false');
		expect(healthBody).toContain('"scheme":"mongodb"');
		expect(healthBody).toContain('"uriPresent":true');
		expect(healthBody).not.toContain("Invalid connection string");
		expect(healthBody).not.toContain("127.0.0.1");
		expect(healthBody).not.toContain("mongodb://");

		const created = await worker.fetch("https://mockhttp.org/bins", {
			method: "POST",
		});
		const body = await created.text();
		expect(created.status, body).toBe(500);
		expect(body).not.toContain("Code generation from strings");
		expect(body).not.toContain("127.0.0.1");
		expect(body).not.toContain("mongodb://");
	}, 60_000);
});

describe("worker srv and unencoded password under workerd", () => {
	it("reports a DNS error for a well-formed mongodb+srv URI", async () => {
		const worker = await unstable_dev("worker/index.ts", {
			...devOptions,
			port: 18790,
			inspectorPort: 19232,
			vars: {
				MONGODB_URI:
					"mongodb+srv://user:pass@cluster0.example.invalid/mockhttp",
			},
		});
		try {
			const health = await worker.fetch("https://mockhttp.org/healthz");
			const body = await health.text();
			expect(health.status, body).toBe(503);
			expect(body).toContain('"scheme":"mongodb+srv"');
			expect(body).not.toContain("Invalid connection string");
			expect(body).not.toContain("user:pass");
			expect(body).not.toContain("cluster0");
			expect(body).not.toContain("mongodb+srv://");
		} finally {
			await worker.stop();
		}
	}, 60_000);

	it("explains an unencoded @ without returning the password", async () => {
		const worker = await unstable_dev("worker/index.ts", {
			...devOptions,
			port: 18792,
			inspectorPort: 19234,
			vars: {
				MONGODB_URI:
					"mongodb+srv://user:p@ssw!rd@cluster0.example.invalid/mockhttp",
			},
		});
		try {
			const health = await worker.fetch("https://mockhttp.org/healthz");
			const body = await health.text();
			expect(health.status, body).toBe(503);
			expect(body).toContain("Invalid connection string");
			expect(body).toContain("Percent-encode");
			expect(body).not.toContain("p@ssw");
			expect(body).not.toContain("cluster0");
			expect(body).not.toContain("mongodb+srv://");
		} finally {
			await worker.stop();
		}
	}, 60_000);
});

async function textOf(response: Response): Promise<string> {
	return response.clone().text();
}
