import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";
import type { MockHttpBins } from "../../mock-http-bins.js";

const captureSchema: FastifySchema = {
	description:
		"Capture any HTTP request sent to a bin. Stores method, headers, body, query, and metadata.",
	tags: ["Bins"],
	params: {
		type: "object",
		properties: {
			id: { type: "string", description: "Bin identifier" },
			"*": {
				type: "string",
				description: "Sub-path captured with the request",
			},
		},
		required: ["id"],
	},
	response: {
		200: {
			type: "object",
			properties: {
				ok: { type: "boolean" },
				binId: { type: "string" },
				requestId: { type: "string" },
			},
			required: ["ok", "binId", "requestId"],
		},
		404: {
			type: "object",
			properties: { error: { type: "string" } },
			required: ["error"],
		},
	},
};

const TEXT_CONTENT_TYPE_REGEX =
	/^(text\/|application\/(json|xml|x-www-form-urlencoded|javascript))/i;

type CaptureRequest = FastifyRequest<{
	Params: { id: string; "*"?: string };
}>;

/**
 * Create a Fastify plugin that registers the catch-all bin capture endpoint
 * at `/b/:id` and `/b/:id/*`, with the provided {@link MockHttpBins} injected.
 */
export const binsCaptureRoute = (bins: MockHttpBins) => {
	return (fastify: FastifyInstance) => {
		// Capture every request body as a raw Buffer regardless of content type.
		// Default Fastify parsers (json, text, urlencoded) would otherwise pre-parse
		// the payload and we'd lose access to the raw bytes for binary content.
		fastify.removeAllContentTypeParsers();
		fastify.addContentTypeParser(
			"*",
			{ parseAs: "buffer" },
			(_request, body, done) => {
				done(null, body);
			},
		);

		const handler = async (request: CaptureRequest, reply: FastifyReply) => {
			const { id } = request.params;
			const rest = request.params["*"] ?? "";

			const raw = request.body as Buffer | undefined;
			const bodySize = raw?.length ?? 0;
			const max = bins.maxBodySize;
			const truncated = bodySize > max;
			const slice = raw && raw.length > 0 ? raw.subarray(0, max) : undefined;
			const contentTypeHeader = request.headers["content-type"];
			const contentType =
				typeof contentTypeHeader === "string" ? contentTypeHeader : undefined;
			const isText = contentType
				? TEXT_CONTENT_TYPE_REGEX.test(contentType)
				: false;

			let bodyEncoding: "utf8" | "base64" | "none";
			let body: string | null;
			if (!slice) {
				bodyEncoding = "none";
				body = null;
			} else if (isText) {
				bodyEncoding = "utf8";
				body = slice.toString("utf8");
			} else {
				bodyEncoding = "base64";
				body = slice.toString("base64");
			}

			const prefix = `/b/${id}`;
			const url = request.url.slice(prefix.length) || "/";
			const path = rest ? `/${rest}` : "/";

			const captured = await bins.recordRequest(id, {
				method: request.method,
				url,
				path,
				query: request.query as Record<string, string | string[]>,
				headers: request.headers as Record<string, string | string[]>,
				remoteAddress: request.ip,
				contentType,
				bodySize,
				body,
				bodyEncoding,
				truncated,
			});
			if (!captured) {
				return reply.code(404).send({ error: "bin_not_found" });
			}

			return reply.code(200).send({
				ok: true,
				binId: id,
				requestId: captured.id,
			});
		};

		const opts = {
			schema: captureSchema,
			/* v8 ignore next -- @preserve */
			validatorCompiler: () => () => true,
		};

		// HEAD is auto-registered by Fastify when GET is declared, and uses the
		// same handler — so we register every method *except* HEAD.
		const methods = [
			"get",
			"post",
			"put",
			"patch",
			"delete",
			"options",
		] as const;
		for (const m of methods) {
			fastify[m]("/b/:id", opts, handler);
			fastify[m]("/b/:id/*", opts, handler);
		}
	};
};
