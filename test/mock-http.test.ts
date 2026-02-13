import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import Fastify from "fastify";
import { describe, expect, test } from "vitest";
import { generateCertificate } from "../src/certificate.js";
import { MockHttp, type MockHttpOptions, mockhttp } from "../src/mock-http.js";
import { TapManager } from "../src/tap-manager.js";

describe("MockHttp", () => {
	test("should be a class", () => {
		expect(new MockHttp()).toBeInstanceOf(MockHttp);
	});

	test("mockhttp should be an instance of MockHttp", () => {
		expect(new mockhttp()).toBeInstanceOf(MockHttp);
	});

	test("should be able to set the server", () => {
		const mock = new MockHttp();
		const app = Fastify();
		mock.server = app;

		expect(mock.server).toBe(app);
	});

	test("should be able to pass in options", () => {
		const options: MockHttpOptions = {
			port: 8080,
			host: "localhost",
			helmet: true,
			apiDocs: true,
			httpBin: { httpMethods: false },
		};
		const mock = new MockHttp(options);

		expect(mock.host).toBe("localhost");
		expect(mock.helmet).toBe(true);
		expect(mock.apiDocs).toBe(true);
		expect(mock.httpBin).toBe(options.httpBin);
	});

	test("should be able to set options", () => {
		const mock = new MockHttp();

		expect(mock.port).toBe(3000);
		expect(mock.host).toBe("0.0.0.0");
		expect(mock.autoDetectPort).toBe(true);
		expect(mock.helmet).toBe(true);
		expect(mock.apiDocs).toBe(true);
		expect(mock.httpBin.httpMethods).toBe(true);

		mock.port = 3001;
		mock.host = "localhost";
		mock.autoDetectPort = false;
		mock.helmet = false;
		mock.apiDocs = false;
		mock.httpBin = {
			httpMethods: false,
			redirects: false,
			requestInspection: false,
			responseInspection: false,
			statusCodes: false,
		};

		expect(mock.port).toBe(3001);
		expect(mock.host).toBe("localhost");
		expect(mock.autoDetectPort).toBe(false);
		expect(mock.helmet).toBe(false);
		expect(mock.apiDocs).toBe(false);
		expect(mock.httpBin.httpMethods).toBe(false);
	});

	test("should be able to get the Fastify server", () => {
		const mock = new MockHttp();

		expect(mock.server).toBeDefined();
	});

	test("should be able to auto detect the port if in use", async () => {
		const mock1 = new MockHttp();
		await mock1.start();

		const mock2 = new MockHttp();
		await mock2.start();

		expect(mock2.port).to.not.toBe(mock1.port);

		await mock1.close();
		await mock2.close();
	});

	describe("injection/tap feature", () => {
		test("should be able to set taps property", () => {
			const mock = new MockHttp();
			const newTapManager = new TapManager();
			newTapManager.inject({ response: "custom tap manager" });

			mock.taps = newTapManager;

			expect(mock.taps).toBe(newTapManager);
			expect(mock.taps.injections.size).toBe(1);
		});

		test("should start with no injections", () => {
			const mock = new MockHttp();
			expect(mock.taps.injections.size).toBe(0);
		});

		test("should be able to inject a response", () => {
			const mock = new MockHttp();
			const tap = mock.taps.inject({ response: "test" });

			expect(tap).toBeDefined();
			expect(tap.id).toBeDefined();
			expect(mock.taps.injections.size).toBe(1);
		});

		test("should be able to remove an injection", () => {
			const mock = new MockHttp();
			const tap = mock.taps.inject({ response: "test" });

			expect(mock.taps.injections.size).toBe(1);

			const removed = mock.taps.removeInjection(tap);

			expect(removed).toBe(true);
			expect(mock.taps.injections.size).toBe(0);
		});

		test("should inject response for matching request", async () => {
			const mock = new MockHttp();
			await mock.start();

			const tap = mock.taps.inject(
				{
					response: "injected response",
					statusCode: 201,
					headers: { "X-Custom": "test" },
				},
				{ url: "/test-injection" },
			);

			const response = await mock.server.inject({
				method: "GET",
				url: "/test-injection",
			});

			expect(response.statusCode).toBe(201);
			expect(response.body).toBe("injected response");
			expect(response.headers["x-custom"]).toBe("test");

			mock.taps.removeInjection(tap);
			await mock.close();
		});

		test("should inject JSON response", async () => {
			const mock = new MockHttp();
			await mock.start();

			const responseData = { message: "Hello", code: 200 };
			mock.taps.inject(
				{
					response: responseData,
					statusCode: 200,
				},
				{ url: "/api/test" },
			);

			const response = await mock.server.inject({
				method: "GET",
				url: "/api/test",
			});

			expect(response.statusCode).toBe(200);
			expect(response.json()).toEqual(responseData);

			await mock.close();
		});

		test("should match wildcard URL patterns", async () => {
			const mock = new MockHttp();
			await mock.start();

			mock.taps.inject(
				{
					response: "wildcard match",
				},
				{ url: "/api/*" },
			);

			const response1 = await mock.server.inject({
				method: "GET",
				url: "/api/users",
			});

			const response2 = await mock.server.inject({
				method: "GET",
				url: "/api/posts/123",
			});

			expect(response1.body).toBe("wildcard match");
			expect(response2.body).toBe("wildcard match");

			await mock.close();
		});

		test("should match specific HTTP method", async () => {
			const mock = new MockHttp();
			await mock.start();

			mock.taps.inject(
				{
					response: "POST response",
				},
				{ url: "/api/users", method: "POST" },
			);

			const postResponse = await mock.server.inject({
				method: "POST",
				url: "/api/users",
			});

			const getResponse = await mock.server.inject({
				method: "GET",
				url: "/api/users",
			});

			expect(postResponse.body).toBe("POST response");
			// GET should not match, so it should hit normal route or 404
			expect(getResponse.body).not.toBe("POST response");

			await mock.close();
		});

		test("should allow multiple simultaneous injections", async () => {
			const mock = new MockHttp();
			await mock.start();

			const tap1 = mock.taps.inject(
				{ response: "response1" },
				{ url: "/path1" },
			);
			const tap2 = mock.taps.inject(
				{ response: "response2" },
				{ url: "/path2" },
			);

			expect(mock.taps.injections.size).toBe(2);

			const response1 = await mock.server.inject({
				method: "GET",
				url: "/path1",
			});

			const response2 = await mock.server.inject({
				method: "GET",
				url: "/path2",
			});

			expect(response1.body).toBe("response1");
			expect(response2.body).toBe("response2");

			mock.taps.removeInjection(tap1);
			expect(mock.taps.injections.size).toBe(1);

			mock.taps.removeInjection(tap2);
			expect(mock.taps.injections.size).toBe(0);

			await mock.close();
		});

		test("should restore normal behavior after removing injection", async () => {
			const mock = new MockHttp();
			await mock.start();

			const tap = mock.taps.inject(
				{
					response: "injected",
				},
				{ url: "/get" },
			);

			const injectedResponse = await mock.server.inject({
				method: "GET",
				url: "/get",
			});

			expect(injectedResponse.body).toBe("injected");

			mock.taps.removeInjection(tap);

			const normalResponse = await mock.server.inject({
				method: "GET",
				url: "/get",
			});

			// Should now get the normal /get route response
			expect(normalResponse.body).not.toBe("injected");
			expect(normalResponse.statusCode).toBe(200);

			await mock.close();
		});

		test("should match injection with no matcher for all requests", async () => {
			const mock = new MockHttp();
			await mock.start();

			mock.taps.inject({
				response: "catch all",
			});

			const response1 = await mock.server.inject({
				method: "GET",
				url: "/any/path",
			});

			const response2 = await mock.server.inject({
				method: "POST",
				url: "/another/path",
			});

			expect(response1.body).toBe("catch all");
			expect(response2.body).toBe("catch all");

			await mock.close();
		});

		test("should support function response", async () => {
			const mock = new MockHttp();
			await mock.start();

			mock.taps.inject(
				(request) => ({
					response: `Hello from ${request.url}`,
					statusCode: 200,
				}),
				{ url: "/api/dynamic" },
			);

			const response = await mock.server.inject({
				method: "GET",
				url: "/api/dynamic",
			});

			expect(response.statusCode).toBe(200);
			expect(response.body).toBe("Hello from /api/dynamic");

			await mock.close();
		});

		test("should support function response with dynamic status codes", async () => {
			const mock = new MockHttp();
			await mock.start();

			mock.taps.inject((request) => {
				const statusCode = request.url.includes("error") ? 500 : 200;
				return {
					response: { status: statusCode === 500 ? "error" : "success" },
					statusCode,
				};
			});

			const successResponse = await mock.server.inject({
				method: "GET",
				url: "/api/success",
			});

			const errorResponse = await mock.server.inject({
				method: "GET",
				url: "/api/error",
			});

			expect(successResponse.statusCode).toBe(200);
			expect(successResponse.json()).toEqual({ status: "success" });

			expect(errorResponse.statusCode).toBe(500);
			expect(errorResponse.json()).toEqual({ status: "error" });

			await mock.close();
		});

		test("should support function response with dynamic headers", async () => {
			const mock = new MockHttp();
			await mock.start();

			mock.taps.inject(
				(request) => ({
					response: "OK",
					statusCode: 200,
					headers: {
						"X-Request-Method": request.method,
						"X-Request-URL": request.url,
					},
				}),
				{ url: "/api/headers" },
			);

			const response = await mock.server.inject({
				method: "POST",
				url: "/api/headers",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["x-request-method"]).toBe("POST");
			expect(response.headers["x-request-url"]).toBe("/api/headers");

			await mock.close();
		});

		test("should support function response with request body inspection", async () => {
			const mock = new MockHttp();
			await mock.start();

			mock.taps.inject(
				(request) => ({
					response: {
						receivedMethod: request.method,
						receivedUrl: request.url,
					},
					statusCode: 200,
				}),
				{ url: "/api/echo" },
			);

			const response = await mock.server.inject({
				method: "POST",
				url: "/api/echo",
				payload: { test: "data" },
			});

			expect(response.statusCode).toBe(200);
			const body = response.json();
			expect(body.receivedMethod).toBe("POST");
			expect(body.receivedUrl).toBe("/api/echo");

			await mock.close();
		});
	});

	describe("logging", () => {
		test("should be enabled by default", () => {
			const mock = new MockHttp();
			expect(mock.logging).toBe(true);
		});

		test("should be able to disable logging via options", () => {
			const mock = new MockHttp({ logging: false });
			expect(mock.logging).toBe(false);
		});

		test("should be able to enable logging via options", () => {
			const mock = new MockHttp({ logging: true });
			expect(mock.logging).toBe(true);
		});

		test("should be able to set logging via setter", () => {
			const mock = new MockHttp();
			expect(mock.logging).toBe(true);

			mock.logging = false;
			expect(mock.logging).toBe(false);

			mock.logging = true;
			expect(mock.logging).toBe(true);
		});

		test("should start server with logging disabled", async () => {
			const mock = new MockHttp({ logging: false });
			await mock.start();

			// Server should start successfully with logging disabled
			expect(mock.server).toBeDefined();

			await mock.close();
		});
	});

	describe("https", () => {
		test("should default to no https", () => {
			const mock = new MockHttp();
			expect(mock.https).toBeUndefined();
			expect(mock.isHttps).toBe(false);
		});

		test("should accept https: true option", () => {
			const mock = new MockHttp({ https: true });
			expect(mock.https).toEqual({ autoGenerate: true });
		});

		test("should accept https: false option", () => {
			const mock = new MockHttp({ https: false });
			expect(mock.https).toBeUndefined();
		});

		test("should accept https object option", () => {
			const mock = new MockHttp({
				https: { cert: "test-cert", key: "test-key" },
			});
			expect(mock.https).toEqual({ cert: "test-cert", key: "test-key" });
		});

		test("should support https getter/setter with boolean", () => {
			const mock = new MockHttp();
			expect(mock.https).toBeUndefined();

			mock.https = true;
			expect(mock.https).toEqual({ autoGenerate: true });

			mock.https = false;
			expect(mock.https).toBeUndefined();
		});

		test("should support https getter/setter with object", () => {
			const mock = new MockHttp();
			mock.https = {
				autoGenerate: true,
				certificateOptions: { commonName: "test" },
			};
			expect(mock.https?.autoGenerate).toBe(true);
			expect(mock.https?.certificateOptions?.commonName).toBe("test");

			mock.https = undefined;
			expect(mock.https).toBeUndefined();
		});

		test("should start with auto-generated cert and respond to requests", async () => {
			const mock = new MockHttp({ https: true, logging: false });
			await mock.start();

			expect(mock.isHttps).toBe(true);

			const response = await mock.server.inject({
				method: "GET",
				url: "/get",
			});

			expect(response.statusCode).toBe(200);

			await mock.close();
		});

		test("should start with provided PEM cert/key strings", async () => {
			const { cert, key } = generateCertificate();
			const mock = new MockHttp({
				https: { cert, key },
				logging: false,
			});
			await mock.start();

			expect(mock.isHttps).toBe(true);

			const response = await mock.server.inject({
				method: "GET",
				url: "/get",
			});

			expect(response.statusCode).toBe(200);

			await mock.close();
		});

		test("should start with cert/key from file paths", async () => {
			const { cert, key } = generateCertificate();
			const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mockhttp-https-"));
			const certPath = path.join(tmpDir, "cert.pem");
			const keyPath = path.join(tmpDir, "key.pem");
			fs.writeFileSync(certPath, cert);
			fs.writeFileSync(keyPath, key);

			try {
				const mock = new MockHttp({
					https: { cert: certPath, key: keyPath },
					logging: false,
				});
				await mock.start();

				expect(mock.isHttps).toBe(true);

				const response = await mock.server.inject({
					method: "GET",
					url: "/get",
				});

				expect(response.statusCode).toBe(200);

				await mock.close();
			} finally {
				fs.rmSync(tmpDir, { recursive: true });
			}
		});

		test("should throw when autoGenerate is false and no cert/key provided", async () => {
			const mock = new MockHttp({
				https: { autoGenerate: false },
				logging: false,
			});

			await expect(mock.start()).rejects.toThrow(
				"HTTPS is enabled but no certificate was provided and autoGenerate is false.",
			);
		});

		test("should throw when only cert is provided without autoGenerate", async () => {
			const { cert } = generateCertificate();
			const mock = new MockHttp({
				https: { cert },
				logging: false,
			});

			await expect(mock.start()).rejects.toThrow(
				"HTTPS options must include both 'cert' and 'key'. Only one was provided.",
			);
		});

		test("should throw when only key is provided without autoGenerate", async () => {
			const { key } = generateCertificate();
			const mock = new MockHttp({
				https: { key },
				logging: false,
			});

			await expect(mock.start()).rejects.toThrow(
				"HTTPS options must include both 'cert' and 'key'. Only one was provided.",
			);
		});

		test("should auto-generate when only cert is provided with autoGenerate true", async () => {
			const { cert } = generateCertificate();
			const mock = new MockHttp({
				https: { cert, autoGenerate: true },
				logging: false,
			});
			await mock.start();

			expect(mock.isHttps).toBe(true);

			await mock.close();
		});

		test("should not be https when started without https option", async () => {
			const mock = new MockHttp({ logging: false });
			await mock.start();

			expect(mock.isHttps).toBe(false);

			await mock.close();
		});

		test("should support custom certificate options for auto-generation", async () => {
			const mock = new MockHttp({
				https: {
					certificateOptions: {
						commonName: "custom-test-server",
						validityDays: 30,
					},
				},
				logging: false,
			});
			await mock.start();

			expect(mock.isHttps).toBe(true);

			const response = await mock.server.inject({
				method: "GET",
				url: "/get",
			});

			expect(response.statusCode).toBe(200);

			await mock.close();
		});
	});

	describe("rate limiting", () => {
		test("should be enabled by default with 1000 requests per minute and localhost excluded", () => {
			const mock = new MockHttp();
			expect(mock.rateLimit).toBeDefined();
			expect(mock.rateLimit?.max).toBe(1000);
			expect(mock.rateLimit?.timeWindow).toBe("1 minute");
			expect(mock.rateLimit?.allowList).toEqual(["127.0.0.1", "::1"]);
		});

		test("should be able to disable rate limiting", async () => {
			const mock = new MockHttp({
				rateLimit: false,
			});
			expect(mock.rateLimit).toBeUndefined();

			await mock.start();

			// Make many requests quickly - all should succeed without rate limiting
			const responses = await Promise.all([
				mock.server.inject({ method: "GET", url: "/get" }),
				mock.server.inject({ method: "GET", url: "/get" }),
				mock.server.inject({ method: "GET", url: "/get" }),
				mock.server.inject({ method: "GET", url: "/get" }),
				mock.server.inject({ method: "GET", url: "/get" }),
			]);

			// All should return 200, not 429 (rate limit)
			for (const response of responses) {
				expect(response.statusCode).toBe(200);
			}

			await mock.close();
		});

		test("should be able to set rate limit options", () => {
			const rateLimitOptions = {
				max: 10,
				timeWindow: "1 minute",
			};

			const mock = new MockHttp({
				rateLimit: rateLimitOptions,
			});

			expect(mock.rateLimit).toEqual(rateLimitOptions);
		});

		test("should be able to modify rate limit options via setter", () => {
			const mock = new MockHttp();
			expect(mock.rateLimit).toBeDefined();

			const rateLimitOptions = {
				max: 50,
				timeWindow: 60000,
			};

			mock.rateLimit = rateLimitOptions;
			expect(mock.rateLimit).toEqual(rateLimitOptions);
		});

		test("should enforce rate limits when enabled", async () => {
			const mock = new MockHttp({
				rateLimit: {
					max: 3, // Only allow 3 requests
					timeWindow: 60000, // Per minute
				},
			});

			await mock.start();

			// Make 3 requests - should all succeed
			const response1 = await mock.server.inject({
				method: "GET",
				url: "/get",
			});
			const response2 = await mock.server.inject({
				method: "GET",
				url: "/get",
			});
			const response3 = await mock.server.inject({
				method: "GET",
				url: "/get",
			});

			expect(response1.statusCode).toBe(200);
			expect(response2.statusCode).toBe(200);
			expect(response3.statusCode).toBe(200);

			// 4th request should be rate limited
			const response4 = await mock.server.inject({
				method: "GET",
				url: "/get",
			});
			expect(response4.statusCode).toBe(429); // Too Many Requests

			await mock.close();
		});

		test("should include rate limit headers when enabled", async () => {
			const mock = new MockHttp({
				rateLimit: {
					max: 100,
					timeWindow: "1 minute",
				},
			});

			await mock.start();

			const response = await mock.server.inject({ method: "GET", url: "/get" });

			expect(response.statusCode).toBe(200);
			expect(response.headers["x-ratelimit-limit"]).toBeDefined();
			expect(response.headers["x-ratelimit-remaining"]).toBeDefined();
			expect(response.headers["x-ratelimit-reset"]).toBeDefined();

			await mock.close();
		});

		test("should support custom error response builder", async () => {
			const customErrorMessage = "Custom rate limit message";

			const mock = new MockHttp({
				rateLimit: {
					max: 2,
					timeWindow: 60000,
					errorResponseBuilder: () => ({
						statusCode: 429,
						error: "Rate Limit Exceeded",
						message: customErrorMessage,
					}),
				},
			});

			await mock.start();

			// Make requests to exceed limit
			await mock.server.inject({ method: "GET", url: "/get" });
			await mock.server.inject({ method: "GET", url: "/get" });

			const rateLimitedResponse = await mock.server.inject({
				method: "GET",
				url: "/get",
			});

			expect(rateLimitedResponse.statusCode).toBe(429);
			const body = rateLimitedResponse.json();
			expect(body.message).toBe(customErrorMessage);

			await mock.close();
		});
	});
});
