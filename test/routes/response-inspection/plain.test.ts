import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { plainRoute } from "../../../src/routes/response-inspection/index.js";

describe("Plain Text Route", () => {
	// eslint-disable-next-line new-cap
	const fastify = Fastify();

	beforeAll(async () => {
		await fastify.register(plainRoute);
	});

	afterAll(async () => {
		await fastify.close();
	});

	it("should return plain text with correct content type", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/plain",
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toContain("text/plain");
		expect(typeof response.body).toBe("string");
		expect(response.body.length).toBeGreaterThan(0);
	});

	it("should return one of the predefined random texts", async () => {
		const expectedTexts = [
			"The quick brown fox jumps over the lazy dog.",
			"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
			"To be or not to be, that is the question.",
			"All work and no play makes Jack a dull boy.",
			"The only way to do great work is to love what you do.",
			"In the beginning was the Word, and the Word was with God.",
			"Once upon a time in a galaxy far, far away...",
			"It was the best of times, it was the worst of times.",
			"The journey of a thousand miles begins with a single step.",
			"Knowledge is power. France is bacon.",
		];

		const response = await fastify.inject({
			method: "GET",
			url: "/plain",
		});

		expect(expectedTexts).toContain(response.body);
	});

	it("should return different texts on multiple requests (randomness test)", async () => {
		const responses = new Set();
		const numberOfRequests = 20;

		for (let i = 0; i < numberOfRequests; i++) {
			const response = await fastify.inject({
				method: "GET",
				url: "/plain",
			});
			responses.add(response.body);
		}

		// With 10 possible texts and 20 requests, we should get at least 2 different texts
		// This is a probabilistic test but the chance of failure is extremely low
		expect(responses.size).toBeGreaterThanOrEqual(2);
	});

	it("should handle the random index calculation correctly", async () => {
		// This test verifies that the endpoint doesn't crash regardless of Math.random() output
		// We'll make multiple requests to ensure stability
		const requests = 100;

		for (let i = 0; i < requests; i++) {
			const response = await fastify.inject({
				method: "GET",
				url: "/plain",
			});

			expect(response.statusCode).toBe(200);
			expect(response.body).toBeTruthy();
			expect(response.headers["content-type"]).toContain("text/plain");
		}
	});

	it("should set reply type to text/plain", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/plain",
		});

		// Verify that the content-type header is set correctly
		expect(response.headers["content-type"]).toContain("text/plain");
	});

	it("should return the selected text directly without JSON wrapping", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/plain",
		});

		// Ensure the response is plain text, not JSON
		expect(() => JSON.parse(response.body)).toThrow();

		// Ensure the response doesn't contain JSON-like structures
		expect(response.body).not.toContain("{");
		expect(response.body).not.toContain("}");
		expect(response.body).not.toContain('"text"');
	});
});
