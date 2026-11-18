import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";
import type { Bin } from "../../bin-store.js";
import type { MockHttpBins } from "../../mock-http-bins.js";

const binSchema = {
	type: "object",
	properties: {
		id: { type: "string" },
		createdAt: { type: "string" },
		expiresAt: { type: "string" },
		requestCount: { type: "integer" },
	},
	required: ["id", "createdAt", "expiresAt", "requestCount"],
};

const capturedRequestSchema = {
	type: "object",
	properties: {
		id: { type: "string" },
		binId: { type: "string" },
		method: { type: "string" },
		url: { type: "string" },
		path: { type: "string" },
		query: { type: "object", additionalProperties: true },
		headers: { type: "object", additionalProperties: true },
		remoteAddress: { type: "string" },
		contentType: { type: "string" },
		bodySize: { type: "integer" },
		body: { type: ["string", "null"] },
		bodyEncoding: { type: "string", enum: ["utf8", "base64", "none"] },
		truncated: { type: "boolean" },
		capturedAt: { type: "string" },
	},
	required: [
		"id",
		"binId",
		"method",
		"url",
		"path",
		"query",
		"headers",
		"remoteAddress",
		"bodySize",
		"body",
		"bodyEncoding",
		"truncated",
		"capturedAt",
	],
};

const errorSchema = {
	type: "object",
	properties: { error: { type: "string" } },
	required: ["error"],
};

const createBinSchema: FastifySchema = {
	description:
		"Create a bin and return the owner token one time. The server stores only the SHA-256 hash.",
	tags: ["Bins"],
	response: {
		200: {
			type: "object",
			properties: {
				id: { type: "string" },
				url: { type: "string" },
				token: {
					type: "string",
					description:
						"Owner secret. Send it as Authorization: Bearer on later management calls.",
				},
				createdAt: { type: "string" },
				expiresAt: { type: "string" },
				requestCount: { type: "integer" },
			},
			required: [
				"id",
				"url",
				"token",
				"createdAt",
				"expiresAt",
				"requestCount",
			],
		},
	},
};

const listBinsSchema: FastifySchema = {
	description:
		"List the bin that matches the Bearer owner token. This route returns no other bins.",
	tags: ["Bins"],
	response: {
		200: {
			type: "object",
			properties: {
				bins: { type: "array", items: binSchema },
			},
			required: ["bins"],
		},
		401: errorSchema,
	},
};

const getBinSchema: FastifySchema = {
	description:
		"Read one bin. Send the owner token in the Authorization header as Bearer.",
	tags: ["Bins"],
	params: {
		type: "object",
		properties: { id: { type: "string" } },
		required: ["id"],
	},
	response: {
		200: binSchema,
		401: errorSchema,
		404: errorSchema,
	},
};

const listRequestsSchema: FastifySchema = {
	description:
		"List captured requests for one bin. Send the owner token as a Bearer token.",
	tags: ["Bins"],
	params: {
		type: "object",
		properties: { id: { type: "string" } },
		required: ["id"],
	},
	response: {
		200: {
			type: "object",
			properties: {
				requests: { type: "array", items: capturedRequestSchema },
			},
			required: ["requests"],
		},
		401: errorSchema,
		404: errorSchema,
	},
};

const getRequestSchema: FastifySchema = {
	description:
		"Read one captured request. Send the owner token as a Bearer token.",
	tags: ["Bins"],
	params: {
		type: "object",
		properties: {
			id: { type: "string" },
			reqId: { type: "string" },
		},
		required: ["id", "reqId"],
	},
	response: {
		200: capturedRequestSchema,
		401: errorSchema,
		404: errorSchema,
	},
};

const deleteBinSchema: FastifySchema = {
	description:
		"Delete one bin and its captured requests. Send the owner token as a Bearer token.",
	tags: ["Bins"],
	params: {
		type: "object",
		properties: { id: { type: "string" } },
		required: ["id"],
	},
	response: {
		204: { type: "null" },
		401: errorSchema,
		404: errorSchema,
	},
};

const clearRequestsSchema: FastifySchema = {
	description:
		"Clear captured requests for one bin. Send the owner token as a Bearer token.",
	tags: ["Bins"],
	params: {
		type: "object",
		properties: { id: { type: "string" } },
		required: ["id"],
	},
	response: {
		204: { type: "null" },
		401: errorSchema,
		404: errorSchema,
	},
};

type BinIdRequest = FastifyRequest<{ Params: { id: string } }>;
type RequestIdRequest = FastifyRequest<{
	Params: { id: string; reqId: string };
}>;

/**
 * Set by the Worker from the incoming request URL. The Node bridge rewrites
 * `x-forwarded-proto` to the plain-HTTP socket, so that header cannot carry
 * the public scheme.
 */
export const PUBLIC_PROTOCOL_HEADER = "x-mockhttp-forwarded-proto";

/**
 * Public capture URL for a new bin.
 * The last forwarded protocol wins, matching a proxy chain. An unrecognized
 * value falls back to the socket protocol, then `http`.
 */
