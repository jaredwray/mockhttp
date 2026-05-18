import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";
import type { BinManager } from "../../bin-manager.js";

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

const createBinSchema: FastifySchema = {
	description: "Create a new request bin",
	tags: ["Bins"],
	response: {
		200: {
			type: "object",
			properties: {
				id: { type: "string" },
				url: { type: "string" },
				createdAt: { type: "string" },
				expiresAt: { type: "string" },
				requestCount: { type: "integer" },
			},
			required: ["id", "url", "createdAt", "expiresAt", "requestCount"],
		},
	},
};

const listBinsSchema: FastifySchema = {
	description: "List all active bins",
	tags: ["Bins"],
	response: {
		200: {
			type: "object",
			properties: {
				bins: { type: "array", items: binSchema },
			},
			required: ["bins"],
		},
	},
};

const getBinSchema: FastifySchema = {
	description: "Get metadata for a single bin",
	tags: ["Bins"],
	params: {
		type: "object",
		properties: { id: { type: "string" } },
		required: ["id"],
	},
	response: {
		200: binSchema,
		404: {
			type: "object",
			properties: { error: { type: "string" } },
			required: ["error"],
		},
	},
};

const listRequestsSchema: FastifySchema = {
	description: "List captured requests for a bin (newest first)",
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
		404: {
			type: "object",
			properties: { error: { type: "string" } },
			required: ["error"],
		},
	},
};

const getRequestSchema: FastifySchema = {
	description: "Get a single captured request by id",
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
		404: {
			type: "object",
			properties: { error: { type: "string" } },
			required: ["error"],
		},
	},
};

const deleteBinSchema: FastifySchema = {
	description: "Delete a bin and all its captured requests",
	tags: ["Bins"],
	params: {
		type: "object",
		properties: { id: { type: "string" } },
		required: ["id"],
	},
	response: {
		204: { type: "null" },
		404: {
			type: "object",
			properties: { error: { type: "string" } },
			required: ["error"],
		},
	},
};

const clearRequestsSchema: FastifySchema = {
	description: "Clear all captured requests for a bin",
	tags: ["Bins"],
	params: {
		type: "object",
		properties: { id: { type: "string" } },
		required: ["id"],
	},
	response: {
		204: { type: "null" },
		404: {
			type: "object",
			properties: { error: { type: "string" } },
			required: ["error"],
		},
	},
};

type BinIdRequest = FastifyRequest<{ Params: { id: string } }>;
type RequestIdRequest = FastifyRequest<{
	Params: { id: string; reqId: string };
}>;

/**
 * Create a Fastify plugin that registers bin management endpoints, with the
 * provided {@link BinManager} injected.
 */
export const binsManagementRoute = (binManager: BinManager) => {
	return (fastify: FastifyInstance) => {
		fastify.post(
			"/bins",
			{ schema: createBinSchema },
			async (request: FastifyRequest, _reply: FastifyReply) => {
				const bin = binManager.createBin();
				/* v8 ignore next -- @preserve */
				const host = request.headers.host ?? request.hostname;
				return {
					...bin,
					url: `${request.protocol}://${host}/b/${bin.id}`,
				};
			},
		);

		fastify.get(
			"/bins",
			{ schema: listBinsSchema },
			async (_request, _reply) => ({
				bins: binManager.listBins(),
			}),
		);

		fastify.get(
			"/bins/:id",
			{ schema: getBinSchema },
			async (request: BinIdRequest, reply: FastifyReply) => {
				const bin = binManager.getBin(request.params.id);
				if (!bin) {
					return reply.code(404).send({ error: "bin_not_found" });
				}
				return bin;
			},
		);

		fastify.get(
			"/bins/:id/requests",
			{ schema: listRequestsSchema },
			async (request: BinIdRequest, reply: FastifyReply) => {
				const bin = binManager.getBin(request.params.id);
				if (!bin) {
					return reply.code(404).send({ error: "bin_not_found" });
				}
				return { requests: binManager.getRequests(request.params.id) };
			},
		);

		fastify.get(
			"/bins/:id/requests/:reqId",
			{ schema: getRequestSchema },
			async (request: RequestIdRequest, reply: FastifyReply) => {
				const bin = binManager.getBin(request.params.id);
				if (!bin) {
					return reply.code(404).send({ error: "bin_not_found" });
				}
				const captured = binManager.getRequest(
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
				const bin = binManager.getBin(request.params.id);
				if (!bin) {
					return reply.code(404).send({ error: "bin_not_found" });
				}
				binManager.clearRequests(request.params.id);
				return reply.code(204).send();
			},
		);

		fastify.delete(
			"/bins/:id",
			{ schema: deleteBinSchema },
			async (request: BinIdRequest, reply: FastifyReply) => {
				const existed = binManager.deleteBin(request.params.id);
				if (!existed) {
					return reply.code(404).send({ error: "bin_not_found" });
				}
				return reply.code(204).send();
			},
		);
	};
};
