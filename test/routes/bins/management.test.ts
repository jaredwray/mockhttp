import { createHash } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockHttpBins } from "../../../src/mock-http-bins.js";
import { binsCaptureRoute } from "../../../src/routes/bins/capture.js";
import {
	binCaptureUrl,
	binsManagementRoute,
} from "../../../src/routes/bins/management.js";

type CreatedBin = {
	id: string;
	token: string;
	url: string;
	createdAt: string;
	expiresAt: string;
	requestCount: number;
};

function ownerHeaders(token: string): { authorization: string } {
	return { authorization: `Bearer ${token}` };
}

describe("Bin management routes", () => {
	let fastify: FastifyInstance;
	let manager: MockHttpBins;

	beforeEach(async () => {
		fastify = Fastify();
		manager = new MockHttpBins();
		await fastify.register(binsManagementRoute(manager));
		await fastify.register(binsCaptureRoute(manager));
	});

	afterEach(async () => {
		await fastify.close();
	});

	it("POST /bins returns id, url, timestamps, and the owner token once", async () => {
		const res = await fastify.inject({ method: "POST", url: "/bins" });
		expect(res.statusCode).toBe(200);
		const body = res.json() as CreatedBin;
		expect(body.id).toBeDefined();
		expect(body.url).toMatch(new RegExp(`/b/${body.id}$`));
		expect(body.createdAt).toBeDefined();
		expect(body.expiresAt).toBeDefined();
		expect(body.requestCount).toBe(0);
		expect(Buffer.from(body.token, "base64url").length).toBeGreaterThanOrEqual(
			32,
		);
		const doc = await manager.keyv.get(`bin:${body.id}`);
		expect(doc?.tokenHash).toBe(
			createHash("sha256").update(body.token).digest("hex"),
		);
		expect(doc).not.toHaveProperty("token");
		expect(doc?.bin).not.toHaveProperty("token");
		expect(doc?.bin).not.toHaveProperty("tokenHash");
	});

	it("POST /bins uses the forwarded protocol in the capture URL", async () => {
		const res = await fastify.inject({
			method: "POST",
			url: "/bins",
			headers: {
				host: "mockhttp.org",
				"x-forwarded-proto": "https",
			},
		});
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.url).toBe(`https://mockhttp.org/b/${body.id}`);

		const workerScheme = await fastify.inject({
			method: "POST",
			url: "/bins",
			headers: {
				host: "mockhttp.org",
				"x-forwarded-proto": "http",
				"x-mockhttp-forwarded-proto": "https",
			},
		});
		expect(workerScheme.statusCode).toBe(200);
		const workerBody = workerScheme.json();
		expect(workerBody.url).toBe(`https://mockhttp.org/b/${workerBody.id}`);
	});

	it("builds a capture URL from the forwarded protocol chain", () => {
		expect(binCaptureUrl("http, https", "http", "mockhttp.org", "abc")).toBe(
			"https://mockhttp.org/b/abc",
		);
		expect(
			binCaptureUrl(["http", "https"], "http", "mockhttp.org", "abc"),
		).toBe("https://mockhttp.org/b/abc");
		expect(binCaptureUrl("ftp", "https", "mockhttp.org", "abc")).toBe(
			"https://mockhttp.org/b/abc",
		);
		expect(binCaptureUrl(undefined, "http", "localhost:3000", "abc")).toBe(
			"http://localhost:3000/b/abc",
		);
		expect(binCaptureUrl("  ", undefined, "localhost", "abc")).toBe(
			"http://localhost/b/abc",
		);
	});

	it("POST /bins returns 500 when Keyv does not store the bin", async () => {
		vi.spyOn(manager.keyv, "set").mockResolvedValue(false);
		const res = await fastify.inject({ method: "POST", url: "/bins" });
		expect(res.statusCode).toBe(500);
		expect(res.json()).toMatchObject({
			statusCode: 500,
			error: "Internal Server Error",
		});
	});

	it("GET /bins returns only the bin for the presented token", async () => {
		const a = (
			await fastify.inject({ method: "POST", url: "/bins" })
		).json() as CreatedBin;
		const b = (
			await fastify.inject({ method: "POST", url: "/bins" })
		).json() as CreatedBin;
		const res = await fastify.inject({
			method: "GET",
			url: "/bins",
			headers: ownerHeaders(a.token),
		});
		expect(res.statusCode).toBe(200);
		const ids = res.json().bins.map((bin: { id: string }) => bin.id);
		expect(ids).toEqual([a.id]);
		expect(ids).not.toContain(b.id);
		expect(res.json().bins[0]).not.toHaveProperty("token");
		expect(res.json().bins[0]).not.toHaveProperty("tokenHash");
	});

	it("GET /bins/:id returns the bin metadata", async () => {
		const created = (
			await fastify.inject({ method: "POST", url: "/bins" })
		).json() as CreatedBin;
		const res = await fastify.inject({
			method: "GET",
			url: `/bins/${created.id}`,
			headers: ownerHeaders(created.token),
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().id).toBe(created.id);
		expect(res.json()).not.toHaveProperty("token");
		expect(res.json()).not.toHaveProperty("tokenHash");
	});

	it("GET /bins/:id returns 404 for unknown bins", async () => {
		const res = await fastify.inject({
			method: "GET",
			url: "/bins/nope",
			headers: ownerHeaders("not-the-owner-token-value"),
		});
		expect(res.statusCode).toBe(404);
		expect(res.json().error).toBe("bin_not_found");
	});

	it("GET /bins/:id/requests returns captured requests", async () => {
		const created = (
			await fastify.inject({ method: "POST", url: "/bins" })
		).json() as CreatedBin;
		await fastify.inject({
			method: "POST",
			url: `/b/${created.id}`,
			payload: "hello",
		});
		const res = await fastify.inject({
			method: "GET",
			url: `/bins/${created.id}/requests`,
			headers: ownerHeaders(created.token),
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().requests).toHaveLength(1);
	});

	it("GET /bins/:id/requests returns 404 for unknown bin", async () => {
		const res = await fastify.inject({
			method: "GET",
			url: "/bins/missing/requests",
			headers: ownerHeaders("not-the-owner-token-value"),
		});
		expect(res.statusCode).toBe(404);
	});

	it("GET /bins/:id/requests/:reqId fetches a single capture", async () => {
		const created = (
			await fastify.inject({ method: "POST", url: "/bins" })
		).json() as CreatedBin;
		await fastify.inject({ method: "POST", url: `/b/${created.id}` });
		const list = await fastify.inject({
			method: "GET",
			url: `/bins/${created.id}/requests`,
			headers: ownerHeaders(created.token),
		});
		const reqId = list.json().requests[0].id;
		const single = await fastify.inject({
			method: "GET",
			url: `/bins/${created.id}/requests/${reqId}`,
			headers: ownerHeaders(created.token),
		});
		expect(single.statusCode).toBe(200);
		expect(single.json().id).toBe(reqId);
	});

	it("GET /bins/:id/requests/:reqId returns 404 for missing bin or request", async () => {
		const noBin = await fastify.inject({
			method: "GET",
			url: "/bins/missing/requests/whatever",
			headers: ownerHeaders("not-the-owner-token-value"),
		});
		expect(noBin.statusCode).toBe(404);

		const created = (
			await fastify.inject({ method: "POST", url: "/bins" })
		).json() as CreatedBin;
		const noReq = await fastify.inject({
			method: "GET",
			url: `/bins/${created.id}/requests/missing`,
			headers: ownerHeaders(created.token),
		});
		expect(noReq.statusCode).toBe(404);
		expect(noReq.json().error).toBe("request_not_found");
	});

	it("DELETE /bins/:id/requests clears captured requests", async () => {
		const created = (
			await fastify.inject({ method: "POST", url: "/bins" })
		).json() as CreatedBin;
		await fastify.inject({ method: "POST", url: `/b/${created.id}` });
		const del = await fastify.inject({
			method: "DELETE",
			url: `/bins/${created.id}/requests`,
			headers: ownerHeaders(created.token),
		});
		expect(del.statusCode).toBe(204);
		const list = await fastify.inject({
			method: "GET",
			url: `/bins/${created.id}/requests`,
			headers: ownerHeaders(created.token),
		});
		expect(list.json().requests).toHaveLength(0);
	});

	it("DELETE /bins/:id/requests returns 404 for unknown bin", async () => {
		const res = await fastify.inject({
			method: "DELETE",
			url: "/bins/missing/requests",
			headers: ownerHeaders("not-the-owner-token-value"),
		});
		expect(res.statusCode).toBe(404);
	});

	it("DELETE /bins/:id deletes a bin", async () => {
		const created = (
			await fastify.inject({ method: "POST", url: "/bins" })
		).json() as CreatedBin;
		const del = await fastify.inject({
			method: "DELETE",
			url: `/bins/${created.id}`,
			headers: ownerHeaders(created.token),
		});
		expect(del.statusCode).toBe(204);
		const after = await fastify.inject({
			method: "GET",
			url: `/bins/${created.id}`,
			headers: ownerHeaders(created.token),
		});
		expect(after.statusCode).toBe(404);
	});

	it("DELETE /bins/:id returns 404 when bin does not exist", async () => {
		const res = await fastify.inject({
			method: "DELETE",
			url: "/bins/missing",
			headers: ownerHeaders("not-the-owner-token-value"),
		});
		expect(res.statusCode).toBe(404);
	});

	it("rejects anonymous management and keeps capture open", async () => {
		const owner = (
			await fastify.inject({ method: "POST", url: "/bins" })
		).json() as CreatedBin;
		const other = (
			await fastify.inject({ method: "POST", url: "/bins" })
		).json() as CreatedBin;
		const captured = await fastify.inject({
			method: "POST",
			url: `/b/${owner.id}/hook`,
			headers: {
				authorization: "Bearer webhook-secret",
				cookie: "session=abc",
				"stripe-signature": "t=1,v1=sig",
				"content-type": "application/json",
			},
			payload: { ok: true },
		});
		expect(captured.statusCode).toBe(200);

		const secretBody = captured.body;
		expect(secretBody).not.toContain("webhook-secret");

		const routes: Array<[string, string]> = [
			["GET", "/bins"],
			["GET", `/bins/${owner.id}`],
			["GET", `/bins/${owner.id}/requests`],
			["GET", `/bins/${owner.id}/requests/whatever`],
			["DELETE", `/bins/${owner.id}/requests`],
			["DELETE", `/bins/${owner.id}`],
		];
		for (const [method, url] of routes) {
			const anon = await fastify.inject({ method: method as "GET", url });
			expect(anon.statusCode, `${method} ${url}`).toBe(401);
			expect(anon.json()).toEqual({ error: "unauthorized" });
			expect(anon.headers["www-authenticate"]).toBe("Bearer");
			expect(anon.body).not.toContain("webhook-secret");
			expect(anon.body).not.toContain("session=abc");
			expect(anon.body).not.toContain("stripe-signature");

			const missing = await fastify.inject({
				method: method as "GET",
				url: url.includes(owner.id)
					? url.replace(owner.id, "missing-bin")
					: url,
				headers: ownerHeaders(owner.token),
			});
			if (url === "/bins") {
				expect(missing.statusCode).toBe(200);
				expect(
					missing.json().bins.map((bin: { id: string }) => bin.id),
				).toEqual([owner.id]);
			}
		}

		const wrongOnReal = await fastify.inject({
			method: "GET",
			url: `/bins/${owner.id}`,
			headers: ownerHeaders(other.token),
		});
		const wrongOnMissing = await fastify.inject({
			method: "GET",
			url: "/bins/missing-bin",
			headers: ownerHeaders(other.token),
		});
		expect(wrongOnReal.statusCode).toBe(404);
		expect(wrongOnMissing.statusCode).toBe(404);
		expect(wrongOnReal.json()).toEqual(wrongOnMissing.json());
		expect(wrongOnReal.body).not.toContain("webhook-secret");

		const anonMissing = await fastify.inject({
			method: "GET",
			url: "/bins/missing-bin",
		});
		const anonReal = await fastify.inject({
			method: "GET",
			url: `/bins/${owner.id}`,
		});
		expect(anonMissing.statusCode).toBe(401);
		expect(anonReal.statusCode).toBe(401);
		expect(anonMissing.json()).toEqual(anonReal.json());

		const malformed = await fastify.inject({
			method: "GET",
			url: `/bins/${owner.id}/requests`,
			headers: { authorization: "Basic abc.def" },
		});
		expect(malformed.statusCode).toBe(401);
		const lower = await fastify.inject({
			method: "GET",
			url: `/bins/${owner.id}/requests`,
			headers: { authorization: `bearer ${owner.token}` },
		});
		expect(lower.statusCode).toBe(200);
		expect(lower.json().requests).toHaveLength(1);
		expect(lower.json().requests[0].headers.authorization).toBe(
			"Bearer webhook-secret",
		);
		expect(lower.json().requests[0].headers.cookie).toBe("session=abc");
		expect(lower.json().requests[0].headers["stripe-signature"]).toBe(
			"t=1,v1=sig",
		);

		const listed = await fastify.inject({
			method: "GET",
			url: "/bins",
			headers: ownerHeaders("not-a-real-token"),
		});
		expect(listed.statusCode).toBe(200);
		expect(listed.json().bins).toEqual([]);

		const cleared = await fastify.inject({
			method: "DELETE",
			url: `/bins/${owner.id}/requests`,
		});
		expect(cleared.statusCode).toBe(401);
		const stillThere = await fastify.inject({
			method: "GET",
			url: `/bins/${owner.id}/requests`,
			headers: ownerHeaders(owner.token),
		});
		expect(stillThere.json().requests).toHaveLength(1);

		const removed = await fastify.inject({
			method: "DELETE",
			url: `/bins/${owner.id}`,
		});
		expect(removed.statusCode).toBe(401);
		const afterAnonDelete = await fastify.inject({
			method: "GET",
			url: `/bins/${owner.id}`,
			headers: ownerHeaders(owner.token),
		});
		expect(afterAnonDelete.statusCode).toBe(200);
	});
});