export function binCaptureUrl(
	forwardedProto: string | string[] | undefined,
	socketProtocol: string | undefined,
	host: string,
	id: string,
): string {
	const raw = Array.isArray(forwardedProto)
		? forwardedProto.join(",")
		: forwardedProto;
	const forwarded = raw?.split(",").at(-1)?.trim().toLowerCase();
	let protocol = "http";
	if (forwarded === "https" || forwarded === "http") {
		protocol = forwarded;
	} else if (socketProtocol === "https") {
		protocol = "https";
	}
	return `${protocol}://${host}/b/${id}`;
}

type OwnerAccess =
	| { status: "ok"; bin: Bin }
	| { status: "unauthorized" }
	| { status: "not_found" };

/**
 * Read a Bearer owner token.
 * Return undefined when the header is missing or malformed.
 */
function bearerOwnerToken(header: string | undefined): string | undefined {
	if (!header) {
		return undefined;
	}
	const match = /^Bearer ([A-Za-z0-9_-]+)$/i.exec(header.trim());
	return match?.[1];
}

/**
 * Check the owner token for one bin.
 * No token is unauthorized for every id, so the caller cannot learn that the bin exists.
 * A token that does not match is not_found, the same as a missing bin.
 */
async function ownerAccess(
	bins: MockHttpBins,
	request: FastifyRequest,
	id: string,
): Promise<OwnerAccess> {
	const token = bearerOwnerToken(request.headers.authorization);
	if (!token) {
		return { status: "unauthorized" };
	}
	const decision = await bins.authorizeOwner(id, token);
	if (!decision.ok) {
		return { status: "not_found" };
	}
	return { status: "ok", bin: decision.bin };
}

/** Send 401 or 404. The two codes do not reveal whether the bin exists. */
function sendOwnerFailure(
	reply: FastifyReply,
	status: "unauthorized" | "not_found",
) {
	if (status === "unauthorized") {
		return reply
			.code(401)
			.header("www-authenticate", "Bearer")
			.send({ error: "unauthorized" });
	}
	return reply.code(404).send({ error: "bin_not_found" });
}

/**
 * Create a Fastify plugin that registers bin management endpoints, with the
 * provided {@link MockHttpBins} injected.
 */
export const binsManagementRoute = (bins: MockHttpBins) => {
	return (fastify: FastifyInstance) => {
		fastify.post(
			"/bins",
			{ schema: createBinSchema },
			async (request: FastifyRequest, _reply: FastifyReply) => {
				const bin = await bins.createBin();
				/* v8 ignore next -- @preserve */
				const host = request.headers.host ?? request.hostname;
				return {
					id: bin.id,
					url: binCaptureUrl(
						request.headers[PUBLIC_PROTOCOL_HEADER] ??
							request.headers["x-forwarded-proto"],
						request.protocol,
						host,
						bin.id,
					),
					token: bin.token,
					createdAt: bin.createdAt,
					expiresAt: bin.expiresAt,
					requestCount: bin.requestCount,
				};
			},
		);

		fastify.get("/bins", { schema: listBinsSchema }, async (request, reply) => {
			const token = bearerOwnerToken(request.headers.authorization);
			if (!token) {
				return sendOwnerFailure(reply, "unauthorized");
			}
			return { bins: await bins.listBinsForToken(token) };
		});

		fastify.get(
			"/bins/:id",
			{ schema: getBinSchema },
			async (request: BinIdRequest, reply: FastifyReply) => {
				const access = await ownerAccess(bins, request, request.params.id);
				if (access.status !== "ok") {
					return sendOwnerFailure(reply, access.status);
				}
				return access.bin;
			},
		);

		fastify.get(
			"/bins/:id/requests",
			{ schema: listRequestsSchema },
			async (request: BinIdRequest, reply: FastifyReply) => {
				const access = await ownerAccess(bins, request, request.params.id);
				if (access.status !== "ok") {
					return sendOwnerFailure(reply, access.status);
				}
				return { requests: await bins.getRequests(request.params.id) };
			},
		);

		fastify.get(
			"/bins/:id/requests/:reqId",
			{ schema: getRequestSchema },
			async (request: RequestIdRequest, reply: FastifyReply) => {
				const access = await ownerAccess(bins, request, request.params.id);
				if (access.status !== "ok") {
					return sendOwnerFailure(reply, access.status);
				}
				const captured = await bins.getRequest(
					request.params.id,
					request.params.reqId,
				);
				if (!captured) {
					return reply.code(404).send({ error: "request_not_found" });
				}
				return captured;
			},
		);

		fastify.delete(
			"/bins/:id/requests",
			{ schema: clearRequestsSchema },
			async (request: BinIdRequest, reply: FastifyReply) => {
				const access = await ownerAccess(bins, request, request.params.id);
				if (access.status !== "ok") {
					return sendOwnerFailure(reply, access.status);
				}
				await bins.clearRequests(request.params.id);
				return reply.code(204).send();
			},
		);

		fastify.delete(
			"/bins/:id",
			{ schema: deleteBinSchema },
			async (request: BinIdRequest, reply: FastifyReply) => {
				const access = await ownerAccess(bins, request, request.params.id);
				if (access.status !== "ok") {
					return sendOwnerFailure(reply, access.status);
				}
				await bins.deleteBin(request.params.id);
				return reply.code(204).send();
			},
		);
	};
};
