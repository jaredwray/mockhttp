import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export const sitemapRoute = (fastify: FastifyInstance) => {
	fastify.get(
		"/sitemap.xml",
		{ schema: { hide: true } },
		async (_request: FastifyRequest, reply: FastifyReply) => {
			try {
				const host = _request.headers.host ?? "mockhttp.org";
				const isSecure =
					_request.headers["x-forwarded-proto"]?.includes("https");
				const protocol = isSecure ? "https" : "http";
				const xml = `<?xml version="1.0" encoding="UTF-8"?>
                            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                                <url>
                                    <loc>${protocol}://${host}/</loc>
                                    <changefreq>monthly</changefreq>
                                    <priority>1.0</priority>
                                </url>
                        </urlset>`;

				await reply.type("text/xml").send(xml);
				/* c8 ignore next 4 */
			} catch (error) {
				fastify.log.error(error);
				await reply.status(500).send({ error: "Internal Server Error" });
			}
		},
	);
};
