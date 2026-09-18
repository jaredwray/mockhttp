import { afterEach, describe, expect, it } from "vitest";
import { readPublicFile, setPublicFileReader } from "../src/public-files.js";

describe("public files", () => {
	afterEach(() => {
		setPublicFileReader();
	});

	it("reads fixture files from the package public directory", async () => {
		const svg = await readPublicFile("logo.svg");
		expect(Buffer.isBuffer(svg)).toBe(true);
		expect(svg.toString("utf8")).toContain("<svg");
	});

	it("uses a custom reader and restores the default", async () => {
		setPublicFileReader(() => Buffer.from("custom"));
		expect((await readPublicFile("logo.svg")).toString()).toBe("custom");

		setPublicFileReader(undefined);
		const svg = await readPublicFile("logo.svg");
		expect(svg.toString("utf8")).toContain("<svg");
	});

	it("wraps Uint8Array results in a Buffer", async () => {
		setPublicFileReader(async () => new Uint8Array([1, 2, 3]));
		const bytes = await readPublicFile("logo.png");
		expect(Buffer.isBuffer(bytes)).toBe(true);
		expect([...bytes]).toEqual([1, 2, 3]);
	});
});
