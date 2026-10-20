import { afterEach, describe, expect, it, vi } from "vitest";
import {
	isBinStoreConnectionFailure,
	isBinStoreFailure,
	logBinStore,
	mongoUriFacts,
	redactSecrets,
	redactStoreError,
	toSafeStoreError,
	uriDiagnostics,
	uriShape,
} from "../src/bin-store-diagnostics.js";

const uri = "mongodb+srv://user:p@ssw!rd@cluster0.abcde.mongodb.net/mockhttp";

describe("bin store diagnostics", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("classifies URI schemes without echoing the value", () => {
		expect(mongoUriFacts(undefined)).toEqual({ present: false, scheme: null });
		expect(mongoUriFacts("")).toEqual({ present: false, scheme: null });
		expect(mongoUriFacts("mongodb+srv://user:pass@host/db").scheme).toBe(
			"mongodb+srv",
		);
		expect(mongoUriFacts("mongodb://user:pass@host/db").scheme).toBe("mongodb");
		expect(mongoUriFacts("http://example").scheme).toBeNull();
		expect(mongoUriFacts("http://example").present).toBe(true);
	});

	it("flags whitespace, quotes, and a second @", () => {
		expect(uriShape("mongodb://user:pass@host/db")).toEqual({
			whitespace: false,
			wrappedQuotes: false,
			extraAt: false,
		});
		expect(uriShape("mongodb://user:pass@host/db\n").whitespace).toBe(true);
		expect(uriShape('"mongodb://user:pass@host/db"').wrappedQuotes).toBe(true);
		expect(uriShape("'mongodb://user:pass@host/db").wrappedQuotes).toBe(true);
		expect(uriShape(uri).extraAt).toBe(true);
	});

	it("recognizes connection failures and ignores ordinary errors", () => {
		expect(isBinStoreConnectionFailure("nope")).toBe(false);
		expect(
			isBinStoreConnectionFailure(
				Object.assign(new Error("Invalid connection string"), {
					name: "MongoParseError",
				}),
			),
		).toBe(true);
		expect(
			isBinStoreConnectionFailure(
				Object.assign(new Error("reset"), { name: "MongoNetworkError" }),
			),
		).toBe(true);
		const coded = Object.assign(new Error("down"), { code: "ECONNREFUSED" });
		expect(isBinStoreConnectionFailure(coded)).toBe(true);
		expect(
			isBinStoreConnectionFailure(
				Object.assign(new Error("querySrv ENOTFOUND"), { code: "ENOTFOUND" }),
			),
		).toBe(true);
		for (const code of ["ETIMEDOUT", "EAI_AGAIN", "ENETUNREACH"]) {
			expect(
				isBinStoreConnectionFailure(Object.assign(new Error("x"), { code })),
			).toBe(true);
		}
		expect(
			isBinStoreConnectionFailure(
				Object.assign(new Error("duplicate key"), { name: "MongoServerError" }),
			),
		).toBe(false);
		expect(
			isBinStoreConnectionFailure(
				Object.assign(new Error("proxy request failed"), { name: "Error" }),
			),
		).toBe(true);
	});

	it("redacts credentials, hosts, and connection strings", () => {
		const message = `failed ${uri} Username contains unescaped characters user`;
		const redacted = redactSecrets(message, uri);
		expect(redacted).not.toContain("p@ssw");
		expect(redacted).not.toContain("cluster0");
		expect(redacted).not.toContain("mongodb+srv://");
		expect(redacted).toContain("Username contains unescaped characters");
		expect(redactSecrets("see mongodb://other:secret@db.example/app")).toBe(
			"see [redacted-uri]",
		);
		expect(redactSecrets("auth //other:secret@host left alone")).toContain(
			"//[redacted]:[redacted]@",
		);
		const plain = "mongodb://localhost/mockhttp";
		expect(redactSecrets(`down ${plain}`, plain)).not.toContain("localhost");
		expect(
			redactSecrets("ab and x", "mongodb://ab:x@host.example/db"),
		).toContain("ab");
		expect(
			redactSecrets("onlyuser at host", "mongodb://onlyuser@host.example/db"),
		).not.toContain("onlyuser");
	});

	it("reports redacted URI diagnostics and hides the password", () => {
		const clean = "mongodb://user:pass@cluster.example.invalid:27017/db";
		expect(uriDiagnostics(clean)).toEqual({
			length: clean.length,
			leadingWhitespace: false,
			trailingWhitespace: false,
			newline: false,
			wrappedQuotes: false,
			atCount: 1,
			host: "cluster.example.invalid:27017",
			username: "user",
			passwordLength: 4,
			passwordReserved: [],
			passwordHasPercent: false,
		});

		const dirty = ` "mongodb+srv://user:p@ss:/?#[]%40rd@cluster0.example.invalid/mockhttp"\n`;
		const report = uriDiagnostics(dirty);
		expect(report.length).toBe(dirty.length);
		expect(report.leadingWhitespace).toBe(true);
		expect(report.trailingWhitespace).toBe(true);
		expect(report.newline).toBe(true);
		expect(report.wrappedQuotes).toBe(true);
		expect(report.atCount).toBe(2);
		expect(report.host).toBe("cluster0.example.invalid");
		expect(report.username).toBe("user");
		expect(report.passwordLength).toBe("p@ss:/?#[]%40rd".length);
		expect(report.passwordReserved).toEqual([
			"@",
			":",
			"/",
			"?",
			"#",
			"[",
			"]",
		]);
		expect(report.passwordHasPercent).toBe(true);
		expect(JSON.stringify(report)).not.toContain("p@ss");
		expect(JSON.stringify(report)).not.toContain("%40rd");

		expect(uriDiagnostics("mongodb://127.0.0.1:1/mockhttp")).toMatchObject({
			atCount: 0,
			host: null,
			username: null,
			passwordLength: null,
			passwordReserved: [],
			passwordHasPercent: false,
		});
		expect(
			uriDiagnostics("mongodb://onlyuser@cluster.example.invalid/db"),
		).toMatchObject({
			username: "onlyuser",
			passwordLength: null,
			host: "cluster.example.invalid",
		});
		expect(uriDiagnostics("not-a-uri@example.invalid/db")).toMatchObject({
			username: "not-a-uri",
			host: "example.invalid",
			passwordLength: null,
		});
		expect(uriDiagnostics("mongodb://user:pass@")).toMatchObject({
			host: null,
			username: "user",
			passwordLength: 4,
		});
		const emptyUser = uriDiagnostics("mongodb://:secret@example.invalid/db");
		expect(emptyUser).toMatchObject({
			username: null,
			passwordLength: 6,
			host: "example.invalid",
		});
		expect(JSON.stringify(emptyUser)).not.toContain("secret");

		const query = uriDiagnostics(
			"mongodb://user:pass@cluster.example.invalid/db?appName=ops@example.com",
		);
		expect(query.host).toBe("cluster.example.invalid");
		expect(query.username).toBe("user");
		expect(query.passwordLength).toBe(4);
		expect(query.passwordReserved).toEqual([]);
		expect(query.atCount).toBe(2);
		expect(JSON.stringify(query)).not.toContain("ops@example.com");

		expect(
			uriDiagnostics("mongodb://user:pa$ss@cluster.example.invalid/db")
				.passwordReserved,
		).toEqual(["$"]);

		expect(
			uriDiagnostics("mongodb://user:pass@localhost/db?appName=ops@example.com")
				.host,
		).toBe("localhost");
		expect(
			uriDiagnostics(
				"mongodb://user:pass@127.0.0.1:27017/db?appName=ops@example.com",
			).host,
		).toBe("127.0.0.1:27017");
		expect(
			uriDiagnostics("mongodb://user:pass@[::1]/db?appName=ops@example.com")
				.host,
		).toBe("[::1]");

		const marks = uriDiagnostics("mongodb://user:@@@@@cluster.example.invalid");
		expect(marks.atCount).toBe(5);
		expect(marks.host).toBe("cluster.example.invalid");
		expect(marks.passwordLength).toBeNull();
		expect(marks.passwordReserved).toEqual([]);
		expect(JSON.stringify(marks)).not.toContain("@@@@");
	});

	it("adds a percent-encoding hint for parser failures", () => {
		const info = redactStoreError(
			Object.assign(new Error("Invalid connection string"), {
				name: "MongoParseError",
				code: "PARSE",
			}),
			uri,
		);
		expect(info).toMatchObject({
			name: "MongoParseError",
			code: "PARSE",
		});
		expect(info.message).toContain("Percent-encode");
		expect(info.message).not.toContain("p@ssw");
		const again = redactStoreError(
			new Error(`${info.message}`),
			"mongodb://user:pass@host/db",
		);
		expect(again.message.split("Percent-encode")).toHaveLength(2);

		const unnamed = new Error("Password contains unescaped characters");
		unnamed.name = "";
		expect(redactStoreError(unnamed).name).toBe("Error");
		expect(redactStoreError(unnamed).message).toContain("Percent-encode");
		expect(redactStoreError("secret").message).toBe("Bin store request failed");
		const numeric = Object.assign(new Error("timeout"), { code: 50 });
		expect(redactStoreError(numeric).code).toBe(50);
		const weird = Object.assign(new Error("timeout"), { code: { n: 1 } });
		expect(redactStoreError(weird).code).toBeNull();

		const dns = redactStoreError(
			Object.assign(
				new Error(
					"querySrv ENOTFOUND _mongodb._tcp.cluster0.abcde.mongodb.net",
				),
				{ name: "MongoServerSelectionError", code: "ENOTFOUND" },
			),
			uri,
		);
		expect(dns.name).toBe("MongoServerSelectionError");
		expect(dns.code).toBe("ENOTFOUND");
		expect(dns.message).toContain("querySrv");
		expect(dns.message).not.toContain("Invalid connection string");
		expect(dns.message).not.toContain("Percent-encode");
		expect(dns.message).not.toContain("cluster0");

		const scheme = redactStoreError(
			Object.assign(
				new Error(
					'Invalid scheme, expected connection string to start with "mongodb://" or "mongodb+srv://"',
				),
				{ name: "MongoParseError" },
			),
			" mongodb://user:pass@host/db",
		);
		expect(scheme.name).toBe("MongoParseError");
		expect(scheme.message).not.toContain("Percent-encode");
		expect(scheme.message).not.toContain("Invalid connection string");
	});

	it("marks safe store errors and logs each phase once", () => {
		const safe = toSafeStoreError(new Error("Invalid connection string"), uri);
		expect(isBinStoreFailure(safe)).toBe(true);
		expect(isBinStoreFailure({ binStoreFailure: true })).toBe(true);
		expect(isBinStoreFailure(new Error("no"))).toBe(false);
		expect(safe.message).toContain("Percent-encode");
		expect(safe.message).not.toContain(uri);

		const errorLog = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const infoLog = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);
		const cause = new Error(`boom ${uri}`);
		logBinStore({ phase: "keyv.get", store: "keyv-mongo", uri, error: cause });
		logBinStore({ phase: "keyv.get", store: "keyv-mongo", uri, error: cause });
		logBinStore({
			phase: "keyv.connect",
			store: "keyv-mongo",
			uri,
			error: cause,
			connected: false,
			latencyMs: 4,
		});
		logBinStore({
			phase: "keyv.connect",
			store: "keyv-mongo",
			uri,
			level: "info",
			connected: true,
			latencyMs: 3,
		});
		logBinStore({ phase: "healthz", store: "memory", error: "x" });
		expect(errorLog).toHaveBeenCalledTimes(3);
		expect(infoLog).toHaveBeenCalledTimes(1);
		const logged = [...errorLog.mock.calls, ...infoLog.mock.calls]
			.map((call) => String(call[0]))
			.join("\n");
		expect(logged).toContain("mockhttp.bin-store");
		expect(logged).toContain("extraAt");
		expect(logged).not.toContain(uri);
		expect(logged).not.toContain("p@ssw");
		expect(logged).not.toContain("cluster0");
	});
});
