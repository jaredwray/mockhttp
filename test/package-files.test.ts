import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, test } from "vitest";

const repoRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const siteDist = path.join(repoRoot, "site", "dist");
const siteIndex = path.join(siteDist, "index.html");

describe("package tarball", () => {
	const tempDirs: string[] = [];

	afterEach(async () => {
		await Promise.all(
			tempDirs
				.splice(0)
				.map((dir) => fs.rm(dir, { recursive: true, force: true })),
		);
	});

	test("pnpm pack includes the Docula site at site/dist", async () => {
		const createdDir = !existsSync(siteDist);
		const createdIndex = !existsSync(siteIndex);
		await fs.mkdir(siteDist, { recursive: true });
		if (createdIndex) {
			await fs.writeFile(
				siteIndex,
				"<!doctype html><title>pack-test</title>\n",
			);
		}

		const packDir = await fs.mkdtemp(path.join(os.tmpdir(), "mockhttp-pack-"));
		tempDirs.push(packDir);

		try {
			execFileSync(
				"pnpm",
				["pack", "--pack-destination", packDir, "--config.ignore-scripts=true"],
				{
					cwd: repoRoot,
					encoding: "utf8",
					env: process.env,
				},
			);

			const packed = (await fs.readdir(packDir)).filter((name) =>
				name.endsWith(".tgz"),
			);
			expect(packed).toHaveLength(1);

			const listing = execFileSync(
				"tar",
				["-tzf", path.join(packDir, packed[0])],
				{
					encoding: "utf8",
				},
			);
			const files = listing.split("\n").filter(Boolean);

			expect(files).toContain("package/site/dist/index.html");
		} finally {
			if (createdIndex) {
				await fs.unlink(siteIndex);
			}
			if (createdDir) {
				await fs.rm(siteDist, { recursive: true, force: true });
			}
		}
	}, 15_000);
});
