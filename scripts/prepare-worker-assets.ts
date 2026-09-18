import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const siteDist = path.join(root, "site", "dist");
const publicDir = path.join(root, "public");

if (!existsSync(siteDist)) {
	throw new Error(
		`Docula site not found at ${siteDist}. Run \`pnpm website:build\` first.`,
	);
}

mkdirSync(siteDist, { recursive: true });
cpSync(publicDir, siteDist, { recursive: true });
console.log(`Copied public assets into ${siteDist}`);
