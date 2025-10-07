import type { FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it } from "vitest";
import {
	type InjectionMatcher,
	type InjectionResponse,
	TapManager,
} from "../src/tap-manager.js";

describe("Tap", () => {
	let tapManager: TapManager;

	beforeEach(() => {
		tapManager = new TapManager();
	});

	describe("inject", () => {
		it("should create a new injection and return a tap", () => {
			const response: InjectionResponse = {
				response: "test response",
				statusCode: 200,
			};

			const tap = tapManager.inject(response);

			expect(tap).toBeDefined();
			expect(tap.id).toBeDefined();
			expect(tap.response).toBe(response);
			expect(tap.matcher).toBeUndefined();
		});

		it("should create injection with matcher", () => {
			const response: InjectionResponse = {
				response: "test response",
			};
			const matcher: InjectionMatcher = {
				url: "/api/test",
				method: "GET",
			};

			const tap = tapManager.inject(response, matcher);

			expect(tap.matcher).toBe(matcher);
		});

		it("should generate unique IDs for each injection", () => {
			const response: InjectionResponse = { response: "test" };

			const tap1 = tapManager.inject(response);
			const tap2 = tapManager.inject(response);

			expect(tap1.id).not.toBe(tap2.id);
		});
	});

	describe("injections getter", () => {
		it("should return empty map when no injections exist", () => {
			expect(tapManager.injections.size).toBe(0);
		});

		it("should return all active injections", () => {
			const tap1 = tapManager.inject({ response: "test1" });
			const tap2 = tapManager.inject({ response: "test2" });

			const injections = tapManager.injections;

			expect(injections.size).toBe(2);
			expect(injections.get(tap1.id)).toEqual(tap1);
			expect(injections.get(tap2.id)).toEqual(tap2);
		});
	});

	describe("hasInjections getter", () => {
		it("should return false when no injections exist", () => {
			expect(tapManager.hasInjections).toBe(false);
		});

		it("should return true when injections exist", () => {
			tapManager.inject({ response: "test" });
			expect(tapManager.hasInjections).toBe(true);
		});
	});

	describe("removeInjection", () => {
		it("should remove injection by tap object", () => {
			const tap = tapManager.inject({ response: "test" });

			expect(tapManager.hasInjections).toBe(true);

			const removed = tapManager.removeInjection(tap);

			expect(removed).toBe(true);
			expect(tapManager.hasInjections).toBe(false);
		});

		it("should remove injection by ID string", () => {
			const tap = tapManager.inject({ response: "test" });

			const removed = tapManager.removeInjection(tap.id);

			expect(removed).toBe(true);
			expect(tapManager.hasInjections).toBe(false);
		});

		it("should return false when removing non-existent injection", () => {
			const removed = tapManager.removeInjection("non-existent-id");

			expect(removed).toBe(false);
		});

		it("should only remove the specified injection", () => {
			const tap1 = tapManager.inject({ response: "test1" });
			const tap2 = tapManager.inject({ response: "test2" });

			tapManager.removeInjection(tap1);

			expect(tapManager.injections.size).toBe(1);
			expect(tapManager.injections.get(tap2.id)).toEqual(tap2);
		});
	});

	describe("clear", () => {
		it("should remove all injections", () => {
			tapManager.inject({ response: "test1" });
			tapManager.inject({ response: "test2" });
			tapManager.inject({ response: "test3" });

			expect(tapManager.injections.size).toBe(3);

			tapManager.clear();

			expect(tapManager.injections.size).toBe(0);
			expect(tapManager.hasInjections).toBe(false);
		});
	});

	describe("matchRequest", () => {
		it("should match request when no matcher is specified", () => {
			const tap = tapManager.inject({ response: "test" });
			const mockRequest = createMockRequest("/any/path", "GET");

			const matched = tapManager.matchRequest(mockRequest);

			expect(matched).toEqual(tap);
		});

		it("should match request with exact URL", () => {
			const tap = tapManager.inject(
				{ response: "test" },
				{ url: "/api/users" },
			);
			const mockRequest = createMockRequest("/api/users", "GET");

			const matched = tapManager.matchRequest(mockRequest);

			expect(matched).toEqual(tap);
		});

		it("should not match request with different URL", () => {
			tapManager.inject({ response: "test" }, { url: "/api/users" });
			const mockRequest = createMockRequest("/api/posts", "GET");

			const matched = tapManager.matchRequest(mockRequest);

			expect(matched).toBeUndefined();
		});

		it("should match request with wildcard URL pattern", () => {
			const tap = tapManager.inject({ response: "test" }, { url: "/api/*" });
			const mockRequest = createMockRequest("/api/users", "GET");

			const matched = tapManager.matchRequest(mockRequest);

			expect(matched).toEqual(tap);
		});

		it("should match wildcard pattern with nested paths", () => {
			const tap = tapManager.inject({ response: "test" }, { url: "/api/*" });
			const mockRequest = createMockRequest("/api/users/123/posts", "GET");

			const matched = tapManager.matchRequest(mockRequest);

			expect(matched).toEqual(tap);
		});

		it("should not match wildcard pattern with different base path", () => {
			tapManager.inject({ response: "test" }, { url: "/api/*" });
			const mockRequest = createMockRequest("/other/path", "GET");

			const matched = tapManager.matchRequest(mockRequest);

			expect(matched).toBeUndefined();
		});

		it("should match request with exact HTTP method", () => {
			const tap = tapManager.inject(
				{ response: "test" },
				{ url: "/api/users", method: "POST" },
			);
			const mockRequest = createMockRequest("/api/users", "POST");

			const matched = tapManager.matchRequest(mockRequest);

			expect(matched).toEqual(tap);
		});

		it("should not match request with different HTTP method", () => {
			tapManager.inject(
				{ response: "test" },
				{ url: "/api/users", method: "POST" },
			);
			const mockRequest = createMockRequest("/api/users", "GET");

			const matched = tapManager.matchRequest(mockRequest);

			expect(matched).toBeUndefined();
		});

		it("should match request with hostname", () => {
			const tap = tapManager.inject(
				{ response: "test" },
				{ hostname: "localhost" },
			);
			const mockRequest = createMockRequest("/api/users", "GET", {
				hostname: "localhost",
			});

			const matched = tapManager.matchRequest(mockRequest);

			expect(matched).toEqual(tap);
		});

		it("should not match request with different hostname", () => {
			tapManager.inject({ response: "test" }, { hostname: "localhost" });
			const mockRequest = createMockRequest("/api/users", "GET", {
				hostname: "example.com",
			});

			const matched = tapManager.matchRequest(mockRequest);

			expect(matched).toBeUndefined();
		});

		it("should match request with headers", () => {
			const tap = tapManager.inject(
				{ response: "test" },
				{
					headers: {
						"content-type": "application/json",
						authorization: "Bearer token",
					},
				},
			);
			const mockRequest = createMockRequest("/api/users", "GET", {
				headers: {
					"content-type": "application/json",
					authorization: "Bearer token",
					"user-agent": "test",
				},
			});

			const matched = tapManager.matchRequest(mockRequest);

			expect(matched).toEqual(tap);
		});

		it("should not match request with missing required header", () => {
			tapManager.inject(
				{ response: "test" },
				{
					headers: {
						authorization: "Bearer token",
					},
				},
			);
			const mockRequest = createMockRequest("/api/users", "GET", {
				headers: {
					"content-type": "application/json",
				},
			});

			const matched = tapManager.matchRequest(mockRequest);

			expect(matched).toBeUndefined();
		});

		it("should match request with all criteria", () => {
			const tap = tapManager.inject(
				{ response: "test" },
				{
					url: "/api/*",
					method: "POST",
					hostname: "localhost",
					headers: {
						"content-type": "application/json",
					},
				},
			);
			const mockRequest = createMockRequest("/api/users", "POST", {
				hostname: "localhost",
				headers: {
					"content-type": "application/json",
				},
			});

			const matched = tapManager.matchRequest(mockRequest);

			expect(matched).toEqual(tap);
		});

		it("should not match if any criterion fails", () => {
			tapManager.inject(
				{ response: "test" },
				{
					url: "/api/*",
					method: "POST",
					hostname: "localhost",
				},
			);
			const mockRequest = createMockRequest("/api/users", "GET", {
				hostname: "localhost",
			});

			const matched = tapManager.matchRequest(mockRequest);

			expect(matched).toBeUndefined();
		});

		it("should match URL with query string", () => {
			const tap = tapManager.inject(
				{ response: "test" },
				{ url: "/api/users" },
			);
			const mockRequest = createMockRequest(
				"/api/users?page=1&limit=10",
				"GET",
			);

			const matched = tapManager.matchRequest(mockRequest);

			expect(matched).toEqual(tap);
		});

		it("should return first matching injection when multiple match", () => {
			const tap1 = tapManager.inject({ response: "test1" }, { url: "/api/*" });
			tapManager.inject({ response: "test2" }, { url: "/api/users" });
			const mockRequest = createMockRequest("/api/users", "GET");

			const matched = tapManager.matchRequest(mockRequest);

			// Should return the first one that was added
			expect(matched).toEqual(tap1);
		});

		it("should handle case-insensitive method matching", () => {
			const tap = tapManager.inject(
				{ response: "test" },
				{ method: "post" }, // lowercase
			);
			const mockRequest = createMockRequest("/api/users", "POST"); // uppercase

			const matched = tapManager.matchRequest(mockRequest);

			expect(matched).toEqual(tap);
		});
	});

	describe("response types", () => {
		it("should support string response", () => {
			const response: InjectionResponse = {
				response: "Hello World",
			};
			const tap = tapManager.inject(response);

			expect(tap.response.response).toBe("Hello World");
		});

		it("should support object response", () => {
			const response: InjectionResponse = {
				response: { message: "Hello", code: 200 },
			};
			const tap = tapManager.inject(response);

			expect(tap.response.response).toEqual({ message: "Hello", code: 200 });
		});

		it("should support custom status code", () => {
			const response: InjectionResponse = {
				response: "Not Found",
				statusCode: 404,
			};
			const tap = tapManager.inject(response);

			expect(tap.response.statusCode).toBe(404);
		});

		it("should support custom headers", () => {
			const response: InjectionResponse = {
				response: "OK",
				headers: {
					"Content-Type": "application/json",
					"X-Custom-Header": "value",
				},
			};
			const tap = tapManager.inject(response);

			expect(tap.response.headers).toEqual({
				"Content-Type": "application/json",
				"X-Custom-Header": "value",
			});
		});
	});
});

/**
 * Helper function to create a mock Fastify request
 */
function createMockRequest(
	url: string,
	method: string,
	options?: {
		hostname?: string;
		headers?: Record<string, string>;
	},
): FastifyRequest {
	return {
		url,
		method,
		hostname: options?.hostname ?? "localhost",
		headers: options?.headers ?? {},
	} as FastifyRequest;
}
