import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";

type BasicAuthParameters = {
	user: string;
	passwd: string;
};

const parseBasic = (header?: string) => {
	if (!header || typeof header !== "string") {
		return undefined;
	}

	// Split only on the first space to handle potential spaces in base64
	const spaceIndex = header.indexOf(" ");
	if (spaceIndex === -1) {
		return undefined;
	}

	const scheme = header.slice(0, spaceIndex);
	const value = header.slice(spaceIndex + 1);

	if (scheme.toLowerCase() !== "basic" || !value) {
		return undefined;
	}

	try {
		const decoded = Buffer.from(value, "base64").toString("utf8");
		const idx = decoded.indexOf(":");
		if (idx === -1) {
			return undefined;
		}

		const username = decoded.slice(0, idx);
		const password = decoded.slice(idx + 1);

		// Return undefined for empty username (password can be empty)
		if (username === "") {
			return undefined;
		}

		return { username, password };
		/* c8 ignore next 4 */
	} catch {
		// Invalid base64 or encoding errors
		return undefined;
	}
};

// Constant-time string comparison to prevent timing attacks
const safeCompare = (a: string, b: string): boolean => {
	if (a.length !== b.length) {
		return false;
	}

	try {
		return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
		/* c8 ignore next 4 */
	} catch {
		// Fallback for any encoding issues
		return false;
	}
};

export const basicAuthSchema: FastifySchema = {
	description:
		"HTTP Basic authentication. Succeeds only if the user/pass provided in the path matches the Basic Authorization header.",
	tags: ["Auth"],
	params: {
		type: "object",
		properties: {
			user: { type: "string" },
			passwd: { type: "string" },
		},
		required: ["user", "passwd"],
	},
	response: {
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		200: {
			type: "object",
			properties: {
				authenticated: { type: "boolean" },
				user: { type: "string" },
			},
			required: ["authenticated", "user"],
		},
		// eslint-disable-next-line  @typescript-eslint/naming-convention
		401: {
			type: "object",
			properties: {
				message: { type: "string" },
			},
			required: ["message"],
		},
	},
};

export const basicAuthRoute = (fastify: FastifyInstance) => {
	fastify.get(
		"/basic-auth/:user/:passwd",
		{ schema: basicAuthSchema },
		async (
			request: FastifyRequest<{ Params: BasicAuthParameters }>,
			reply: FastifyReply,
		) => {
			const { user, passwd } = request.params;

			// Validate route parameters (allow empty passwd but not empty user)
			if (!user || typeof user !== "string" || typeof passwd !== "string") {
				void reply.header("WWW-Authenticate", 'Basic realm="mockhttp"');
				return reply.status(401).send({ message: "Unauthorized" });
			}

			const parsed = parseBasic(request.headers.authorization);

			// Use constant-time comparison to prevent timing attacks
			if (
				!parsed ||
				!safeCompare(parsed.username, user) ||
				!safeCompare(parsed.password, passwd)
			) {
				void reply.header("WWW-Authenticate", 'Basic realm="mockhttp"');
				return reply.status(401).send({ message: "Unauthorized" });
			}

			return reply.send({ authenticated: true, user });
		},
	);
};

export default basicAuthRoute;
