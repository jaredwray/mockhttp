import { brotliCompressSync, deflateSync, gzipSync } from "node:zlib";
import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";

const templateIndexParams = {
	type: "object",
	properties: {
		index: {
			type: "string",
			description:
				"Optional 1-based template index for stable, repeatable output. Omit for a random template.",
		},
	},
};

const templateNotFoundResponse = {
	type: "object",
	description: "The requested template index does not exist",
	properties: {
		error: { type: "string" },
	},
};

const plainSchema: FastifySchema = {
	description:
		"Returns plain text content. A random template is selected unless a 1-based template index is provided (e.g. /plain/1) for stable output.",
	tags: ["Response Formats"],
	params: templateIndexParams,
	response: {
		200: {
			type: "string",
			description: "Plain text content",
		},
		404: templateNotFoundResponse,
	},
};

const textSchema: FastifySchema = {
	description:
		"Returns text content. A random template is selected unless a 1-based template index is provided (e.g. /text/1) for stable output.",
	tags: ["Response Formats"],
	params: templateIndexParams,
	response: {
		200: {
			type: "string",
			description: "Text content",
		},
		404: templateNotFoundResponse,
	},
};

const htmlSchema: FastifySchema = {
	description:
		"Returns HTML content. A random template is selected unless a 1-based template index is provided (e.g. /html/1) for stable output.",
	tags: ["Response Formats"],
	params: templateIndexParams,
	response: {
		200: {
			type: "string",
			description: "HTML content",
		},
		404: templateNotFoundResponse,
	},
};

const xmlSchema: FastifySchema = {
	description:
		"Returns XML content. A random template is selected unless a 1-based template index is provided (e.g. /xml/1) for stable output.",
	tags: ["Response Formats"],
	params: templateIndexParams,
	response: {
		200: {
			type: "string",
			description: "XML content",
		},
		404: templateNotFoundResponse,
	},
};

const jsonSchema: FastifySchema = {
	description:
		"Returns JSON content. A random template is selected unless a 1-based template index is provided (e.g. /json/1) for stable output.",
	tags: ["Response Formats"],
	params: templateIndexParams,
	response: {
		200: {
			type: "object",
			description: "JSON content",
			additionalProperties: true,
		},
		404: templateNotFoundResponse,
	},
};

const denySchema: FastifySchema = {
	description: "Returns page denied by robots.txt rules",
	tags: ["Response Formats"],
	response: {
		403: {
			type: "string",
			description: "Page denied by robots.txt rules",
		},
	},
};

const gzipSchema: FastifySchema = {
	description: "Returns GZip-encoded data",
	tags: ["Response Formats"],
	response: {
		200: {
			type: "string",
			description: "GZip-encoded content",
		},
	},
};

const deflateSchema: FastifySchema = {
	description: "Returns Deflate-encoded data",
	tags: ["Response Formats"],
	response: {
		200: {
			type: "string",
			description: "Deflate-encoded content",
		},
	},
};

const brotliSchema: FastifySchema = {
	description: "Returns Brotli-encoded data",
	tags: ["Response Formats"],
	response: {
		200: {
			type: "string",
			description: "Brotli-encoded content",
		},
	},
};

const randomTexts = [
	"The quick brown fox jumps over the lazy dog.",
	"Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
	"To be or not to be, that is the question.",
	"All work and no play makes Jack a dull boy.",
	"The only way to do great work is to love what you do.",
	"In the beginning was the Word, and the Word was with God.",
	"Once upon a time in a galaxy far, far away...",
	"It was the best of times, it was the worst of times.",
	"The journey of a thousand miles begins with a single step.",
	"Knowledge is power. France is bacon.",
];

