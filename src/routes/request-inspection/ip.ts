import type { FastifyInstance, FastifyRequest, FastifySchema } from "fastify";

const ipSchema: FastifySchema = {
	description: "Returns the IP address of the client",
	tags: ["Request Inspection"],
	response: {
		200: {
			type: "object",
			properties: {
				ip: { type: "string", description: "The IP address of the client" },
			},
			required: ["ip"],
		},
	},
};

export const ipRoute = (fastify: FastifyInstance) => {
	fastify.get("/ip", { schema: ipSchema }, async (request: FastifyRequest) => {
		const cloudflareIp = request.headers["cf-connecting-ip"];
		const forwardedIp = request.headers["x-forwarded-for"];
		const remoteIp = request.ip;

		// Determine the client's IP address, considering Cloudflare and other proxies
		const ip =
			cloudflareIp ??
			(typeof forwardedIp === "string"
				? forwardedIp.split(",")[0].trim()
				: remoteIp);

		return {
			ip,
		};
	});
};
