import type { FastifyInstance, FastifyRequest, FastifySchema } from "fastify";

const plainSchema: FastifySchema = {
	description: "Returns random plain text content",
	tags: ["Response Inspection"],
	// @ts-expect-error
	response: {
		200: {
			type: "string",
			description: "Random plain text content",
		},
	},
};

const textSchema: FastifySchema = {
	description: "Returns random text content",
	tags: ["Response Inspection"],
	// @ts-expect-error
	response: {
		200: {
			type: "string",
			description: "Random text content",
		},
	},
};

const htmlSchema: FastifySchema = {
	description: "Returns random HTML content",
	tags: ["Response Inspection"],
	// @ts-expect-error
	response: {
		200: {
			type: "string",
			description: "Random HTML content",
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

export const plainRoute = (fastify: FastifyInstance) => {
	// @ts-expect-error
	fastify.get(
		"/plain",
		{ schema: plainSchema },
		// biome-ignore lint/suspicious/noExplicitAny: reply
		async (_request: FastifyRequest, reply: any) => {
			const randomIndex = Math.floor(Math.random() * randomTexts.length);
			const text = randomTexts[randomIndex];

			reply.type("text/plain");
			return text;
		},
	);

	// @ts-expect-error
	fastify.get(
		"/text",
		{ schema: textSchema },
		// biome-ignore lint/suspicious/noExplicitAny: reply
		async (_request: FastifyRequest, reply: any) => {
			const randomIndex = Math.floor(Math.random() * randomTexts.length);
			const text = randomTexts[randomIndex];

			reply.type("text/plain");
			return text;
		},
	);

	// @ts-expect-error
	fastify.get(
		"/html",
		{ schema: htmlSchema },
		// biome-ignore lint/suspicious/noExplicitAny: reply
		async (_request: FastifyRequest, reply: any) => {
			const randomIndex = Math.floor(Math.random() * randomHtmlContent.length);
			const html = randomHtmlContent[randomIndex];

			reply.type("text/html");
			return html;
		},
	);
};
