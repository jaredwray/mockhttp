import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BinManager } from "../../../src/bin-manager.js";
import { binsCaptureRoute } from "../../../src/routes/bins/capture.js";
import { binsManagementRoute } from "../../../src/routes/bins/management.js";

describe("Bin management routes", () => {
	let fastify: FastifyInstance;
	let manager: BinManager;

	beforeEach(async () => {
		fastify = Fastify();
		manager = new BinManager();
		await fastify.register(binsManagementRoute(manager));
		await fastify.register(binsCaptureRoute(manager));
	});

	afterEach(async () => {
		manager.stop();
		await fastify.close();
	});

	it("POST /bins returns id, url, and timestamps", async () => {
		const res = await fastify.inject({ method: "POST", url: "/bins" });
		expect(res.statusCode).toBe(200);
		const body = res.json();
		expect(body.id).toBeDefined();
		expect(body.url).toMatch(new RegExp(`/b/${body.id}$`));
		expect(body.createdAt).toBeDefined();
		expect(body.expiresAt).toBeDefined();
		expect(body.requestCount).toBe(0);
	});

	it("GET /bins lists created bins", async () => {
		const a = await fastify.inject({ method: "POST", url: "/bins" });
		const b = await fastify.inject({ method: "POST", url: "/bins" });
		const res = await fastify.inject({ method: "GET", url: "/bins" });
		const ids = res.json().bins.map((bin: { id: string }) => bin.id);
		expect(ids).toContain(a.json().id);
		expect(ids).toContain(b.json().id);
	});

	it("GET /bins/:id returns the bin metadata", async () => {
		const created = await fastify.inject({ method: "POST", url: "/bins" });
		const id = created.json().id;
		const res = await fastify.inject({ method: "GET", url: `/bins/${id}` });
		expect(res.statusCode).toBe(200);
		expect(res.json().id).toBe(id);
	});

	it("GET /bins/:id returns 404 for unknown bins", async () => {
		const res = await fastify.inject({ method: "GET", url: "/bins/nope" });
		expect(res.statusCode).toBe(404);
		expect(res.json().error).toBe("bin_not_found");
	});

	it("GET /bins/:id/requests returns captured requests", async () => {
		const created = await fastify.inject({ method: "POST", url: "/bins" });
		const id = created.json().id;
		await fastify.inject({ method: "POST", url: `/b/${id}`, payload: "hello" });
		const res = await fastify.inject({
			method: "GET",
			url: `/bins/${id}/requests`,
		});
		expect(res.statusCode).toBe(200);
		expect(res.json().requests).toHaveLength(1);
	});

	it("GET /bins/:id/requests returns 404 for unknown bin", async () => {
		const res = await fastify.inject({
			method: "GET",
			url: "/bins/missing/requests",
		});
		expect(res.statusCode).toBe(404);
	});

	it("GET /bins/:id/requests/:reqId fetches a single capture", async () => {
		const created = await fastify.inject({ method: "POST", url: "/bins" });
		const id = created.json().id;
		await fastify.inject({ method: "POST", url: `/b/${id}` });
		const list = await fastify.inject({
			method: "GET",
			url: `/bins/${id}/requests`,
		});
		const reqId = list.json().requests[0].id;
		const single = await fastify.inject({
			method: "GET",
			url: `/bins/${id}/requests/${reqId}`,
		});
		expect(single.statusCode).toBe(200);
		expect(single.json().id).toBe(reqId);
	});

	it("GET /bins/:id/requests/:reqId returns 404 for missing bin or request", async () => {
		const noBin = await fastify.inject({
			method: "GET",
			url: "/bins/missing/requests/whatever",
		});
		expect(noBin.statusCode).toBe(404);

		const created = await fastify.inject({ method: "POST", url: "/bins" });
		const id = created.json().id;
		const noReq = await fastify.inject({
			method: "GET",
			url: `/bins/${id}/requests/missing`,
		});
		expect(noReq.statusCode).toBe(404);
		expect(noReq.json().error).toBe("request_not_found");
	});

	it("DELETE /bins/:id/requests clears captured requests", async () => {
		const created = await fastify.inject({ method: "POST", url: "/bins" });
		const id = created.json().id;
		await fastify.inject({ method: "POST", url: `/b/${id}` });
		const del = await fastify.inject({
			method: "DELETE",
			url: `/bins/${id}/requests`,
		});
		expect(del.statusCode).toBe(204);
		const list = await fastify.inject({
			method: "GET",
			url: `/bins/${id}/requests`,
		});
		expect(list.json().requests).toHaveLength(0);
	});

	it("DELETE /bins/:id/requests returns 404 for unknown bin", async () => {
		const res = await fastify.inject({
			method: "DELETE",
			url: "/bins/missing/requests",
		});
		expect(res.statusCode).toBe(404);
	});

	it("DELETE /bins/:id deletes a bin", async () => {
		const created = await fastify.inject({ method: "POST", url: "/bins" });
		const id = created.json().id;
		const del = await fastify.inject({ method: "DELETE", url: `/bins/${id}` });
		expect(del.statusCode).toBe(204);
		const after = await fastify.inject({ method: "GET", url: `/bins/${id}` });
		expect(after.statusCode).toBe(404);
	});

	it("DELETE /bins/:id returns 404 when bin does not exist", async () => {
		const res = await fastify.inject({
			method: "DELETE",
			url: "/bins/missing",
		});
		expect(res.statusCode).toBe(404);
	});
});
