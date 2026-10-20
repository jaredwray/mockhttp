/**
 * Diagnostics for the bin store.
 * Logs can show the error name, a safe message, and URI shape flags.
 * Logs cannot show the URI, the username, the password, or the host.
 * `GET /healthz` can show the host, the username, and the password length.
 * It cannot show the password or the full URI.
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
				uri?: UriDiagnostics;
			};
	  }
	| {
			status: "error";
			bins: {
				store: "mongo" | "memory";
				connected: false;
				uriPresent: boolean;
				scheme: BinStoreScheme | null;
				uri?: UriDiagnostics;
				error: BinStoreErrorInfo;
			};
	  };

export type UriShape = {
	whitespace: boolean;
	wrappedQuotes: boolean;
	extraAt: boolean;
};

/** Redacted URI facts for `GET /healthz`. No password and no full URI. */
export type UriDiagnostics = {
	length: number;
	leadingWhitespace: boolean;
	trailingWhitespace: boolean;
	newline: boolean;
	wrappedQuotes: boolean;
	atCount: number;
	host: string | null;
	username: string | null;
	passwordLength: number | null;
	passwordReserved: string[];
	passwordHasPercent: boolean;
};

const PASSWORD_RESERVED = ["@", ":", "/", "?", "#", "[", "]", "$"] as const;

const ENCODING_HINT =
	"Percent-encode reserved characters in the username and password (@ : / ? # [ ] $).";

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

function hasWrappedQuotes(uri: string): boolean {
	const trimmed = uri.trim();
	return (
		trimmed.startsWith('"') ||
		trimmed.startsWith("'") ||
		trimmed.endsWith('"') ||
		trimmed.endsWith("'")
	);
}

function looksLikeHost(value: string): boolean {
	if (value === "localhost" || /^localhost:\d+$/.test(value)) {
		return true;
	}
	if (/^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?$/.test(value)) {
		return true;
	}
	if (/^\[[0-9a-fA-F:.]+\](?::\d+)?$/.test(value)) {
		return true;
	}
	const name = value.replace(/:\d+$/, "");
	return name.includes(".") && /^[A-Za-z0-9._-]+$/.test(name);
}

/**
 * Keep the authority section. Stop at the `/` or `?` that follows the host.
 * An `@` in the query string or the path is outside that section.
 */
function authorityBody(body: string): string {
	const firstAt = body.indexOf("@");
	if (firstAt < 0) {
		return body;
	}
	for (let i = firstAt + 1; i < body.length; i++) {
		const mark = body[i];
		if (mark !== "/" && mark !== "?") {
			continue;
		}
		const at = body.lastIndexOf("@", i - 1);
		const between = body.slice(at + 1, i);
		if (looksLikeHost(between)) {
			return body.slice(0, i);
		}
	}
	return body;
}

function userinfoAndHost(uri: string): {
	userinfo: string | null;
	host: string | null;
} {
	const cleaned = uri.trim().replace(/^['"]+|['"]+$/g, "");
	const scheme = cleaned.match(/^[a-z][a-z0-9+.-]*:\/\//i);
	const body = scheme ? cleaned.slice(scheme[0].length) : cleaned;
	const authority = authorityBody(body);
	const at = authority.lastIndexOf("@");
	if (at < 0) {
		return { userinfo: null, host: null };
	}
	const host = authority.slice(at + 1);
	return {
		userinfo: authority.slice(0, at),
		host: host.length > 0 ? host : null,
	};
}

/**
 * Host is the text after the last `@` in the authority section.
 * The search stops at the first `/` or `?` after that host.
 * Username is the text before the first `:` in the userinfo.
 * The password is not returned.
 * When every password character is reserved, the length and the list stay empty.
 * Those two values rebuild the password.
 */
export function uriDiagnostics(uri: string): UriDiagnostics {
	const parts = userinfoAndHost(uri);
	let username: string | null = null;
	let password: string | null = null;
	if (parts.userinfo !== null) {
		const colon = parts.userinfo.indexOf(":");
		if (colon < 0) {
			username = parts.userinfo.length > 0 ? parts.userinfo : null;
		} else {
			username = parts.userinfo.slice(0, colon) || null;
			password = parts.userinfo.slice(colon + 1);
		}
	}
	const secret = password;
	const onlyReserved =
		secret !== null &&
		secret.length > 0 &&
		[...secret].every((char) =>
			(PASSWORD_RESERVED as readonly string[]).includes(char),
		);
	return {
		length: uri.length,
		leadingWhitespace: /^\s/.test(uri),
		trailingWhitespace: /\s$/.test(uri),
		newline: /[\r\n]/.test(uri),
		wrappedQuotes: hasWrappedQuotes(uri),
		atCount: uri.split("@").length - 1,
		host: parts.host,
		username,
		passwordLength: secret === null || onlyReserved ? null : secret.length,
		passwordReserved:
			secret === null || onlyReserved
				? []
				: PASSWORD_RESERVED.filter((char) => secret.includes(char)),
		passwordHasPercent: secret?.includes("%") === true,
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

/**
 * Add the encode hint only when the driver message is already a parse error.
 * A DNS error or a scheme error keeps its own text.
 */
function withEncodingHint(message: string): string {
	const needsHint = /invalid connection string|unescaped characters/i.test(
		message,
	);
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
	return {
		name,
		message: withEncodingHint(redactSecrets(raw, uri)),
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
