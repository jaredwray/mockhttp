import type {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
	FastifySchema,
} from "fastify";

const plainSchema: FastifySchema = {
	description: "Returns random plain text content",
	tags: ["Response Formats"],
	response: {
		200: {
			type: "string",
			description: "Random plain text content",
		},
	},
};

const textSchema: FastifySchema = {
	description: "Returns random text content",
	tags: ["Response Formats"],
	response: {
		200: {
			type: "string",
			description: "Random text content",
		},
	},
};

const htmlSchema: FastifySchema = {
	description: "Returns random HTML content",
	tags: ["Response Formats"],
	response: {
		200: {
			type: "string",
			description: "Random HTML content",
		},
	},
};

const xmlSchema: FastifySchema = {
	description: "Returns random XML content",
	tags: ["Response Formats"],
	response: {
		200: {
			type: "string",
			description: "Random XML content",
		},
	},
};

const jsonSchema: FastifySchema = {
	description: "Returns random JSON content",
	tags: ["Response Formats"],
	response: {
		200: {
			type: "object",
			description: "Random JSON content",
			additionalProperties: true,
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
    <timestamp>${new Date().toISOString()}</timestamp>
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
            <pubDate>${new Date().toUTCString()}</pubDate>
        </item>
    </channel>
</rss>`,
];

const randomJsonContent = [
	() => ({
		message: "Hello from MockHTTP",
		timestamp: new Date().toISOString(),
		status: "success",
		code: 200,
	}),
	() => ({
		user: {
			id: 1,
			name: "John Doe",
			email: "john@example.com",
			role: "admin",
			createdAt: "2024-01-15T10:30:00Z",
		},
		permissions: ["read", "write", "delete"],
	}),
	() => ({
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
	}),
	() => ({
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
	}),
	() => ({
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
	}),
];

export const plainRoute = (fastify: FastifyInstance) => {
	const plainHandler = async (
		_request: FastifyRequest,
		reply: FastifyReply,
	) => {
		const randomIndex = Math.floor(Math.random() * randomTexts.length);
		const text = randomTexts[randomIndex];

		reply.type("text/plain");
		return text;
	};

	fastify.get("/plain", { schema: plainSchema }, plainHandler);
	fastify.post("/plain", { schema: plainSchema }, plainHandler);
	fastify.put("/plain", { schema: plainSchema }, plainHandler);
	fastify.patch("/plain", { schema: plainSchema }, plainHandler);
	fastify.delete("/plain", { schema: plainSchema }, plainHandler);

	const textHandler = async (_request: FastifyRequest, reply: FastifyReply) => {
		const randomIndex = Math.floor(Math.random() * randomTexts.length);
		const text = randomTexts[randomIndex];

		reply.type("text/plain");
		return text;
	};

	fastify.get("/text", { schema: textSchema }, textHandler);
	fastify.post("/text", { schema: textSchema }, textHandler);
	fastify.put("/text", { schema: textSchema }, textHandler);
	fastify.patch("/text", { schema: textSchema }, textHandler);
	fastify.delete("/text", { schema: textSchema }, textHandler);

	const htmlHandler = async (_request: FastifyRequest, reply: FastifyReply) => {
		const randomIndex = Math.floor(Math.random() * randomHtmlContent.length);
		const html = randomHtmlContent[randomIndex];

		reply.type("text/html");
		return html;
	};

	fastify.get("/html", { schema: htmlSchema }, htmlHandler);
	fastify.post("/html", { schema: htmlSchema }, htmlHandler);
	fastify.put("/html", { schema: htmlSchema }, htmlHandler);
	fastify.patch("/html", { schema: htmlSchema }, htmlHandler);
	fastify.delete("/html", { schema: htmlSchema }, htmlHandler);

	const xmlHandler = async (_request: FastifyRequest, reply: FastifyReply) => {
		const randomIndex = Math.floor(Math.random() * randomXmlContent.length);
		const xml = randomXmlContent[randomIndex];

		reply.type("application/xml");
		return xml;
	};

	fastify.get("/xml", { schema: xmlSchema }, xmlHandler);
	fastify.post("/xml", { schema: xmlSchema }, xmlHandler);
	fastify.put("/xml", { schema: xmlSchema }, xmlHandler);
	fastify.patch("/xml", { schema: xmlSchema }, xmlHandler);
	fastify.delete("/xml", { schema: xmlSchema }, xmlHandler);

	const jsonHandler = async (_request: FastifyRequest, reply: FastifyReply) => {
		const randomIndex = Math.floor(Math.random() * randomJsonContent.length);
		const jsonGenerator = randomJsonContent[randomIndex];
		const json = jsonGenerator();

		reply.type("application/json");
		return json;
	};

	fastify.get("/json", { schema: jsonSchema }, jsonHandler);
	fastify.post("/json", { schema: jsonSchema }, jsonHandler);
	fastify.put("/json", { schema: jsonSchema }, jsonHandler);
	fastify.patch("/json", { schema: jsonSchema }, jsonHandler);
	fastify.delete("/json", { schema: jsonSchema }, jsonHandler);
};
