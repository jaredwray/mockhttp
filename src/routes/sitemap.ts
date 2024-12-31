import fs from 'node:fs';
import path from 'node:path';
import {type FastifyInstance, type FastifyRequest, type FastifyReply} from 'fastify';

export const sitemapRoute = (fastify: FastifyInstance) => {
	fastify.get('/sitemap.xml', {schema: {hide: true}}, async (_request: FastifyRequest, reply: FastifyReply) => {
		try {
			const host = _request.headers.host ?? 'mockhttp.org';
			const isSecure = _request.headers['x-forwarded-proto']?.includes('https');
			const packageJsonPath = path.resolve('package.json');
			const packageStats = fs.statSync(packageJsonPath);
			const packageDate = packageStats.mtime.toISOString().split('T')[0];
			const protocol = isSecure ? 'https' : 'http';
			const xml = `<?xml version="1.0" encoding="UTF-8"?>
                            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                                <url>
                                    <loc>${protocol}://${host}/</loc>
                                    <lastmod>${packageDate}</lastmod>
                                    <changefreq>monthly</changefreq>
                                    <priority>1.0</priority>
                                </url>
                        </urlset>`;

			await reply.type('text/xml').send(xml);
			/* c8 ignore next 4 */
		} catch (error) {
			fastify.log.error(error);
			await reply.status(500).send({error: 'Internal Server Error'});
		}
	});
};
