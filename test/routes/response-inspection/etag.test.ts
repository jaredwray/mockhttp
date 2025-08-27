import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { etagRoutes } from "../../../src/routes/response-inspection/index.js";

describe("ETag Routes", () => {
	const fastify = Fastify();

	beforeAll(async () => {
		await fastify.register(etagRoutes);
	});

	afterAll(async () => {
		await fastify.close();
	});

	it("should return 304 if If-None-Match header matches the ETag", async () => {
		const etagValue = "test-etag";
		const response = await fastify.inject({
			method: "GET",
			url: `/etag/${etagValue}`,
			headers: {
				"if-none-match": etagValue,
			},
		});

		expect(response.statusCode).toBe(304);
		expect(response.body).toBe("");
	});

	it("should return 412 if If-Match header does not match the ETag", async () => {
		const etagValue = "test-etag";
		const response = await fastify.inject({
			method: "GET",
			url: `/etag/${etagValue}`,
			headers: {
				"if-match": "mismatched-etag",
			},
		});

		expect(response.statusCode).toBe(412);
		expect(response.body).toBe("");
	});

	it("should return 200 with resource content and ETag header if If-None-Match does not match", async () => {
		const etagValue = "test-etag";
		const response = await fastify.inject({
			method: "GET",
			url: `/etag/${etagValue}`,
			headers: {
				"if-none-match": "different-etag",
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers.etag).toBe(etagValue);
		expect(response.body).toBe("Resource content for matching ETag.");
	});

	it("should return 200 with resource content and ETag header if If-Match matches", async () => {
		const etagValue = "test-etag";
		const response = await fastify.inject({
			method: "GET",
			url: `/etag/${etagValue}`,
			headers: {
				"if-match": etagValue,
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers.etag).toBe(etagValue);
		expect(response.body).toBe("Resource content for matching ETag.");
	});

	it("should return 200 with resource content and ETag header if no ETag-related headers are present", async () => {
		const etagValue = "test-etag";
		const response = await fastify.inject({
			method: "GET",
			url: `/etag/${etagValue}`,
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers.etag).toBe(etagValue);
		expect(response.body).toBe("Resource content for matching ETag.");
	});
});
