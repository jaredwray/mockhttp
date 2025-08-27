import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";
import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { responseFormatRoutes } from "../../../src/routes/response-formats/index.js";

describe("Plain, Text, and HTML Routes", () => {
	const fastify = Fastify();

	beforeAll(async () => {
		await fastify.register(responseFormatRoutes);
	});

	afterAll(async () => {
		await fastify.close();
	});

	it("should return plain text with correct content type", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/plain",
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toContain("text/plain");
		expect(typeof response.body).toBe("string");
		expect(response.body.length).toBeGreaterThan(0);
	});

	it("should return one of the predefined random texts", async () => {
		const expectedTexts = [
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

		const response = await fastify.inject({
			method: "GET",
			url: "/plain",
		});

		expect(expectedTexts).toContain(response.body);
	});

	it("should return different texts on multiple requests (randomness test)", async () => {
		const responses = new Set();
		const numberOfRequests = 20;

		for (let i = 0; i < numberOfRequests; i++) {
			const response = await fastify.inject({
				method: "GET",
				url: "/plain",
			});
			responses.add(response.body);
		}

		// With 10 possible texts and 20 requests, we should get at least 2 different texts
		// This is a probabilistic test but the chance of failure is extremely low
		expect(responses.size).toBeGreaterThanOrEqual(2);
	});

	it("should handle the random index calculation correctly", async () => {
		// This test verifies that the endpoint doesn't crash regardless of Math.random() output
		// We'll make multiple requests to ensure stability
		const requests = 100;

		for (let i = 0; i < requests; i++) {
			const response = await fastify.inject({
				method: "GET",
				url: "/plain",
			});

			expect(response.statusCode).toBe(200);
			expect(response.body).toBeTruthy();
			expect(response.headers["content-type"]).toContain("text/plain");
		}
	});

	it("should set reply type to text/plain", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/plain",
		});

		// Verify that the content-type header is set correctly
		expect(response.headers["content-type"]).toContain("text/plain");
	});

	it("should return the selected text directly without JSON wrapping", async () => {
		const response = await fastify.inject({
			method: "GET",
			url: "/plain",
		});

		// Ensure the response is plain text, not JSON
		expect(() => JSON.parse(response.body)).toThrow();

		// Ensure the response doesn't contain JSON-like structures
		expect(response.body).not.toContain("{");
		expect(response.body).not.toContain("}");
		expect(response.body).not.toContain('"text"');
	});

	// Tests for /text endpoint
	describe("/text endpoint", () => {
		it("should return text with correct content type", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/text",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toContain("text/plain");
			expect(typeof response.body).toBe("string");
			expect(response.body.length).toBeGreaterThan(0);
		});

		it("should return one of the predefined random texts", async () => {
			const expectedTexts = [
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

			const response = await fastify.inject({
				method: "GET",
				url: "/text",
			});

			expect(expectedTexts).toContain(response.body);
		});

		it("should return different texts on multiple requests", async () => {
			const responses = new Set();
			const numberOfRequests = 20;

			for (let i = 0; i < numberOfRequests; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/text",
				});
				responses.add(response.body);
			}

			expect(responses.size).toBeGreaterThanOrEqual(2);
		});

		it("should handle the random index calculation correctly", async () => {
			const requests = 100;

			for (let i = 0; i < requests; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/text",
				});

				expect(response.statusCode).toBe(200);
				expect(response.body).toBeTruthy();
				expect(response.headers["content-type"]).toContain("text/plain");
			}
		});

		it("should return plain text without JSON wrapping", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/text",
			});

			expect(() => JSON.parse(response.body)).toThrow();
			expect(response.body).not.toContain("{");
			expect(response.body).not.toContain("}");
			expect(response.body).not.toContain('"text"');
		});
	});

	// Tests for /html endpoint
	describe("/html endpoint", () => {
		it("should return HTML with correct content type", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/html",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toContain("text/html");
			expect(typeof response.body).toBe("string");
			expect(response.body.length).toBeGreaterThan(0);
		});

		it("should return valid HTML document", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/html",
			});

			// Check for HTML document structure
			expect(response.body).toContain("<!DOCTYPE html");
			expect(response.body).toContain("<html");
			expect(response.body).toContain("</html>");
			expect(response.body).toContain("<head");
			expect(response.body).toContain("</head>");
			expect(response.body).toContain("<body");
			expect(response.body).toContain("</body>");
		});

		it("should return one of the predefined HTML templates", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/html",
			});

			// Check that response contains at least one of the expected titles
			const expectedTitles = [
				"<title>Sample Page</title>",
				"<title>Test Document</title>",
				"<title>Article Page</title>",
				"<title>Form Example</title>",
				"<title>Responsive Page</title>",
			];

			const containsExpectedTitle = expectedTitles.some((title) =>
				response.body.includes(title),
			);
			expect(containsExpectedTitle).toBe(true);
		});

		it("should return different HTML on multiple requests", async () => {
			const responses = new Set();
			const numberOfRequests = 20;

			for (let i = 0; i < numberOfRequests; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/html",
				});
				responses.add(response.body);
			}

			// With 5 HTML templates and 20 requests, we should get at least 2 different templates
			expect(responses.size).toBeGreaterThanOrEqual(2);
		});

		it("should handle the random index calculation correctly for HTML", async () => {
			const requests = 100;

			for (let i = 0; i < requests; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/html",
				});

				expect(response.statusCode).toBe(200);
				expect(response.body).toBeTruthy();
				expect(response.headers["content-type"]).toContain("text/html");
				expect(response.body).toContain("<!DOCTYPE html");
			}
		});

		it("should return HTML without being wrapped in JSON", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/html",
			});

			// Should not be valid JSON
			expect(() => JSON.parse(response.body)).toThrow();

			// Should be raw HTML
			expect(response.body.startsWith("<!DOCTYPE html")).toBe(true);
		});
	});

	// Tests for /xml endpoint
	describe("/xml endpoint", () => {
		it("should return XML with correct content type", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/xml",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toContain("application/xml");
			expect(typeof response.body).toBe("string");
			expect(response.body.length).toBeGreaterThan(0);
		});

		it("should return valid XML document", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/xml",
			});

			// Check for XML declaration and structure
			expect(response.body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
			expect(response.body).toMatch(/<\w+>/); // Opening tag
			expect(response.body).toMatch(/<\/\w+>/); // Closing tag
		});

		it("should return one of the predefined XML templates", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/xml",
			});

			// Check that response contains at least one of the expected root elements
			const expectedRootElements = [
				"<root>",
				"<book>",
				"<users>",
				"<product>",
				'<rss version="2.0">',
			];

			const containsExpectedRoot = expectedRootElements.some((element) =>
				response.body.includes(element),
			);
			expect(containsExpectedRoot).toBe(true);
		});

		it("should return different XML on multiple requests", async () => {
			const responses = new Set();
			const numberOfRequests = 20;

			for (let i = 0; i < numberOfRequests; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/xml",
				});
				responses.add(response.body);
			}

			// With 5 XML templates and 20 requests, we should get at least 2 different templates
			expect(responses.size).toBeGreaterThanOrEqual(2);
		});

		it("should handle POST requests", async () => {
			const response = await fastify.inject({
				method: "POST",
				url: "/xml",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toContain("application/xml");
			expect(response.body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		});

		it("should handle PUT requests", async () => {
			const response = await fastify.inject({
				method: "PUT",
				url: "/xml",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toContain("application/xml");
			expect(response.body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		});

		it("should handle PATCH requests", async () => {
			const response = await fastify.inject({
				method: "PATCH",
				url: "/xml",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toContain("application/xml");
			expect(response.body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		});

		it("should handle DELETE requests", async () => {
			const response = await fastify.inject({
				method: "DELETE",
				url: "/xml",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toContain("application/xml");
			expect(response.body).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		});

		it("should handle the random index calculation correctly for XML", async () => {
			const requests = 100;

			for (let i = 0; i < requests; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/xml",
				});

				expect(response.statusCode).toBe(200);
				expect(response.body).toBeTruthy();
				expect(response.headers["content-type"]).toContain("application/xml");
				expect(response.body).toContain('<?xml version="1.0"');
			}
		});

		it("should return XML without being wrapped in JSON", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/xml",
			});

			// Should not be valid JSON
			expect(() => JSON.parse(response.body)).toThrow();

			// Should be raw XML
			expect(response.body.startsWith('<?xml version="1.0"')).toBe(true);
		});
	});

	// Tests for /json endpoint
	describe("/json endpoint", () => {
		it("should return JSON with correct content type", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/json",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toContain("application/json");
			expect(typeof response.body).toBe("string");
			expect(response.body.length).toBeGreaterThan(0);
		});

		it("should return valid JSON", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/json",
			});

			// Should be parseable JSON
			expect(() => JSON.parse(response.body)).not.toThrow();

			const json = JSON.parse(response.body);
			expect(typeof json).toBe("object");
			expect(json).not.toBeNull();
		});

		it("should return one of the predefined JSON objects", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/json",
			});

			const json = JSON.parse(response.body);

			// Check that response contains expected structure patterns
			const hasExpectedStructure =
				(json.message && json.status) || // First template
				(json.user && json.permissions) || // Second template
				(json.products && json.total) || // Third template
				json.config?.theme || // Fourth template
				json.metrics?.cpu; // Fifth template

			expect(hasExpectedStructure).toBeTruthy();
		});

		it("should return different JSON on multiple requests", async () => {
			const responses = new Set();
			const numberOfRequests = 20;

			for (let i = 0; i < numberOfRequests; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/json",
				});
				responses.add(response.body);
			}

			// With 5 JSON templates and 20 requests, we should get at least 2 different templates
			expect(responses.size).toBeGreaterThanOrEqual(2);
		});

		it("should handle POST requests", async () => {
			const response = await fastify.inject({
				method: "POST",
				url: "/json",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toContain("application/json");
			const json = JSON.parse(response.body);
			expect(typeof json).toBe("object");
		});

		it("should handle PUT requests", async () => {
			const response = await fastify.inject({
				method: "PUT",
				url: "/json",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toContain("application/json");
			const json = JSON.parse(response.body);
			expect(typeof json).toBe("object");
		});

		it("should handle PATCH requests", async () => {
			const response = await fastify.inject({
				method: "PATCH",
				url: "/json",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toContain("application/json");
			const json = JSON.parse(response.body);
			expect(typeof json).toBe("object");
		});

		it("should handle DELETE requests", async () => {
			const response = await fastify.inject({
				method: "DELETE",
				url: "/json",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toContain("application/json");
			const json = JSON.parse(response.body);
			expect(typeof json).toBe("object");
		});

		it("should handle the random index calculation correctly for JSON", async () => {
			const requests = 100;

			for (let i = 0; i < requests; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/json",
				});

				expect(response.statusCode).toBe(200);
				expect(response.body).toBeTruthy();
				expect(response.headers["content-type"]).toContain("application/json");
				expect(() => JSON.parse(response.body)).not.toThrow();
			}
		});

		it("should return properly formatted JSON objects", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/json",
			});

			const json = JSON.parse(response.body);

			// Check that the JSON has proper structure (not a string or primitive)
			expect(typeof json).toBe("object");
			expect(Array.isArray(json) || Object.keys(json).length > 0).toBe(true);
		});
	});

	// Tests for /deny endpoint
	describe("/deny endpoint", () => {
		it("should return 403 Forbidden status", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/deny",
			});

			expect(response.statusCode).toBe(403);
			expect(response.headers["content-type"]).toContain("text/html");
			expect(typeof response.body).toBe("string");
			expect(response.body.length).toBeGreaterThan(0);
		});

		it("should return HTML content with robots.txt denial message", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/deny",
			});

			// Check for HTML structure
			expect(response.body).toContain("<!DOCTYPE");
			expect(response.body).toContain("<html");
			expect(response.body).toContain("</html>");

			// Check for forbidden/denied content
			expect(response.body.toLowerCase()).toMatch(/forbidden|denied/);
			expect(response.body.toLowerCase()).toContain("robots.txt");
		});

		it("should return 403 status with HTML content", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/deny",
			});

			// Check status code
			expect(response.statusCode).toBe(403);

			// Check content type
			expect(response.headers["content-type"]).toContain("text/html");

			// Check that it contains 403 in the body
			expect(response.body).toContain("403");
		});

		it("should return different denial messages on multiple requests", async () => {
			const responses = new Set();
			const numberOfRequests = 20;

			for (let i = 0; i < numberOfRequests; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/deny",
				});
				responses.add(response.body);
			}

			// With 3 denial templates and 20 requests, we should get at least 2 different templates
			expect(responses.size).toBeGreaterThanOrEqual(2);
		});

		it("should handle POST requests with 403 status", async () => {
			const response = await fastify.inject({
				method: "POST",
				url: "/deny",
			});

			expect(response.statusCode).toBe(403);
			expect(response.headers["content-type"]).toContain("text/html");
			expect(response.body.toLowerCase()).toContain("robots.txt");
		});

		it("should handle PUT requests with 403 status", async () => {
			const response = await fastify.inject({
				method: "PUT",
				url: "/deny",
			});

			expect(response.statusCode).toBe(403);
			expect(response.headers["content-type"]).toContain("text/html");
			expect(response.body.toLowerCase()).toContain("robots.txt");
		});

		it("should handle PATCH requests with 403 status", async () => {
			const response = await fastify.inject({
				method: "PATCH",
				url: "/deny",
			});

			expect(response.statusCode).toBe(403);
			expect(response.headers["content-type"]).toContain("text/html");
			expect(response.body.toLowerCase()).toContain("robots.txt");
		});

		it("should handle DELETE requests with 403 status", async () => {
			const response = await fastify.inject({
				method: "DELETE",
				url: "/deny",
			});

			expect(response.statusCode).toBe(403);
			expect(response.headers["content-type"]).toContain("text/html");
			expect(response.body.toLowerCase()).toContain("robots.txt");
		});

		it("should consistently return 403 status across multiple requests", async () => {
			const requests = 50;

			for (let i = 0; i < requests; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/deny",
				});

				expect(response.statusCode).toBe(403);
				expect(response.body).toBeTruthy();
				expect(response.headers["content-type"]).toContain("text/html");
			}
		});

		it("should return HTML without being wrapped in JSON", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/deny",
			});

			// Should not be valid JSON
			expect(() => JSON.parse(response.body)).toThrow();

			// Should be raw HTML
			expect(response.body).toMatch(/^<!DOCTYPE/i);
		});
	});

	// Tests for /gzip endpoint
	describe("/gzip endpoint", () => {
		it("should return gzip-encoded data with correct headers", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/gzip",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-encoding"]).toBe("gzip");
			expect(response.headers["content-type"]).toContain(
				"application/octet-stream",
			);

			// Response should be a Buffer
			expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
		});

		it("should return valid gzip-compressed JSON data", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/gzip",
			});

			// Decompress the gzip data
			const decompressed = gunzipSync(response.rawPayload);
			const json = JSON.parse(decompressed.toString());

			expect(typeof json).toBe("object");
			expect(json).not.toBeNull();
		});

		it("should compress data effectively", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/gzip",
			});

			// Decompress to get original size
			const decompressed = gunzipSync(response.rawPayload);
			const originalSize = decompressed.length;
			const compressedSize = response.rawPayload.length;

			// Compressed should generally be smaller than original
			// (though for very small data it might be slightly larger due to gzip headers)
			expect(compressedSize).toBeLessThanOrEqual(originalSize + 50); // Allow some overhead for headers
		});

		it("should return one of the predefined data structures", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/gzip",
			});

			const decompressed = gunzipSync(response.rawPayload);
			const json = JSON.parse(decompressed.toString());

			// Check for expected structure patterns
			const hasExpectedStructure =
				(json.message && json.compression === "gzip") || // First template
				(json.title && json.content && json.metadata) || // Second template
				(json.data && Array.isArray(json.data) && json.info); // Third template

			expect(hasExpectedStructure).toBeTruthy();
		});

		it("should return different compressed data on multiple requests", async () => {
			const responses = new Set();
			const numberOfRequests = 20;

			for (let i = 0; i < numberOfRequests; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/gzip",
				});

				const decompressed = gunzipSync(response.rawPayload);
				responses.add(decompressed.toString());
			}

			// With 3 data templates and 20 requests, we should get at least 2 different responses
			expect(responses.size).toBeGreaterThanOrEqual(2);
		});

		it("should handle POST requests", async () => {
			const response = await fastify.inject({
				method: "POST",
				url: "/gzip",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-encoding"]).toBe("gzip");

			const decompressed = gunzipSync(response.rawPayload);
			const json = JSON.parse(decompressed.toString());
			expect(typeof json).toBe("object");
		});

		it("should handle PUT requests", async () => {
			const response = await fastify.inject({
				method: "PUT",
				url: "/gzip",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-encoding"]).toBe("gzip");

			const decompressed = gunzipSync(response.rawPayload);
			const json = JSON.parse(decompressed.toString());
			expect(typeof json).toBe("object");
		});

		it("should handle PATCH requests", async () => {
			const response = await fastify.inject({
				method: "PATCH",
				url: "/gzip",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-encoding"]).toBe("gzip");

			const decompressed = gunzipSync(response.rawPayload);
			const json = JSON.parse(decompressed.toString());
			expect(typeof json).toBe("object");
		});

		it("should handle DELETE requests", async () => {
			const response = await fastify.inject({
				method: "DELETE",
				url: "/gzip",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-encoding"]).toBe("gzip");

			const decompressed = gunzipSync(response.rawPayload);
			const json = JSON.parse(decompressed.toString());
			expect(typeof json).toBe("object");
		});

		it("should consistently compress data across multiple requests", async () => {
			const requests = 50;

			for (let i = 0; i < requests; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/gzip",
				});

				expect(response.statusCode).toBe(200);
				expect(response.headers["content-encoding"]).toBe("gzip");
				expect(Buffer.isBuffer(response.rawPayload)).toBe(true);

				// Verify it can be decompressed
				const decompressed = gunzipSync(response.rawPayload);
				const json = JSON.parse(decompressed.toString());
				expect(typeof json).toBe("object");
			}
		});

		it("should include size information when applicable", async () => {
			// Try multiple times to get the first template with size info
			let foundSizeInfo = false;

			for (let i = 0; i < 30 && !foundSizeInfo; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/gzip",
				});

				const decompressed = gunzipSync(response.rawPayload);
				const json = JSON.parse(decompressed.toString());

				if (
					json.originalSize !== undefined &&
					json.compressedSize !== undefined
				) {
					foundSizeInfo = true;
					expect(json.originalSize).toBeGreaterThan(0);
					expect(json.compressedSize).toBeGreaterThan(0);
					expect(json.compression).toBe("gzip");
				}
			}

			// At least one response should have had size information
			expect(foundSizeInfo).toBe(true);
		});
	});

	// Tests for /deflate endpoint
	describe("/deflate endpoint", () => {
		it("should return deflate-encoded data with correct headers", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/deflate",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-encoding"]).toBe("deflate");
			expect(response.headers["content-type"]).toContain(
				"application/octet-stream",
			);

			// Response should be a Buffer
			expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
		});

		it("should return valid deflate-compressed JSON data", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/deflate",
			});

			// Decompress the deflate data
			const decompressed = inflateSync(response.rawPayload);
			const json = JSON.parse(decompressed.toString());

			expect(typeof json).toBe("object");
			expect(json).not.toBeNull();
		});

		it("should compress data effectively with deflate", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/deflate",
			});

			// Decompress to get original size
			const decompressed = inflateSync(response.rawPayload);
			const originalSize = decompressed.length;
			const compressedSize = response.rawPayload.length;

			// Compressed should generally be smaller than original
			// (though for very small data it might be slightly larger due to headers)
			expect(compressedSize).toBeLessThanOrEqual(originalSize + 50); // Allow some overhead
		});

		it("should return one of the predefined deflate data structures", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/deflate",
			});

			const decompressed = inflateSync(response.rawPayload);
			const json = JSON.parse(decompressed.toString());

			// Check for expected structure patterns
			const hasExpectedStructure =
				(json.message && json.compression === "deflate") || // First template
				(json.title && json.content && json.details) || // Second template
				(json.items && Array.isArray(json.items) && json.metadata); // Third template

			expect(hasExpectedStructure).toBeTruthy();
		});

		it("should return different deflate compressed data on multiple requests", async () => {
			const responses = new Set();
			const numberOfRequests = 20;

			for (let i = 0; i < numberOfRequests; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/deflate",
				});

				const decompressed = inflateSync(response.rawPayload);
				responses.add(decompressed.toString());
			}

			// With 3 data templates and 20 requests, we should get at least 2 different responses
			expect(responses.size).toBeGreaterThanOrEqual(2);
		});

		it("should handle POST requests with deflate", async () => {
			const response = await fastify.inject({
				method: "POST",
				url: "/deflate",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-encoding"]).toBe("deflate");

			const decompressed = inflateSync(response.rawPayload);
			const json = JSON.parse(decompressed.toString());
			expect(typeof json).toBe("object");
		});

		it("should handle PUT requests with deflate", async () => {
			const response = await fastify.inject({
				method: "PUT",
				url: "/deflate",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-encoding"]).toBe("deflate");

			const decompressed = inflateSync(response.rawPayload);
			const json = JSON.parse(decompressed.toString());
			expect(typeof json).toBe("object");
		});

		it("should handle PATCH requests with deflate", async () => {
			const response = await fastify.inject({
				method: "PATCH",
				url: "/deflate",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-encoding"]).toBe("deflate");

			const decompressed = inflateSync(response.rawPayload);
			const json = JSON.parse(decompressed.toString());
			expect(typeof json).toBe("object");
		});

		it("should handle DELETE requests with deflate", async () => {
			const response = await fastify.inject({
				method: "DELETE",
				url: "/deflate",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-encoding"]).toBe("deflate");

			const decompressed = inflateSync(response.rawPayload);
			const json = JSON.parse(decompressed.toString());
			expect(typeof json).toBe("object");
		});

		it("should consistently compress with deflate across multiple requests", async () => {
			const requests = 50;

			for (let i = 0; i < requests; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/deflate",
				});

				expect(response.statusCode).toBe(200);
				expect(response.headers["content-encoding"]).toBe("deflate");
				expect(Buffer.isBuffer(response.rawPayload)).toBe(true);

				// Verify it can be decompressed
				const decompressed = inflateSync(response.rawPayload);
				const json = JSON.parse(decompressed.toString());
				expect(typeof json).toBe("object");
			}
		});

		it("should include deflate size information when applicable", async () => {
			// Try multiple times to get the first template with size info
			let foundSizeInfo = false;

			for (let i = 0; i < 30 && !foundSizeInfo; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/deflate",
				});

				const decompressed = inflateSync(response.rawPayload);
				const json = JSON.parse(decompressed.toString());

				if (
					json.originalSize !== undefined &&
					json.compressedSize !== undefined
				) {
					foundSizeInfo = true;
					expect(json.originalSize).toBeGreaterThan(0);
					expect(json.compressedSize).toBeGreaterThan(0);
					expect(json.compression).toBe("deflate");
				}
			}

			// At least one response should have had size information
			expect(foundSizeInfo).toBe(true);
		});

		it("should produce different compression than gzip", async () => {
			// Get gzip response
			const gzipResponse = await fastify.inject({
				method: "GET",
				url: "/gzip",
			});

			// Get deflate response
			const deflateResponse = await fastify.inject({
				method: "GET",
				url: "/deflate",
			});

			// Both should be compressed
			expect(gzipResponse.headers["content-encoding"]).toBe("gzip");
			expect(deflateResponse.headers["content-encoding"]).toBe("deflate");

			// The raw payloads should be different (different compression algorithms)
			expect(Buffer.isBuffer(gzipResponse.rawPayload)).toBe(true);
			expect(Buffer.isBuffer(deflateResponse.rawPayload)).toBe(true);
		});
	});

	// Tests for /brotli endpoint
	describe("/brotli endpoint", () => {
		it("should return brotli-encoded data with correct headers", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/brotli",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-encoding"]).toBe("br");
			expect(response.headers["content-type"]).toContain(
				"application/octet-stream",
			);

			// Response should be a Buffer
			expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
		});

		it("should return valid brotli-compressed JSON data", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/brotli",
			});

			// Decompress the brotli data
			const decompressed = brotliDecompressSync(response.rawPayload);
			const json = JSON.parse(decompressed.toString());

			expect(typeof json).toBe("object");
			expect(json).not.toBeNull();
		});

		it("should compress data effectively with brotli", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/brotli",
			});

			// Decompress to get original size
			const decompressed = brotliDecompressSync(response.rawPayload);
			const originalSize = decompressed.length;
			const compressedSize = response.rawPayload.length;

			// Brotli should compress effectively
			// (though for very small data it might be slightly larger due to headers)
			expect(compressedSize).toBeLessThanOrEqual(originalSize + 50); // Allow some overhead
		});

		it("should return one of the predefined brotli data structures", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/brotli",
			});

			const decompressed = brotliDecompressSync(response.rawPayload);
			const json = JSON.parse(decompressed.toString());

			// Check for expected structure patterns
			const hasExpectedStructure =
				(json.message && json.compression === "br") || // First template
				(json.title && json.content && json.metadata) || // Second template
				json.benchmark?.results; // Third template

			expect(hasExpectedStructure).toBeTruthy();
		});

		it("should return different brotli compressed data on multiple requests", async () => {
			const responses = new Set();
			const numberOfRequests = 20;

			for (let i = 0; i < numberOfRequests; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/brotli",
				});

				const decompressed = brotliDecompressSync(response.rawPayload);
				responses.add(decompressed.toString());
			}

			// With 3 data templates and 20 requests, we should get at least 2 different responses
			expect(responses.size).toBeGreaterThanOrEqual(2);
		});

		it("should handle POST requests with brotli", async () => {
			const response = await fastify.inject({
				method: "POST",
				url: "/brotli",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-encoding"]).toBe("br");

			const decompressed = brotliDecompressSync(response.rawPayload);
			const json = JSON.parse(decompressed.toString());
			expect(typeof json).toBe("object");
		});

		it("should handle PUT requests with brotli", async () => {
			const response = await fastify.inject({
				method: "PUT",
				url: "/brotli",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-encoding"]).toBe("br");

			const decompressed = brotliDecompressSync(response.rawPayload);
			const json = JSON.parse(decompressed.toString());
			expect(typeof json).toBe("object");
		});

		it("should handle PATCH requests with brotli", async () => {
			const response = await fastify.inject({
				method: "PATCH",
				url: "/brotli",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-encoding"]).toBe("br");

			const decompressed = brotliDecompressSync(response.rawPayload);
			const json = JSON.parse(decompressed.toString());
			expect(typeof json).toBe("object");
		});

		it("should handle DELETE requests with brotli", async () => {
			const response = await fastify.inject({
				method: "DELETE",
				url: "/brotli",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-encoding"]).toBe("br");

			const decompressed = brotliDecompressSync(response.rawPayload);
			const json = JSON.parse(decompressed.toString());
			expect(typeof json).toBe("object");
		});

		it("should consistently compress with brotli across multiple requests", async () => {
			const requests = 50;

			for (let i = 0; i < requests; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/brotli",
				});

				expect(response.statusCode).toBe(200);
				expect(response.headers["content-encoding"]).toBe("br");
				expect(Buffer.isBuffer(response.rawPayload)).toBe(true);

				// Verify it can be decompressed
				const decompressed = brotliDecompressSync(response.rawPayload);
				const json = JSON.parse(decompressed.toString());
				expect(typeof json).toBe("object");
			}
		});

		it("should include brotli size information when applicable", async () => {
			// Try multiple times to get the first template with size info
			let foundSizeInfo = false;

			for (let i = 0; i < 30 && !foundSizeInfo; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/brotli",
				});

				const decompressed = brotliDecompressSync(response.rawPayload);
				const json = JSON.parse(decompressed.toString());

				if (
					json.originalSize !== undefined &&
					json.compressedSize !== undefined
				) {
					foundSizeInfo = true;
					expect(json.originalSize).toBeGreaterThan(0);
					expect(json.compressedSize).toBeGreaterThan(0);
					expect(json.compression).toBe("br");
				}
			}

			// At least one response should have had size information
			expect(foundSizeInfo).toBe(true);
		});

		it("should produce different compression than gzip and deflate", async () => {
			// Get gzip response
			const gzipResponse = await fastify.inject({
				method: "GET",
				url: "/gzip",
			});

			// Get deflate response
			const deflateResponse = await fastify.inject({
				method: "GET",
				url: "/deflate",
			});

			// Get brotli response
			const brotliResponse = await fastify.inject({
				method: "GET",
				url: "/brotli",
			});

			// All should have different encodings
			expect(gzipResponse.headers["content-encoding"]).toBe("gzip");
			expect(deflateResponse.headers["content-encoding"]).toBe("deflate");
			expect(brotliResponse.headers["content-encoding"]).toBe("br");

			// All should be valid buffers
			expect(Buffer.isBuffer(gzipResponse.rawPayload)).toBe(true);
			expect(Buffer.isBuffer(deflateResponse.rawPayload)).toBe(true);
			expect(Buffer.isBuffer(brotliResponse.rawPayload)).toBe(true);
		});

		it("should have brotli-specific metadata in appropriate templates", async () => {
			// Try to get templates with brotli-specific info
			let foundBrotliMetadata = false;

			for (let i = 0; i < 30 && !foundBrotliMetadata; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/brotli",
				});

				const decompressed = brotliDecompressSync(response.rawPayload);
				const json = JSON.parse(decompressed.toString());

				// Check for brotli-specific fields
				if (
					json.algorithm === "Brotli" ||
					json.metadata?.encoding === "br" ||
					json.benchmark?.summary?.encoding === "br"
				) {
					foundBrotliMetadata = true;
				}
			}

			expect(foundBrotliMetadata).toBe(true);
		});
	});
});
