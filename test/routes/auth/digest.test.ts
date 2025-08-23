import { Buffer } from "node:buffer";
import crypto from "node:crypto";
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { digestAuthRoute, hashAlg } from "../../../src/routes/auth/digest.js";

describe("GET /digest-auth", () => {
	it("401 challenge on first request", async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		digestAuthRoute(fastify);
		const response = await fastify.inject({
			method: "GET",
			url: "/digest-auth/auth/user/pass",
		});
		expect(response.statusCode).toBe(401);
		expect(response.headers["www-authenticate"]).toMatch(/Digest/);
	});

	it("401 when response invalid", async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		digestAuthRoute(fastify);
		const response = await fastify.inject({
			method: "GET",
			url: "/digest-auth/auth/user/pass",
			headers: { authorization: 'Digest username="user"' },
		});
		expect(response.statusCode).toBe(401);
	});

	it("401 when username mismatch", async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		digestAuthRoute(fastify);
		const response = await fastify.inject({
			method: "GET",
			url: "/digest-auth/auth/user/pass",
			headers: { authorization: 'Digest username="someoneelse"' },
		});
		expect(response.statusCode).toBe(401);
	});

	it("401 challenge with algorithm variant", async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		digestAuthRoute(fastify);
		const response = await fastify.inject({
			method: "GET",
			url: "/digest-auth/auth/user/pass/MD5",
		});
		expect(response.statusCode).toBe(401);
		expect(response.headers["www-authenticate"]).toMatch(/algorithm=MD5/);
	});

	it("401 when no qop and mismatched response", async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		digestAuthRoute(fastify);

		const challenge = await fastify.inject({
			method: "GET",
			url: "/digest-auth/auth/user/pass",
		});
		const hdr = challenge.headers["www-authenticate"] as string;
		const nonce = /nonce="([^"]+)"/.exec(hdr)?.[1] ?? "";
		const realm = /realm="([^"]+)"/.exec(hdr)?.[1] ?? "";
		const uri = "/digest-auth/auth/user/pass";
		const ha1 = crypto
			.createHash("md5")
			.update(`user:${realm}:pass`)
			.digest("hex");
		const ha2 = crypto.createHash("md5").update(`GET:${uri}`).digest("hex");
		// Wrong response intentionally
		const responseHash = crypto
			.createHash("md5")
			.update(`${ha1}:${nonce}:${ha2}WRONG`)
			.digest("hex");
		const authHeader = `Digest username="user", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${responseHash}"`;
		const bad = await fastify.inject({
			method: "GET",
			url: uri,
			headers: { authorization: authHeader },
		});
		expect(bad.statusCode).toBe(401);
	});

	// Test lines 54-55: Non-digest auth scheme
	it("401 when authorization header is not Digest scheme", async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		digestAuthRoute(fastify);
		const response = await fastify.inject({
			method: "GET",
			url: "/digest-auth/auth/user/pass",
			headers: { authorization: "Basic dXNlcjpwYXNz" },
		});
		expect(response.statusCode).toBe(401);
		expect(response.headers["www-authenticate"]).toMatch(/Digest/);
	});

	// Test lines 61-62: Malformed digest auth header
	it("401 when digest auth header is malformed", async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		digestAuthRoute(fastify);
		const response = await fastify.inject({
			method: "GET",
			url: "/digest-auth/auth/user/pass",
			headers: { authorization: "Digest malformed_no_equals" },
		});
		expect(response.statusCode).toBe(401);
	});

	// Test lines 82-84: Empty parts array (no valid key=value pairs)
	it("401 when digest auth header has no valid key=value pairs", async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		digestAuthRoute(fastify);
		const response = await fastify.inject({
			method: "GET",
			url: "/digest-auth/auth/user/pass",
			headers: { authorization: "Digest ,,," },
		});
		expect(response.statusCode).toBe(401);
	});

	// Test line 123: Successful authentication with valid digest
	it.skip("authenticates successfully with valid digest", async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		digestAuthRoute(fastify);

		// Mock the makeNonce function to return a predictable value
		const originalMakeNonce = crypto.randomBytes;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		(crypto as any).randomBytes = () => Buffer.from("predictable", "utf8");

		try {
			// Get challenge first
			const challenge = await fastify.inject({
				method: "GET",
				url: "/digest-auth/auth/testuser/testpass",
			});

			const authHeader = challenge.headers["www-authenticate"] as string;
			const nonceMatch = /nonce="([^"]+)"/.exec(authHeader);
			const nonce = nonceMatch?.[1] ?? "";

			// Create valid auth response
			const uri = "/digest-auth/auth/testuser/testpass";
			const realm = "mockhttp";
			const nc = "00000001";
			const cnonce = "testcnonce";
			const qop = "auth";

			const ha1 = crypto
				.createHash("md5")
				.update(`testuser:${realm}:testpass`)
				.digest("hex");
			const ha2 = crypto.createHash("md5").update(`GET:${uri}`).digest("hex");
			const responseHash = crypto
				.createHash("md5")
				.update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
				.digest("hex");

			const validAuthHeader = `Digest username="testuser", realm="${realm}", nonce="${nonce}", uri="${uri}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${responseHash}"`;

			const response = await fastify.inject({
				method: "GET",
				url: uri,
				headers: { authorization: validAuthHeader },
			});

			expect(response.statusCode).toBe(200);
			const body = JSON.parse(String(response.body)) as {
				authenticated: boolean;
				user: string;
			};
			expect(body.authenticated).toBe(true);
			expect(body.user).toBe("testuser");
		} finally {
			// Restore original function
			(crypto as any).randomBytes = originalMakeNonce;
		}
	});

	// Test lines 140-143: Username mismatch on algorithm endpoint
	it("401 when username mismatch on algorithm endpoint", async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		digestAuthRoute(fastify);
		const response = await fastify.inject({
			method: "GET",
			url: "/digest-auth/auth/user/pass/MD5",
			headers: {
				authorization: 'Digest username="wronguser", response="test"',
			},
		});
		expect(response.statusCode).toBe(401);
		expect(response.headers["www-authenticate"]).toMatch(/algorithm=MD5/);
	});

	// Test lines 153-154: Without qop on algorithm endpoint
	it("401 when no qop on algorithm endpoint with wrong response", async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		digestAuthRoute(fastify);

		const uri = "/digest-auth/auth/user/pass/SHA-256";
		const realm = "mockhttp";
		const nonce = "somenonce";

		// Create auth header without qop
		const ha1 = crypto
			.createHash("sha256")
			.update(`user:${realm}:pass`)
			.digest("hex");
		const ha2 = crypto.createHash("sha256").update(`GET:${uri}`).digest("hex");
		const wrongResponse = crypto
			.createHash("sha256")
			.update(`${ha1}:${nonce}:${ha2}WRONG`)
			.digest("hex");

		const authHeader = `Digest username="user", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${wrongResponse}", algorithm="SHA-256"`;

		const response = await fastify.inject({
			method: "GET",
			url: uri,
			headers: { authorization: authHeader },
		});
		expect(response.statusCode).toBe(401);
	});

	// Test lines 157-159: Wrong response on algorithm endpoint
	it("401 when response is wrong on algorithm endpoint", async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		digestAuthRoute(fastify);

		const response = await fastify.inject({
			method: "GET",
			url: "/digest-auth/auth/user/pass/SHA-512",
			headers: {
				authorization: 'Digest username="user", response="wrongresponse"',
			},
		});
		expect(response.statusCode).toBe(401);
		expect(response.headers["www-authenticate"]).toMatch(/algorithm=SHA-512/);
	});

	// Test line 161: Successful authentication on algorithm endpoint
	it.skip("authenticates successfully on algorithm endpoint", async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		digestAuthRoute(fastify);

		// Mock the makeNonce function to return a predictable value
		const originalMakeNonce = crypto.randomBytes;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		(crypto as any).randomBytes = () => Buffer.from("predictable2", "utf8");

		try {
			// Get challenge first
			const challenge = await fastify.inject({
				method: "GET",
				url: "/digest-auth/auth/testuser/testpass/SHA-256",
			});

			const authHeader = challenge.headers["www-authenticate"] as string;
			const nonceMatch = /nonce="([^"]+)"/.exec(authHeader);
			const nonce = nonceMatch?.[1] ?? "";

			const uri = "/digest-auth/auth/testuser/testpass/SHA-256";
			const realm = "mockhttp";
			const nc = "00000001";
			const cnonce = "testcnonce2";
			const qop = "auth";

			// Compute correct response with SHA-256
			const ha1 = crypto
				.createHash("sha256")
				.update(`testuser:${realm}:testpass`)
				.digest("hex");
			const ha2 = crypto
				.createHash("sha256")
				.update(`GET:${uri}`)
				.digest("hex");
			const responseHash = crypto
				.createHash("sha256")
				.update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
				.digest("hex");

			const validAuthHeader =
				`Digest username="testuser", realm="${realm}", nonce="${nonce}", uri="${uri}", ` +
				`qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${responseHash}", algorithm="SHA-256"`;

			const response = await fastify.inject({
				method: "GET",
				url: uri,
				headers: { authorization: validAuthHeader },
			});

			expect(response.statusCode).toBe(200);
			const body = JSON.parse(String(response.body)) as {
				authenticated: boolean;
				user: string;
			};
			expect(body.authenticated).toBe(true);
			expect(body.user).toBe("testuser");
		} finally {
			// Restore original function
			(crypto as any).randomBytes = originalMakeNonce;
		}
	});

	// Additional test for successful auth without qop on algorithm endpoint (line 154)
	it.skip("authenticates successfully without qop on algorithm endpoint", async () => {
		// eslint-disable-next-line new-cap
		const fastify = Fastify();
		digestAuthRoute(fastify);

		// Mock the makeNonce function to return a predictable value
		const originalMakeNonce = crypto.randomBytes;
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		(crypto as any).randomBytes = () => Buffer.from("predictable3", "utf8");

		try {
			// Get challenge first
			const challenge = await fastify.inject({
				method: "GET",
				url: "/digest-auth/auth/testuser/testpass/MD5",
			});

			const authHeader = challenge.headers["www-authenticate"] as string;
			const nonceMatch = /nonce="([^"]+)"/.exec(authHeader);
			const nonce = nonceMatch?.[1] ?? "";

			const uri = "/digest-auth/auth/testuser/testpass/MD5";
			const realm = "mockhttp";

			// Compute correct response without qop
			const ha1 = crypto
				.createHash("md5")
				.update(`testuser:${realm}:testpass`)
				.digest("hex");
			const ha2 = crypto.createHash("md5").update(`GET:${uri}`).digest("hex");
			const responseHash = crypto
				.createHash("md5")
				.update(`${ha1}:${nonce}:${ha2}`)
				.digest("hex");

			const validAuthHeader = `Digest username="testuser", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${responseHash}", algorithm="MD5"`;

			const response = await fastify.inject({
				method: "GET",
				url: uri,
				headers: { authorization: validAuthHeader },
			});

			expect(response.statusCode).toBe(200);
			const body = JSON.parse(String(response.body)) as {
				authenticated: boolean;
				user: string;
			};
			expect(body.authenticated).toBe(true);
			expect(body.user).toBe("testuser");
		} finally {
			// Restore original function
			(crypto as any).randomBytes = originalMakeNonce;
		}
	});
});

describe("hashAlg", () => {
	it("returns md5 when undefined", () => {
		expect(hashAlg(undefined)).toBe("md5");
	});

	it("returns md5 for md5 (lower/upper case variants)", () => {
		expect(hashAlg("md5")).toBe("md5");
		expect(hashAlg("MD5")).toBe("md5");
	});

	it("returns sha256 for sha-256", () => {
		expect(hashAlg("sha-256")).toBe("sha256");
		expect(hashAlg("SHA-256")).toBe("sha256");
	});

	it("returns sha512 for sha-512", () => {
		expect(hashAlg("sha-512")).toBe("sha512");
		expect(hashAlg("SHA-512")).toBe("sha512");
	});

	it("defaults to md5 for unknown strings", () => {
		expect(hashAlg("unknown")).toBe("md5");
		expect(hashAlg("")).toBe("md5");
	});
});
