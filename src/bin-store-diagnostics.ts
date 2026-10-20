/**
 * Diagnostics for the bin store.
 * Logs and HTTP bodies can show the error name and a safe message.
 * They can show if the URI is present.
 * They cannot show the URI, the username, the password, or the host.
 */

export type BinStoreScheme = "mongodb" | "mongodb+srv";

export type BinStoreErrorInfo = {
	name: string;
	message: string;
	code: string | number | null;
};

export type BinHealth =
	| {
			status: "ok";
			bins: {
				store: "mongo" | "memory";
				connected: true;
				latencyMs: number;
				uriPresent: boolean;
				scheme: BinStoreScheme | null;
			};
	  }
	| {
			status: "error";
			bins: {
				store: "mongo" | "memory";
				connected: false;
				uriPresent: boolean;
				scheme: BinStoreScheme | null;
				error: BinStoreErrorInfo;
			};
	  };

export type UriShape = {
	whitespace: boolean;
	wrappedQuotes: boolean;
	extraAt: boolean;
};

const ENCODING_HINT =
	"Percent-encode reserved characters in the username and password (@ : / ? # [ ]).";

const loggedPhases = new WeakMap<object, Set<string>>();

/** Error whose message is already safe to return to clients. */
export class BinStoreFailure extends Error {
	readonly binStoreFailure = true;

	constructor(message: string, cause?: unknown) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "BinStoreFailure";
	}
}

export function isBinStoreFailure(error: unknown): error is BinStoreFailure {
	return (
		error instanceof BinStoreFailure ||
		(typeof error === "object" &&
			error !== null &&
			"binStoreFailure" in error &&
			(error as { binStoreFailure?: boolean }).binStoreFailure === true)
	);
}

export function mongoUriFacts(uri: string | undefined): {
	present: boolean;
	scheme: BinStoreScheme | null;
} {
	if (!uri) {
		return { present: false, scheme: null };
	}
	if (uri.startsWith("mongodb+srv://")) {
		return { present: true, scheme: "mongodb+srv" };
	}
	if (uri.startsWith("mongodb://")) {
		return { present: true, scheme: "mongodb" };
	}
	return { present: true, scheme: null };
}

/**
 * Shape flags only. A normal URI has one `@` or zero `@`.
 * A second `@` makes the driver throw `Invalid connection string` before the network call.
 */
export function uriShape(uri: string): UriShape {
	return {
		whitespace: /\s/.test(uri),
		wrappedQuotes:
			uri.startsWith('"') ||
			uri.startsWith("'") ||
			uri.endsWith('"') ||
			uri.endsWith("'"),
		extraAt: uri.split("@").length - 1 > 1,
	};
}

export function isBinStoreConnectionFailure(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}
	if (/^Mongo(Parse|Network|ServerSelection|API)/.test(error.name)) {
		return true;
	}
	const code =
		"code" in error && (error as { code?: unknown }).code != null
			? String((error as { code?: unknown }).code)
			: "";
	if (
		code === "ENOTFOUND" ||
		code === "ECONNREFUSED" ||
		code === "ETIMEDOUT" ||
		code === "EAI_AGAIN" ||
		code === "ENETUNREACH"
	) {
		return true;
	}
	return /invalid connection string|unescaped characters|querySrv|server selection|proxy request failed|ECONNREFUSED|ENOTFOUND/i.test(
		error.message,
	);
}

function replaceSecret(message: string, secret: string): string {
	if (secret.length < 3) {
		return message;
	}
	// Short alphabetic tokens are substrings of words like "username".
	if (/^[a-z]+$/i.test(secret) && secret.length < 8) {
		return message;
	}
	return message.split(secret).join("[redacted]");
}

function sensitiveParts(uri: string): string[] {
	const parts: string[] = [];
	const body = uri.replace(/^mongodb(?:\+srv)?:\/\//i, "");
	const at = body.lastIndexOf("@");
	if (at >= 0) {
		const userinfo = body.slice(0, at);
		const colon = userinfo.indexOf(":");
		if (colon >= 0) {
			parts.push(userinfo.slice(0, colon), userinfo.slice(colon + 1));
		} else if (userinfo) {
			parts.push(userinfo);
		}
		const host = body.slice(at + 1).split(/[/?]/)[0] ?? "";
		const hostname = host.split(":")[0] ?? "";
		if (hostname) {
			parts.push(hostname);
		}
	} else {
		const host = body.split(/[/?]/)[0] ?? "";
		const hostname = host.split(":")[0] ?? "";
		if (hostname) {
			parts.push(hostname);
		}
	}
	return parts;
}

export function redactSecrets(message: string, uri?: string): string {
	let out = message;
	if (uri) {
		out = out.split(uri).join("[redacted-uri]");
		for (const part of sensitiveParts(uri)) {
			out = replaceSecret(out, part);
		}
	}
	out = out.replace(/mongodb(?:\+srv)?:\/\/\S+/gi, "[redacted-uri]");
	out = out.replace(/\/\/([^/\s:@]+):([^/\s@]+)@/g, "//[redacted]:[redacted]@");
	return out;
}

function withEncodingHint(
	message: string,
	shape: UriShape | undefined,
): string {
	const needsHint =
		shape?.extraAt === true ||
		/invalid connection string|unescaped characters/i.test(message);
	if (!needsHint || message.includes("Percent-encode")) {
		return message;
	}
	return `${message}. ${ENCODING_HINT}`;
}

export function redactStoreError(
	error: unknown,
	uri?: string,
): BinStoreErrorInfo {
	const name = error instanceof Error && error.name ? error.name : "Error";
	const raw =
		error instanceof Error ? error.message : "Bin store request failed";
	const codeValue =
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: unknown }).code != null
			? (error as { code?: unknown }).code
			: null;
	const code =
		typeof codeValue === "string" || typeof codeValue === "number"
			? codeValue
			: null;
	const shape = uri ? uriShape(uri) : undefined;
	return {
		name,
		message: withEncodingHint(redactSecrets(raw, uri), shape),
		code,
	};
}

export function toSafeStoreError(
	error: unknown,
	uri?: string,
): BinStoreFailure {
	const info = redactStoreError(error, uri);
	return new BinStoreFailure(info.message);
}

type LogBinStoreInput = {
	phase: string;
	store: string;
	uri?: string;
	error?: unknown;
	level?: "error" | "info";
	connected?: boolean;
	latencyMs?: number;
};

function alreadyLogged(error: unknown, phase: string): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}
	let phases = loggedPhases.get(error);
	if (!phases) {
		phases = new Set();
		loggedPhases.set(error, phases);
	}
	if (phases.has(phase)) {
		return true;
	}
	phases.add(phase);
	return false;
}

/** One JSON line. Safe to print in Workers logs. */
export function logBinStore(input: LogBinStoreInput): void {
	if (input.error !== undefined && alreadyLogged(input.error, input.phase)) {
		return;
	}
	const facts = mongoUriFacts(input.uri);
	const payload: Record<string, unknown> = {
		source: "mockhttp.bin-store",
		phase: input.phase,
		store: input.store,
		uriPresent: facts.present,
		scheme: facts.scheme,
	};
	if (input.uri) {
		payload.uriShape = uriShape(input.uri);
	}
	if (input.connected !== undefined) {
		payload.connected = input.connected;
	}
	if (input.latencyMs !== undefined) {
		payload.latencyMs = input.latencyMs;
	}
	if (input.error !== undefined) {
		payload.error = redactStoreError(input.error, input.uri);
	}
	const line = JSON.stringify(payload);
	if (input.level === "info") {
		console.info(line);
		return;
	}
	console.error(line);
}