const randomHtmlContent = [
	`<!DOCTYPE html>
<html lang="en">
<head>
    <title>Sample Page</title>
</head>
<body>
    <h1>Welcome to MockHTTP</h1>
    <p>This is a sample HTML page with random content.</p>
</body>
</html>`,
	`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Test Document</title>
</head>
<body>
    <header>
        <h1>Test Page</h1>
        <nav>
            <ul>
                <li><a href="#">Home</a></li>
                <li><a href="#">About</a></li>
                <li><a href="#">Contact</a></li>
            </ul>
        </nav>
    </header>
    <main>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
    </main>
</body>
</html>`,
	`<!DOCTYPE html>
<html lang="en">
<head>
    <title>Article Page</title>
    <style>
        body { font-family: Arial, sans-serif; }
        article { max-width: 800px; margin: 0 auto; }
    </style>
</head>
<body>
    <article>
        <h1>The Journey Begins</h1>
        <p>Once upon a time in a digital world...</p>
        <blockquote>
            "The only way to do great work is to love what you do."
        </blockquote>
    </article>
</body>
</html>`,
	`<!DOCTYPE html>
<html>
<head>
    <title>Form Example</title>
</head>
<body>
    <h2>Contact Form</h2>
    <form action="/submit" method="post">
        <label for="name">Name:</label>
        <input type="text" id="name" name="name" required>
        <br>
        <label for="email">Email:</label>
        <input type="email" id="email" name="email" required>
        <br>
        <button type="submit">Submit</button>
    </form>
</body>
</html>`,
	`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Responsive Page</title>
</head>
<body>
    <div class="container">
        <h1>Responsive Design</h1>
        <p>This page adapts to different screen sizes.</p>
        <img src="placeholder.jpg" alt="Placeholder" style="max-width: 100%; height: auto;">
    </div>
</body>
</html>`,
];

const randomXmlContent = [
	`<?xml version="1.0" encoding="UTF-8"?>
<root>
    <message>Hello from MockHTTP</message>
    <timestamp>2024-01-15T10:30:00.000Z</timestamp>
    <status>success</status>
</root>`,
	`<?xml version="1.0" encoding="UTF-8"?>
<book>
    <title>The Great Gatsby</title>
    <author>F. Scott Fitzgerald</author>
    <year>1925</year>
    <publisher>Charles Scribner's Sons</publisher>
    <isbn>978-0-7432-7356-5</isbn>
</book>`,
	`<?xml version="1.0" encoding="UTF-8"?>
<users>
    <user id="1">
        <name>John Doe</name>
        <email>john@example.com</email>
        <role>admin</role>
    </user>
    <user id="2">
        <name>Jane Smith</name>
        <email>jane@example.com</email>
        <role>user</role>
    </user>
</users>`,
	`<?xml version="1.0" encoding="UTF-8"?>
<product>
    <id>12345</id>
    <name>Wireless Mouse</name>
    <description>Ergonomic wireless mouse with 3-year battery life</description>
    <price currency="USD">29.99</price>
    <stock>150</stock>
    <category>Electronics</category>
</product>`,
	`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
    <channel>
        <title>Mock RSS Feed</title>
        <link>http://example.com/rss</link>
        <description>Sample RSS feed from MockHTTP</description>
        <item>
            <title>First Article</title>
            <link>http://example.com/article1</link>
            <description>This is the first article in our feed</description>
            <pubDate>Mon, 15 Jan 2024 10:30:00 GMT</pubDate>
        </item>
    </channel>
</rss>`,
];

const randomJsonContent = [
	{
		message: "Hello from MockHTTP",
		timestamp: "2024-01-15T10:30:00.000Z",
		status: "success",
		code: 200,
	},
	{
		user: {
			id: 1,
			name: "John Doe",
			email: "john@example.com",
			role: "admin",
			createdAt: "2024-01-15T10:30:00Z",
		},
		permissions: ["read", "write", "delete"],
	},
	{
		products: [
			{
				id: 101,
				name: "Laptop",
				price: 999.99,
				stock: 50,
			},
			{
				id: 102,
				name: "Mouse",
				price: 29.99,
				stock: 200,
			},
		],
		total: 2,
		page: 1,
	},
	{
		config: {
			theme: "dark",
			language: "en",
			notifications: {
				email: true,
				push: false,
				sms: false,
			},
			privacy: {
				profile: "public",
				activity: "friends",
			},
		},
	},
	{
		metrics: {
			cpu: 45.2,
			memory: 78.5,
			disk: 62.3,
			network: {
				inbound: "1.2MB/s",
				outbound: "0.8MB/s",
			},
			uptime: "15 days",
			services: [
				{ name: "api", status: "healthy" },
				{ name: "database", status: "healthy" },
				{ name: "cache", status: "warning" },
			],
		},
	},
];

type TemplateRequest = FastifyRequest<{ Params: { index?: string } }>;

