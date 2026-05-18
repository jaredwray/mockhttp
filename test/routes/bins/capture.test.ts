import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BinManager } from "../../../src/bin-manager.js";
import { binsCaptureRoute } from "../../../src/routes/bins/capture.js";
import { binsManagementRoute } from "../../../src/routes/bins/management.js";

async function makeServer(manager?: BinManager) {
	const fastify = Fastify();
	const m = manager ?? new BinManager();
	await fastify.register(binsManagementRoute(m));
	await fastify.register(binsCaptureRoute(m));
	return { fastify, manager: m };
}

async function createBin(fastify: FastifyInstance): Promise<string> {
	const res = await fastify.inject({ method: "POST", url: "/bins" });
	return res.json().id;
}

describe("Bin capture route", () => {
	let fastify: FastifyInstance;
	let manager: BinManager;

	beforeEach(async () => {
		const made = await makeServer();
		fastify = made.fastify;
		manager = made.manager;
	});

	afterEach(async () => {
		manager.stop();
		await fastify.close();
	});

	it("returns 404 when sending to a bin that does not exist", async () => {
		const res = await fastify.inject({ method: "POST", url: "/b/missing" });
		expect(res.statusCode).toBe(404);
		expect(res.json().error).toBe("bin_not_found");
	});

	it("captures a JSON POST and stores utf8 body", async () => {
		const id = await createBin(fastify);
		const res = await fastify.inject({
			method: "POST",
			url: `/b/${id}`,
			headers: { "content-type": "application/json" },
			payload: JSON.stringify({ hello: "world" }),
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().ok).toBe(true);
		expect(res.json().binId).toBe(id);

		const stored = manager.getRequests(id);
		expect(stored).toHaveLength(1);
		expect(stored[0].method).toBe("POST");
		expect(stored[0].bodyEncoding).toBe("utf8");
		expect(stored[0].body).toBe('{"hello":"world"}');
		expect(stored[0].contentType).toBe("application/json");
	});

	it("base64-encodes a binary body", async () => {
		const id = await createBin(fastify);
		const bytes = Buffer.from([0, 1, 2, 3, 255]);
		await fastify.inject({
			method: "POST",
			url: `/b/${id}`,
			headers: { "content-type": "application/octet-stream" },
			payload: bytes,
		});
		const stored = manager.getRequests(id);
		expect(stored[0].bodyEncoding).toBe("base64");
		expect(Buffer.from(stored[0].body ?? "", "base64").equals(bytes)).toBe(
			true,
		);
	});

	it("captures requests without a body as encoding 'none'", async () => {
		const id = await createBin(fastify);
		await fastify.inject({ method: "GET", url: `/b/${id}` });
		const stored = manager.getRequests(id);
		expect(stored[0].bodyEncoding).toBe("none");
		expect(stored[0].body).toBeNull();
		expect(stored[0].contentType).toBeUndefined();
	});

	it("truncates bodies larger than maxBodySize and flags them", async () => {
		const small = new BinManager({ maxBodySize: 4 });
		const made = await makeServer(small);
		try {
			const id = await createBin(made.fastify);
			await made.fastify.inject({
				method: "POST",
				url: `/b/${id}`,
				headers: { "content-type": "text/plain" },
				payload: "abcdefghij",
			});
			const stored = small.getRequests(id);
			expect(stored[0].truncated).toBe(true);
			expect(stored[0].bodySize).toBe(10);
			expect(stored[0].body).toBe("abcd");
		} finally {
			small.stop();
			await made.fastify.close();
		}
	});

	it("captures the sub-path and query string", async () => {
		const id = await createBin(fastify);
		await fastify.inject({
			method: "POST",
			url: `/b/${id}/foo/bar?x=1&y=2`,
		});
		const stored = manager.getRequests(id);
		expect(stored[0].path).toBe("/foo/bar");
		expect(stored[0].url).toBe("/foo/bar?x=1&y=2");
		expect(stored[0].query).toEqual({ x: "1", y: "2" });
	});

	it("captures HEAD and OPTIONS too", async () => {
		const id = await createBin(fastify);
		await fastify.inject({ method: "HEAD", url: `/b/${id}` });
		await fastify.inject({ method: "OPTIONS", url: `/b/${id}` });
		const methods = manager.getRequests(id).map((r) => r.method);
		expect(methods).toContain("HEAD");
		expect(methods).toContain("OPTIONS");
	});

	it("captures PUT, PATCH, DELETE, GET methods", async () => {
		const id = await createBin(fastify);
		for (const method of ["GET", "PUT", "PATCH", "DELETE"] as const) {
			await fastify.inject({ method, url: `/b/${id}` });
		}
		const methods = manager.getRequests(id).map((r) => r.method);
		expect(methods).toEqual(
			expect.arrayContaining(["GET", "PUT", "PATCH", "DELETE"]),
		);
	});

	it("evicts oldest captures when bin reaches the max", async () => {
		const small = new BinManager({ maxRequestsPerBin: 2 });
		const made = await makeServer(small);
		try {
			const id = await createBin(made.fastify);
			for (let i = 0; i < 4; i += 1) {
				await made.fastify.inject({
					method: "POST",
					url: `/b/${id}/n${i}`,
				});
			}
			const stored = small.getRequests(id);
			expect(stored).toHaveLength(2);
			expect(stored.map((r) => r.path)).toEqual(["/n3", "/n2"]);
		} finally {
			small.stop();
			await made.fastify.close();
		}
	});
});
