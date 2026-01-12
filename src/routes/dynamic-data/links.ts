import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";

type LinksRequest = FastifyRequest<{
	Params: { n: string; offset?: string };
}>;

const linksSchema: FastifySchema = {
	description:
		"Generate a page containing n links to other pages which do the same",
	tags: ["Dynamic Data"],
	params: {
		type: "object",
		properties: {
			n: {
				type: "string",
				description: "Number of links to generate",
			},
			offset: {
				type: "string",
				description: "Starting offset for pagination (default: 0)",
			},
		},
		required: ["n"],
	},
	response: {
		200: {
			type: "string",
			description: "HTML page with links",
		},
		400: {
			type: "object",
			properties: {
				error: { type: "string" },
			},
		},
	},
};

const MAX_LINKS = 200;

export const linksRoute = (fastify: FastifyInstance) => {
	fastify.get(
		"/links/:n/:offset?",
		{ schema: linksSchema },
		async (request: LinksRequest, reply: FastifyReply) => {
			const n = Number.parseInt(request.params.n, 10);
			const offset = request.params.offset
				? Number.parseInt(request.params.offset, 10)
				: 0;

			if (Number.isNaN(n) || n < 0) {
				return reply
					.code(400)
					.send({ error: "n must be a non-negative integer" });
			}

			if (Number.isNaN(offset) || offset < 0) {
				return reply
					.code(400)
					.send({ error: "offset must be a non-negative integer" });
			}

			const limitedN = Math.min(n, MAX_LINKS);

			// Generate HTML with links
			const links: string[] = [];
			for (let i = 0; i < limitedN; i++) {
				if (i === offset) {
					links.push(`${i} `);
				} else {
					links.push(`<a href="/links/${limitedN}/${i}">${i}</a> `);
				}
			}

			const html = `<html>
<head>
<title>Links</title>
</head>
<body>
${links.join("")}
</body>
</html>`;

			return reply
				.header("Content-Type", "text/html; charset=utf-8")
				.send(html);
		},
	);
};