// Resolves the optional 1-based index parameter to an array position.
// Returns a random position when no index is given, or -1 when the index
// is not an integer between 1 and length.
const resolveTemplateIndex = (
	index: string | undefined,
	length: number,
): number => {
	if (index === undefined) {
		return Math.floor(Math.random() * length);
	}

	const value = Number(index);
	if (!Number.isInteger(value) || value < 1 || value > length) {
		return -1;
	}

	return value - 1;
};

const templateNotFound = (reply: FastifyReply, length: number) =>
	reply.code(404).send({
		error: `Template index must be between 1 and ${length}`,
	});

export const responseFormatRoutes = (fastify: FastifyInstance) => {
	const plainHandler = async (
		request: TemplateRequest,
		reply: FastifyReply,
	) => {
		const index = resolveTemplateIndex(
			request.params.index,
			randomTexts.length,
		);
		if (index === -1) {
			return templateNotFound(reply, randomTexts.length);
		}

		reply.type("text/plain");
		return randomTexts[index];
	};

	fastify.get("/plain/:index?", { schema: plainSchema }, plainHandler);
	fastify.post("/plain/:index?", { schema: plainSchema }, plainHandler);
	fastify.put("/plain/:index?", { schema: plainSchema }, plainHandler);
	fastify.patch("/plain/:index?", { schema: plainSchema }, plainHandler);
	fastify.delete("/plain/:index?", { schema: plainSchema }, plainHandler);

	const textHandler = async (request: TemplateRequest, reply: FastifyReply) => {
		const index = resolveTemplateIndex(
			request.params.index,
			randomTexts.length,
		);
		if (index === -1) {
			return templateNotFound(reply, randomTexts.length);
		}

		reply.type("text/plain");
		return randomTexts[index];
	};

	fastify.get("/text/:index?", { schema: textSchema }, textHandler);
	fastify.post("/text/:index?", { schema: textSchema }, textHandler);
	fastify.put("/text/:index?", { schema: textSchema }, textHandler);
	fastify.patch("/text/:index?", { schema: textSchema }, textHandler);
	fastify.delete("/text/:index?", { schema: textSchema }, textHandler);

	const htmlHandler = async (request: TemplateRequest, reply: FastifyReply) => {
		const index = resolveTemplateIndex(
			request.params.index,
			randomHtmlContent.length,
		);
		if (index === -1) {
			return templateNotFound(reply, randomHtmlContent.length);
		}

		reply.type("text/html");
		return randomHtmlContent[index];
	};

	fastify.get("/html/:index?", { schema: htmlSchema }, htmlHandler);
	fastify.post("/html/:index?", { schema: htmlSchema }, htmlHandler);
	fastify.put("/html/:index?", { schema: htmlSchema }, htmlHandler);
	fastify.patch("/html/:index?", { schema: htmlSchema }, htmlHandler);
	fastify.delete("/html/:index?", { schema: htmlSchema }, htmlHandler);

	const xmlHandler = async (request: TemplateRequest, reply: FastifyReply) => {
		const index = resolveTemplateIndex(
			request.params.index,
			randomXmlContent.length,
		);
		if (index === -1) {
			return templateNotFound(reply, randomXmlContent.length);
		}

		reply.type("application/xml");
		return randomXmlContent[index];
	};

	fastify.get("/xml/:index?", { schema: xmlSchema }, xmlHandler);
	fastify.post("/xml/:index?", { schema: xmlSchema }, xmlHandler);
	fastify.put("/xml/:index?", { schema: xmlSchema }, xmlHandler);
	fastify.patch("/xml/:index?", { schema: xmlSchema }, xmlHandler);
	fastify.delete("/xml/:index?", { schema: xmlSchema }, xmlHandler);

	const jsonHandler = async (request: TemplateRequest, reply: FastifyReply) => {
		const index = resolveTemplateIndex(
			request.params.index,
			randomJsonContent.length,
		);
		if (index === -1) {
			return templateNotFound(reply, randomJsonContent.length);
		}

		reply.type("application/json");
		return randomJsonContent[index];
	};

	fastify.get("/json/:index?", { schema: jsonSchema }, jsonHandler);
	fastify.post("/json/:index?", { schema: jsonSchema }, jsonHandler);
	fastify.put("/json/:index?", { schema: jsonSchema }, jsonHandler);
	fastify.patch("/json/:index?", { schema: jsonSchema }, jsonHandler);
	fastify.delete("/json/:index?", { schema: jsonSchema }, jsonHandler);

	const denyHandler = async (_request: FastifyRequest, reply: FastifyReply) => {
		const denyMessages = [
			`<!DOCTYPE HTML PUBLIC "-//IETF//DTD HTML 2.0//EN">
<html><head>
<title>403 Forbidden</title>
</head><body>
<h1>Forbidden</h1>
<p>Access denied by robots.txt rules.</p>
<p>The requested resource is disallowed by robots.txt.</p>
</body></html>`,
			`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>403 - Access Denied</title>
</head>
<body>
<h1>403 Forbidden</h1>
<p>This page is blocked by robots.txt rules.</p>
<p>User-agent: *<br>Disallow: ${_request.url}</p>
</body>
</html>`,
			`<!DOCTYPE html>
<html>
<head>
<title>403 - Access Denied</title>
<style>body { font-family: Arial, sans-serif; margin: 40px; }</style>
</head>
<body>
<h2>403 - Access Denied by robots.txt</h2>
<p>The robots.txt file prevents access to this resource.</p>
<hr>
<small>MockHTTP Server</small>
</body>
</html>`,
		];

		const randomIndex = Math.floor(Math.random() * denyMessages.length);
		const html = denyMessages[randomIndex];

		reply.code(403);
		reply.type("text/html");
		return html;
	};

	fastify.get("/deny", { schema: denySchema }, denyHandler);
	fastify.post("/deny", { schema: denySchema }, denyHandler);
	fastify.put("/deny", { schema: denySchema }, denyHandler);
	fastify.patch("/deny", { schema: denySchema }, denyHandler);
	fastify.delete("/deny", { schema: denySchema }, denyHandler);

	const gzipHandler = async (_request: FastifyRequest, reply: FastifyReply) => {
		const sampleData = [
			{
				message: "This is GZip compressed data from MockHTTP",
				timestamp: new Date().toISOString(),
				compression: "gzip",
				originalSize: 0,
				compressedSize: 0,
			},
			{
				title: "Sample Document",
				content:
					"Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(
						50,
					),
				metadata: {
					author: "MockHTTP Server",
					format: "gzip",
					version: "1.0",
				},
			},
			{
				data: Array.from({ length: 100 }, (_, i) => ({
					id: i + 1,
					value: `Item ${i + 1}`,
					description: `This is item number ${i + 1} in the dataset`,
				})),
				info: "Large dataset compressed with GZip",
			},
		];

		const randomIndex = Math.floor(Math.random() * sampleData.length);
		const data = sampleData[randomIndex];
		const jsonString = JSON.stringify(data);

		// Update size information if present
		if (data.originalSize !== undefined) {
			data.originalSize = Buffer.byteLength(jsonString);
		}

		// Compress the data using gzip
		const compressed = gzipSync(jsonString);

		// Update compressed size if present
		if (data.compressedSize !== undefined) {
			const updatedData = { ...data, compressedSize: compressed.length };
			const updatedJsonString = JSON.stringify(updatedData);
			const updatedCompressed = gzipSync(updatedJsonString);
			reply.header("Content-Encoding", "gzip");
			reply.header("Content-Type", "application/json");
			reply.type("application/octet-stream");
			return updatedCompressed;
		}

		reply.header("Content-Encoding", "gzip");
		reply.header("Content-Type", "application/json");
		reply.type("application/octet-stream");
		return compressed;
	};

	fastify.get("/gzip", { schema: gzipSchema }, gzipHandler);
	fastify.post("/gzip", { schema: gzipSchema }, gzipHandler);
	fastify.put("/gzip", { schema: gzipSchema }, gzipHandler);
	fastify.patch("/gzip", { schema: gzipSchema }, gzipHandler);
	fastify.delete("/gzip", { schema: gzipSchema }, gzipHandler);

	const deflateHandler = async (
		_request: FastifyRequest,
		reply: FastifyReply,
	) => {
		const sampleData = [
			{
				message: "This is Deflate compressed data from MockHTTP",
				timestamp: new Date().toISOString(),
				compression: "deflate",
				originalSize: 0,
				compressedSize: 0,
			},
			{
				title: "Deflate Compressed Document",
				content: "The deflate algorithm is used for compression. ".repeat(40),
				details: {
					algorithm: "DEFLATE",
					method: "zlib deflate",
					server: "MockHTTP",
				},
			},
			{
				items: Array.from({ length: 50 }, (_, i) => ({
					index: i,
					name: `Entry ${i}`,
					data: `This is test data for entry number ${i}`,
					timestamp: new Date(Date.now() - i * 1000000).toISOString(),
				})),
				metadata: {
					compression: "deflate",
					count: 50,
				},
			},
		];

		const randomIndex = Math.floor(Math.random() * sampleData.length);
		const data = sampleData[randomIndex];
		const jsonString = JSON.stringify(data);

		// Update size information if present
		if (data.originalSize !== undefined) {
			data.originalSize = Buffer.byteLength(jsonString);
		}

		// Compress the data using deflate
		const compressed = deflateSync(jsonString);

		// Update compressed size if present
		if (data.compressedSize !== undefined) {
			const updatedData = { ...data, compressedSize: compressed.length };
			const updatedJsonString = JSON.stringify(updatedData);
			const updatedCompressed = deflateSync(updatedJsonString);
			reply.header("Content-Encoding", "deflate");
			reply.header("Content-Type", "application/json");
			reply.type("application/octet-stream");
			return updatedCompressed;
		}

		reply.header("Content-Encoding", "deflate");
		reply.header("Content-Type", "application/json");
		reply.type("application/octet-stream");
		return compressed;
	};

	fastify.get("/deflate", { schema: deflateSchema }, deflateHandler);
	fastify.post("/deflate", { schema: deflateSchema }, deflateHandler);
	fastify.put("/deflate", { schema: deflateSchema }, deflateHandler);
	fastify.patch("/deflate", { schema: deflateSchema }, deflateHandler);
	fastify.delete("/deflate", { schema: deflateSchema }, deflateHandler);

	const brotliHandler = async (
		_request: FastifyRequest,
		reply: FastifyReply,
	) => {
		const sampleData = [
			{
				message: "This is Brotli compressed data from MockHTTP",
				timestamp: new Date().toISOString(),
				compression: "br",
				algorithm: "Brotli",
				originalSize: 0,
				compressedSize: 0,
			},
			{
				title: "Brotli Compression Example",
				description:
					"Brotli is a generic-purpose lossless compression algorithm that compresses data using a combination of a modern variant of the LZ77 algorithm, Huffman coding and 2nd order context modeling.",
				content:
					"Brotli compression typically achieves 20-26% better compression ratios than gzip. ".repeat(
						10,
					),
				metadata: {
					encoding: "br",
					quality: 11,
					server: "MockHTTP",
				},
			},
			{
				benchmark: {
					title: "Compression Benchmark Data",
					results: Array.from({ length: 75 }, (_, i) => ({
						id: `test-${i}`,
						name: `Benchmark Test ${i}`,
						value: Math.random() * 1000,
						unit: "ms",
						timestamp: new Date(Date.now() - i * 60000).toISOString(),
					})),
					summary: {
						compression: "brotli",
						totalTests: 75,
						encoding: "br",
					},
				},
			},
		];

		const randomIndex = Math.floor(Math.random() * sampleData.length);
		const data = sampleData[randomIndex];
		const jsonString = JSON.stringify(data);

		// Update size information if present
		if (data.originalSize !== undefined) {
			data.originalSize = Buffer.byteLength(jsonString);
		}

		// Compress the data using brotli
		const compressed = brotliCompressSync(jsonString);

		// Update compressed size if present
		if (data.compressedSize !== undefined) {
			const updatedData = { ...data, compressedSize: compressed.length };
			const updatedJsonString = JSON.stringify(updatedData);
			const updatedCompressed = brotliCompressSync(updatedJsonString);
			reply.header("Content-Encoding", "br");
			reply.header("Content-Type", "application/json");
			reply.type("application/octet-stream");
			return updatedCompressed;
		}

		reply.header("Content-Encoding", "br");
		reply.header("Content-Type", "application/json");
		reply.type("application/octet-stream");
		return compressed;
	};

	fastify.get("/brotli", { schema: brotliSchema }, brotliHandler);
	fastify.post("/brotli", { schema: brotliSchema }, brotliHandler);
	fastify.put("/brotli", { schema: brotliSchema }, brotliHandler);
	fastify.patch("/brotli", { schema: brotliSchema }, brotliHandler);
	fastify.delete("/brotli", { schema: brotliSchema }, brotliHandler);
};
