import { readFileSync } from "node:fs";
import { join } from "node:path";

const defaultPublicPath = join(process.cwd(), "public");

export type PublicFileReader = (
	file: string,
) => Uint8Array | Promise<Uint8Array>;

const defaultReader: PublicFileReader = (file) =>
	readFileSync(join(defaultPublicPath, file));

let reader: PublicFileReader = defaultReader;

/**
 * Override how public fixture files (logos, etc.) are loaded.
 * Pass `undefined` to restore the default filesystem reader.
 */
export function setPublicFileReader(
	next: PublicFileReader | undefined = undefined,
): void {
	reader = next ?? defaultReader;
}

/**
 * Read a file from the package `public/` directory, or from the active reader.
 */
export async function readPublicFile(file: string): Promise<Buffer> {
	const bytes = await reader(file);
	return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
}
