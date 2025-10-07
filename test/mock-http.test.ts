import Fastify from "fastify";
import { describe, expect, test } from "vitest";
import { MockHttp, type MockHttpOptions, mockhttp } from "../src/mock-http.js";

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
		test("should start with no injections", () => {
			const mock = new MockHttp();
			expect(mock.injections).toEqual([]);
		});

		test("should be able to inject a response", () => {
			const mock = new MockHttp();
			const tap = mock.inject({ response: "test" });

			expect(tap).toBeDefined();
			expect(tap.id).toBeDefined();
			expect(mock.injections).toHaveLength(1);
		});

		test("should be able to remove an injection", () => {
			const mock = new MockHttp();
			const tap = mock.inject({ response: "test" });

			expect(mock.injections).toHaveLength(1);

			const removed = mock.removeInjection(tap);

			expect(removed).toBe(true);
			expect(mock.injections).toHaveLength(0);
		});

		test("should inject response for matching request", async () => {
			const mock = new MockHttp();
			await mock.start();

			const tap = mock.inject(
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

			mock.removeInjection(tap);
			await mock.close();
		});

		test("should inject JSON response", async () => {
			const mock = new MockHttp();
			await mock.start();

			const responseData = { message: "Hello", code: 200 };
			mock.inject(
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

			mock.inject(
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

			mock.inject(
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

			const tap1 = mock.inject({ response: "response1" }, { url: "/path1" });
			const tap2 = mock.inject({ response: "response2" }, { url: "/path2" });

			expect(mock.injections).toHaveLength(2);

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

			mock.removeInjection(tap1);
			expect(mock.injections).toHaveLength(1);

			mock.removeInjection(tap2);
			expect(mock.injections).toHaveLength(0);

			await mock.close();
		});

		test("should restore normal behavior after removing injection", async () => {
			const mock = new MockHttp();
			await mock.start();

			const tap = mock.inject(
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

			mock.removeInjection(tap);

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

			mock.inject({
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

		test("should handle injection removal by ID", async () => {
			const mock = new MockHttp();
			const tap = mock.inject({ response: "test" });

			expect(mock.injections).toHaveLength(1);

			const removed = mock.removeInjection(tap.id);

			expect(removed).toBe(true);
			expect(mock.injections).toHaveLength(0);
		});
	});
});
