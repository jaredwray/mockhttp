import fastifyCookie from "@fastify/cookie";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import {
	deleteCookieRoute,
	getCookiesRoute,
	postCookieRoute,
} from "../../../src/routes/cookies/index.js";

describe("Cookies route", async () => {
	// eslint-disable-next-line new-cap
	const fastify = Fastify();
	await fastify.register(fastifyCookie);
	await fastify.register(getCookiesRoute);
	await fastify.register(postCookieRoute);
	await fastify.register(deleteCookieRoute);
	await fastify.ready();

	it("should return no cookies in the response", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/cookies",
		});

		expect(response.statusCode).toBe(200);

		const responseBody = response.json();
		expect(responseBody).toEqual({
			cookies: {},
		});
	});

	it("should set a cookie", async () => {
		const setCookieResponse = await fastify.inject({
			method: "POST",
			url: "/cookies",
			payload: {
				name: "testCookie",
				value: "testValue",
				expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
			},
		});

		expect(setCookieResponse.statusCode).toBe(200);

		const setCookieHeader = setCookieResponse.headers["set-cookie"];

		expect(setCookieHeader).toBeDefined();
		expect(setCookieHeader).toContain("testCookie=testValue");
	});

	it("should set a cookie with no expires", async () => {
		const setCookieResponse = await fastify.inject({
			method: "POST",
			url: "/cookies",
			payload: {
				name: "testCookieNoExpires",
				value: "testValueNoExpires",
			},
		});

		expect(setCookieResponse.statusCode).toBe(200);

		const setCookieHeader = setCookieResponse.headers["set-cookie"];

		expect(setCookieHeader).toBeDefined();
		expect(setCookieHeader).toContain("testCookieNoExpires=testValueNoExpires");
	});

	it("should delete a cookie", async () => {
		const deleteCookieResponse = await fastify.inject({
			method: "DELETE",
			url: "/cookies",
			query: {
				name: "testCookieToDelete",
			},
		});

		expect(deleteCookieResponse.statusCode).toBe(204);

		const deleteCookieHeader = deleteCookieResponse.headers["set-cookie"];

		expect(deleteCookieHeader).toBeDefined();
		expect(deleteCookieHeader).toContain(
			"testCookieToDelete=; Max-Age=0; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax",
		);
	});
});
