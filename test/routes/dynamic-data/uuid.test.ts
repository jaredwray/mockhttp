import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { uuidRoute } from "../../../src/routes/dynamic-data/uuid.js";

describe("GET /uuid route", () => {
	const fastify = Fastify();
	uuidRoute(fastify);

	it("should return a valid UUID", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/uuid",
		});

		expect(response.statusCode).toBe(200);

		const responseBody = response.json();
		expect(responseBody).toHaveProperty("uuid");
		// UUID v4 format validation
		expect(responseBody.uuid).toMatch(
			/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i,
		);
	});

	it("should return different UUIDs on subsequent requests", async () => {
		const response1 = await fastify.inject({
			method: "GET",
			url: "/uuid",
		});
		const response2 = await fastify.inject({
			method: "GET",
			url: "/uuid",
		});

		const uuid1 = response1.json().uuid;
		const uuid2 = response2.json().uuid;

		expect(uuid1).not.toBe(uuid2);
	});
});
