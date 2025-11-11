import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { imageRoutes } from "../../../src/routes/images/index.js";

describe("Image Routes", () => {
	const fastify = Fastify();

	beforeAll(async () => {
		await fastify.register(imageRoutes);
	});

	afterAll(async () => {
		await fastify.close();
	});

	// Tests for /image endpoint with content negotiation
	describe("/image endpoint (content negotiation)", () => {
		it("should return PNG when Accept header is image/png", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image",
				headers: { accept: "image/png" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/png");
			expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
			expect(response.rawPayload.length).toBeGreaterThan(0);
		});

		it("should return JPEG when Accept header is image/jpeg", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image",
				headers: { accept: "image/jpeg" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/jpeg");
			expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
			expect(response.rawPayload.length).toBeGreaterThan(0);
		});

		it("should return JPEG when Accept header is image/jpg", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image",
				headers: { accept: "image/jpg" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/jpeg");
			expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
		});

		it("should return SVG when Accept header is image/svg+xml", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image",
				headers: { accept: "image/svg+xml" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/svg+xml");
			expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
			expect(response.rawPayload.length).toBeGreaterThan(0);
		});

		it("should return SVG when Accept header is image/svg", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image",
				headers: { accept: "image/svg" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/svg+xml");
			expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
		});

		it("should return WEBP when Accept header is image/webp", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image",
				headers: { accept: "image/webp" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/webp");
			expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
			expect(response.rawPayload.length).toBeGreaterThan(0);
		});

		it("should return PNG by default when no Accept header is provided", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/png");
			expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
		});

		it("should return PNG when Accept header is unsupported", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image",
				headers: { accept: "image/gif" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/png");
			expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
		});

		it("should return PNG when Accept header is text/html", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image",
				headers: { accept: "text/html" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/png");
			expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
		});

		it("should handle multiple Accept header values and return first match", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image",
				headers: { accept: "text/html, image/webp, image/png, */*" },
			});

			expect(response.statusCode).toBe(200);
			// Should return webp as it's the first image type in the Accept header
			expect(response.headers["content-type"]).toBe("image/webp");
			expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
		});
	});

	// Tests for /image/jpeg endpoint
	describe("/image/jpeg endpoint", () => {
		it("should return JPEG image with correct content type", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image/jpeg",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/jpeg");
			expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
			expect(response.rawPayload.length).toBeGreaterThan(0);
		});

		it("should return binary data", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image/jpeg",
			});

			expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
			// JPEG files start with FF D8 FF
			expect(response.rawPayload[0]).toBe(0xff);
			expect(response.rawPayload[1]).toBe(0xd8);
		});

		it("should return consistent file size", async () => {
			const response1 = await fastify.inject({
				method: "GET",
				url: "/image/jpeg",
			});

			const response2 = await fastify.inject({
				method: "GET",
				url: "/image/jpeg",
			});

			expect(response1.rawPayload.length).toBe(response2.rawPayload.length);
			expect(response1.rawPayload.length).toBeGreaterThan(1000); // Reasonable file size
		});

		it("should ignore Accept header and always return JPEG", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image/jpeg",
				headers: { accept: "image/png" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/jpeg");
		});
	});

	// Tests for /image/png endpoint
	describe("/image/png endpoint", () => {
		it("should return PNG image with correct content type", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image/png",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/png");
			expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
			expect(response.rawPayload.length).toBeGreaterThan(0);
		});

		it("should return binary data with PNG signature", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image/png",
			});

			expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
			// PNG files start with 89 50 4E 47 (‰PNG)
			expect(response.rawPayload[0]).toBe(0x89);
			expect(response.rawPayload[1]).toBe(0x50);
			expect(response.rawPayload[2]).toBe(0x4e);
			expect(response.rawPayload[3]).toBe(0x47);
		});

		it("should return consistent file size", async () => {
			const response1 = await fastify.inject({
				method: "GET",
				url: "/image/png",
			});

			const response2 = await fastify.inject({
				method: "GET",
				url: "/image/png",
			});

			expect(response1.rawPayload.length).toBe(response2.rawPayload.length);
			expect(response1.rawPayload.length).toBeGreaterThan(1000); // Reasonable file size
		});

		it("should ignore Accept header and always return PNG", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image/png",
				headers: { accept: "image/jpeg" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/png");
		});
	});

	// Tests for /image/svg endpoint
	describe("/image/svg endpoint", () => {
		it("should return SVG image with correct content type", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image/svg",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/svg+xml");
			expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
			expect(response.rawPayload.length).toBeGreaterThan(0);
		});

		it("should return valid SVG content", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image/svg",
			});

			const svgContent = response.rawPayload.toString("utf-8");
			expect(svgContent).toContain("<svg");
			expect(svgContent).toContain("</svg>");
		});

		it("should return consistent file size", async () => {
			const response1 = await fastify.inject({
				method: "GET",
				url: "/image/svg",
			});

			const response2 = await fastify.inject({
				method: "GET",
				url: "/image/svg",
			});

			expect(response1.rawPayload.length).toBe(response2.rawPayload.length);
			expect(response1.rawPayload.length).toBeGreaterThan(500); // Reasonable file size for SVG
		});

		it("should ignore Accept header and always return SVG", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image/svg",
				headers: { accept: "image/png" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/svg+xml");
		});

		it("should return text-based SVG that can be parsed", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image/svg",
			});

			const svgContent = response.rawPayload.toString("utf-8");
			// SVG should be valid XML
			expect(svgContent.trim()).toMatch(/^<[?!]/); // Starts with XML declaration or DOCTYPE
			expect(svgContent).toContain("xmlns");
		});
	});

	// Tests for /image/webp endpoint
	describe("/image/webp endpoint", () => {
		it("should return WEBP image with correct content type", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image/webp",
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/webp");
			expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
			expect(response.rawPayload.length).toBeGreaterThan(0);
		});

		it("should return binary data with WEBP signature", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image/webp",
			});

			expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
			// WEBP files contain "RIFF" at the start and "WEBP" at offset 8
			const riffSignature = response.rawPayload.toString("ascii", 0, 4);
			const webpSignature = response.rawPayload.toString("ascii", 8, 12);
			expect(riffSignature).toBe("RIFF");
			expect(webpSignature).toBe("WEBP");
		});

		it("should return consistent file size", async () => {
			const response1 = await fastify.inject({
				method: "GET",
				url: "/image/webp",
			});

			const response2 = await fastify.inject({
				method: "GET",
				url: "/image/webp",
			});

			expect(response1.rawPayload.length).toBe(response2.rawPayload.length);
			expect(response1.rawPayload.length).toBeGreaterThan(1000); // Reasonable file size
		});

		it("should ignore Accept header and always return WEBP", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image/webp",
				headers: { accept: "image/jpeg" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/webp");
		});
	});

	// Cross-format comparison tests
	describe("Cross-format comparisons", () => {
		it("should return different file sizes for different formats", async () => {
			const jpegResponse = await fastify.inject({
				method: "GET",
				url: "/image/jpeg",
			});

			const pngResponse = await fastify.inject({
				method: "GET",
				url: "/image/png",
			});

			const svgResponse = await fastify.inject({
				method: "GET",
				url: "/image/svg",
			});

			const webpResponse = await fastify.inject({
				method: "GET",
				url: "/image/webp",
			});

			// All should return valid buffers
			expect(Buffer.isBuffer(jpegResponse.rawPayload)).toBe(true);
			expect(Buffer.isBuffer(pngResponse.rawPayload)).toBe(true);
			expect(Buffer.isBuffer(svgResponse.rawPayload)).toBe(true);
			expect(Buffer.isBuffer(webpResponse.rawPayload)).toBe(true);

			// File sizes should be different (they're different formats)
			const sizes = [
				jpegResponse.rawPayload.length,
				pngResponse.rawPayload.length,
				svgResponse.rawPayload.length,
				webpResponse.rawPayload.length,
			];

			// At least some should be different
			const uniqueSizes = new Set(sizes);
			expect(uniqueSizes.size).toBeGreaterThan(1);
		});

		it("should return correct content types for all formats", async () => {
			const formats = [
				{ url: "/image/jpeg", contentType: "image/jpeg" },
				{ url: "/image/png", contentType: "image/png" },
				{ url: "/image/svg", contentType: "image/svg+xml" },
				{ url: "/image/webp", contentType: "image/webp" },
			];

			for (const format of formats) {
				const response = await fastify.inject({
					method: "GET",
					url: format.url,
				});

				expect(response.statusCode).toBe(200);
				expect(response.headers["content-type"]).toBe(format.contentType);
			}
		});

		it("should handle all endpoints without errors", async () => {
			const endpoints = [
				"/image",
				"/image/jpeg",
				"/image/png",
				"/image/svg",
				"/image/webp",
			];

			for (const endpoint of endpoints) {
				const response = await fastify.inject({
					method: "GET",
					url: endpoint,
				});

				expect(response.statusCode).toBe(200);
				expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
				expect(response.rawPayload.length).toBeGreaterThan(0);
			}
		});
	});

	// Error handling and edge cases
	describe("Error handling and edge cases", () => {
		it("should handle empty Accept header", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image",
				headers: { accept: "" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/png");
		});

		it("should handle malformed Accept header", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image",
				headers: { accept: "invalid/malformed" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/png");
		});

		it("should handle wildcard Accept header", async () => {
			const response = await fastify.inject({
				method: "GET",
				url: "/image",
				headers: { accept: "*/*" },
			});

			expect(response.statusCode).toBe(200);
			expect(response.headers["content-type"]).toBe("image/png");
		});

		it("should consistently return images across multiple requests", async () => {
			const requests = 20;

			for (let i = 0; i < requests; i++) {
				const response = await fastify.inject({
					method: "GET",
					url: "/image/png",
				});

				expect(response.statusCode).toBe(200);
				expect(response.headers["content-type"]).toBe("image/png");
				expect(Buffer.isBuffer(response.rawPayload)).toBe(true);
				expect(response.rawPayload.length).toBeGreaterThan(0);
			}
		});
	});
});
