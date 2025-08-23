import { Buffer } from "node:buffer";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { hiddenBasicAuthRoute } from "../../../src/routes/auth/hidden-basic.js";

const makeBasic = (u: string, p: string) =>
	`Basic ${Buffer.from(`${u}:${p}`).toString("base64")}`;

describe("GET /hidden-basic-auth/:user/:passwd", () => {
	it("mirrors /basic-auth behavior", async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		hiddenBasicAuthRoute(fastify);
		const response401 = await fastify.inject({
			method: "GET",
			url: "/hidden-basic-auth/user/pass",
		});
		expect(response401.statusCode).toBe(401);

		const response200 = await fastify.inject({
			method: "GET",
			url: "/hidden-basic-auth/user/pass",
			headers: { authorization: makeBasic("user", "pass") },
		});
		expect(response200.statusCode).toBe(200);
		expect(response200.json()).toEqual({ authenticated: true, user: "user" });
	});

	it("401 non-basic scheme", async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		hiddenBasicAuthRoute(fastify);
		const response = await fastify.inject({
			method: "GET",
			url: "/hidden-basic-auth/user/pass",
			headers: { authorization: "Digest token" },
		});
		expect(response.statusCode).toBe(401);
	});

	it("401 when decoded credentials have no colon", async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		hiddenBasicAuthRoute(fastify);
		const bad = `Basic ${Buffer.from("nocolonhere").toString("base64")}`;
		const response = await fastify.inject({
			method: "GET",
			url: "/hidden-basic-auth/user/pass",
			headers: { authorization: bad },
		});
		expect(response.statusCode).toBe(401);
	});
});
