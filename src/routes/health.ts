import type { FastifyInstance, FastifyReply, FastifySchema } from "fastify";
import {
	type BinHealth,
	logBinStore,
	redactStoreError,
} from "../bin-store-diagnostics.js";

/** Cheap read against the in-memory Keyv used when MongoDB is not configured. */
export async function checkMemoryBinStore(keyv: {
	get(key: string): Promise<unknown>;
}): Promise<BinHealth> {
	const started = Date.now();
	try {
		await keyv.get("__mockhttp_healthz__");
		return {
			status: "ok",
			bins: {
				store: "memory",
				connected: true,
				latencyMs: Math.max(0, Date.now() - started),
				uriPresent: false,
				scheme: null,
			},
		};
	} catch (error) {
		logBinStore({ phase: "healthz", store: "memory", error });
		return {
			status: "error",
			bins: {
				store: "memory",
				connected: false,
				uriPresent: false,
				scheme: null,
				error: redactStoreError(error),
			},
		};
	}
}

const uriDiagnosticsSchema = {
	type: "object",
	properties: {
		length: { type: "integer" },
		leadingWhitespace: { type: "boolean" },
		trailingWhitespace: { type: "boolean" },
		newline: { type: "boolean" },
		wrappedQuotes: { type: "boolean" },
		atCount: { type: "integer" },
		host: { type: ["string", "null"] },
		username: { type: ["string", "null"] },
		passwordLength: { type: ["integer", "null"] },
		passwordReserved: { type: "array", items: { type: "string" } },
		passwordHasPercent: { type: "boolean" },
	},
	required: [
		"length",
		"leadingWhitespace",
		"trailingWhitespace",
		"newline",
		"wrappedQuotes",
		"atCount",
		"host",
		"username",
		"passwordLength",
		"passwordReserved",
		"passwordHasPercent",
	],
};

const binHealthFields = {
	store: { type: "string", enum: ["mongo", "memory"] },
	connected: { type: "boolean" },
	latencyMs: { type: "integer" },
	uriPresent: { type: "boolean" },
	scheme: { type: ["string", "null"], enum: ["mongodb", "mongodb+srv", null] },
	uri: uriDiagnosticsSchema,
};

const healthSchema: FastifySchema = {
	description:
		"Report whether bin storage is reachable. MongoDB failures include the driver error. The password and the full URI are never returned. A MongoDB result can include the host, the username, the URI length, and the password length.",
	tags: ["Health"],
	response: {
		200: {
			type: "object",
			properties: {
				status: { type: "string", enum: ["ok"] },
				bins: {
					type: "object",
					properties: binHealthFields,
					required: ["store", "connected", "latencyMs", "uriPresent", "scheme"],
				},
			},
			required: ["status", "bins"],
		},
		503: {
			type: "object",
			properties: {
				status: { type: "string", enum: ["error"] },
				bins: {
					type: "object",
					properties: {
						...binHealthFields,
						error: {
							type: "object",
							properties: {
								name: { type: "string" },
								message: { type: "string" },
								code: { type: ["string", "number", "null"] },
							},
							required: ["name", "message", "code"],
						},
					},
					required: ["store", "connected", "uriPresent", "scheme", "error"],
				},
			},
			required: ["status", "bins"],
		},
	},
};

export const healthRoute =
	(check: () => Promise<BinHealth>) => (fastify: FastifyInstance) => {
		fastify.get(
			"/healthz",
			{ schema: healthSchema },
			async (_request, reply: FastifyReply) => {
				try {
					const report = await check();
					if (report.status === "error") {
						return reply.status(503).send(report);
					}
					return report;
				} catch (error) {
					logBinStore({ phase: "healthz", store: "unknown", error });
					const info = redactStoreError(error);
					return reply.status(503).send({
						status: "error",
						bins: {
							store: "mongo",
							connected: false,
							uriPresent: false,
							scheme: null,
							error: info,
						},
					});
				}
			},
		);
	};
