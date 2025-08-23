import { randomInt } from "node:crypto";
import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";

const statusCodes = [
	{ code: 100, message: "Continue" },
	{ code: 101, message: "Switching Protocols" },
	{ code: 102, message: "Processing" },
	{ code: 103, message: "Early Hints" },
	{ code: 200, message: "OK" },
	{ code: 201, message: "Created" },
	{ code: 202, message: "Accepted" },
	{ code: 203, message: "Non-Authoritative Information" },
	{ code: 204, message: "No Content" },
	{ code: 205, message: "Reset Content" },
	{ code: 206, message: "Partial Content" },
	{ code: 207, message: "Multi-Status" },
	{ code: 208, message: "Already Reported" },
	{ code: 226, message: "IM Used" },
	{ code: 300, message: "Multiple Choices" },
	{ code: 301, message: "Moved Permanently" },
	{ code: 302, message: "Found" },
	{ code: 303, message: "See Other" },
	{ code: 304, message: "Not Modified" },
	{ code: 305, message: "Use Proxy" },
	{ code: 306, message: "Switch Proxy" },
	{ code: 307, message: "Temporary Redirect" },
	{ code: 308, message: "Permanent Redirect" },
	{ code: 400, message: "Bad Request" },
	{ code: 401, message: "Unauthorized" },
	{ code: 402, message: "Payment Required" },
	{ code: 403, message: "Forbidden" },
	{ code: 404, message: "Not Found" },
	{ code: 405, message: "Method Not Allowed" },
	{ code: 406, message: "Not Acceptable" },
	{ code: 407, message: "Proxy Authentication Required" },
	{ code: 408, message: "Request Timeout" },
	{ code: 409, message: "Conflict" },
	{ code: 410, message: "Gone" },
	{ code: 411, message: "Length Required" },
	{ code: 412, message: "Precondition Failed" },
	{ code: 413, message: "Payload Too Large" },
	{ code: 414, message: "URI Too Long" },
	{ code: 415, message: "Unsupported Media Type" },
	{ code: 416, message: "Range Not Satisfiable" },
	{ code: 417, message: "Expectation Failed" },
	{ code: 418, message: "I'm a teapot" },
	{ code: 421, message: "Misdirected Request" },
	{ code: 422, message: "Unprocessable Entity" },
	{ code: 423, message: "Locked" },
	{ code: 424, message: "Failed Dependency" },
	{ code: 425, message: "Too Early" },
	{ code: 426, message: "Upgrade Required" },
	{ code: 428, message: "Precondition Required" },
	{ code: 429, message: "Too Many Requests" },
	{ code: 431, message: "Request Header Fields Too Large" },
	{ code: 451, message: "Unavailable For Legal Reasons" },
	{ code: 500, message: "Internal Server Error" },
	{ code: 501, message: "Not Implemented" },
	{ code: 502, message: "Bad Gateway" },
	{ code: 503, message: "Service Unavailable" },
	{ code: 504, message: "Gateway Timeout" },
	{ code: 505, message: "HTTP Version Not Supported" },
	{ code: 506, message: "Variant Also Negotiates" },
	{ code: 507, message: "Insufficient Storage" },
	{ code: 508, message: "Loop Detected" },
	{ code: 510, message: "Not Extended" },
	{ code: 511, message: "Network Authentication Required" },
];

type StatusRequest = FastifyRequest<{ Params: { code?: string } }>;

const statusSchema: FastifySchema = {
	description:
		"Return status code or random status code if more than one are given ",
	tags: ["Status Codes"],
	params: {
		type: "object",
		properties: {
			code: { type: "string", description: "HTTP status code to be returned" },
		},
	},
	response: {
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		200: {
			type: "object",
			properties: {
				status: { type: "string" },
			},
		},
	},
};

export const statusCodeRoute = (fastify: FastifyInstance) => {
	const handler = async (request: StatusRequest, reply: FastifyReply) => {
		let { code } = request.params;

		// Check if the code is a valid HTTP status code, otherwise pick a random one
		if (
			!code ||
			!statusCodes.map((status) => status.code).includes(Number(code))
		) {
			code = statusCodes[randomInt(0, statusCodes.length)].code.toString();
		}

		await reply.code(Number(code)).send({
			status: `Response with status code ${code}`,
		});
	};

	fastify.get("/status/:code?", { schema: statusSchema }, handler);
	fastify.post("/status/:code?", { schema: statusSchema }, handler);
	fastify.put("/status/:code?", { schema: statusSchema }, handler);
	fastify.patch("/status/:code?", { schema: statusSchema }, handler);
	fastify.delete("/status/:code?", { schema: statusSchema }, handler);
};
