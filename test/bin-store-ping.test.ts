import net from "node:net";
import { MongoClient } from "mongodb";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	binStoreRuntime,
	installSocketProxyGuard,
} from "../worker/bin-store.js";

describe("mongo bin store ping", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("does not treat a well-formed mongodb+srv URI as invalid", async () => {
		const client = new MongoClient(
			"mongodb+srv://user:pass@cluster0.example.invalid/mockhttp",
			{ serverSelectionTimeoutMS: 200 },
		);
		expect(client.options.srvHost).toBeTruthy();
		await client.close();
	});

	it("reports an unencoded @ as an invalid connection string", async () => {
		const errorLog = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const uri = "mongodb+srv://user:p@ssw!rd@cluster0.example.invalid/mockhttp";
		const report = await binStoreRuntime.ping(uri);
		expect(report.status).toBe("error");
		if (report.status === "error") {
			expect(report.bins.store).toBe("mongo");
			expect(report.bins.connected).toBe(false);
			expect(report.bins.uriPresent).toBe(true);
			expect(report.bins.scheme).toBe("mongodb+srv");
			expect(report.bins.error.name).toBe("MongoParseError");
			expect(report.bins.error.message).toContain("Invalid connection string");
			expect(report.bins.error.message).toContain("Percent-encode");
		}
		const body = JSON.stringify(report);
		expect(body).not.toContain("p@ssw");
		expect(body).not.toContain(uri);
		if (report.status === "error") {
			expect(report.bins.uri).toEqual({
				length: uri.length,
				leadingWhitespace: false,
				trailingWhitespace: false,
				newline: false,
				wrappedQuotes: false,
				atCount: 2,
				host: "cluster0.example.invalid",
				username: "user",
				passwordLength: 8,
				passwordReserved: ["@"],
				passwordHasPercent: false,
			});
			expect(report.bins.error.message).not.toContain("cluster0");
		}
		expect(errorLog.mock.calls.join("\n")).not.toContain("p@ssw");
		expect(errorLog.mock.calls.join("\n")).not.toContain("cluster0");
	});

	it("returns a successful ping and logs a close failure", async () => {
		const errorLog = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		vi.spyOn(MongoClient.prototype, "db").mockReturnValue({
			command: vi.fn().mockResolvedValue({ ok: 1 }),
		} as never);
		vi.spyOn(MongoClient.prototype, "close").mockRejectedValue(
			new Error("close failed mongodb://user:pass@cluster0.example.invalid/db"),
		);
		const report = await binStoreRuntime.ping(
			"mongodb://user:pass@cluster0.example.invalid:27017/mockhttp",
		);
		expect(report).toMatchObject({
			status: "ok",
			bins: {
				store: "mongo",
				connected: true,
				uriPresent: true,
				scheme: "mongodb",
			},
		});
		if (report.status === "ok") {
			expect(report.bins.latencyMs).toEqual(expect.any(Number));
			expect(report.bins.uri?.host).toBe("cluster0.example.invalid:27017");
			expect(report.bins.uri?.username).toBe("user");
			expect(report.bins.uri?.passwordLength).toBe(4);
		}
		expect(JSON.stringify(report)).not.toContain("user:pass");
		expect(errorLog.mock.calls.join("\n")).toContain("healthz.close");
		expect(errorLog.mock.calls.join("\n")).not.toContain("cluster0");
		expect(errorLog.mock.calls.join("\n")).not.toContain("user:pass");
	});

	it("returns a redacted connect failure", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		vi.spyOn(MongoClient.prototype, "db").mockReturnValue({
			command: vi
				.fn()
				.mockRejectedValue(
					Object.assign(
						new Error(
							"querySrv ENOTFOUND _mongodb._tcp.cluster0.example.invalid",
						),
						{ code: "ENOTFOUND" },
					),
				),
		} as never);
		vi.spyOn(MongoClient.prototype, "close").mockResolvedValue();
		const report = await binStoreRuntime.ping(
			"mongodb+srv://user:pass@cluster0.example.invalid/mockhttp",
		);
		expect(report.status).toBe("error");
		if (report.status === "error") {
			expect(report.bins.error.code).toBe("ENOTFOUND");
			expect(report.bins.error.message).toContain("querySrv");
			expect(report.bins.error.message).not.toContain(
				"Invalid connection string",
			);
			expect(report.bins.error.message).not.toContain("Percent-encode");
			expect(report.bins.error.message).not.toContain("cluster0");
			expect(report.bins.uri?.host).toBe("cluster0.example.invalid");
			expect(report.bins.uri?.passwordHasPercent).toBe(false);
		}
	});

	it("passes the URI to MongoClient without trimming or extra characters", async () => {
		const uri = "mongodb://user:pass@cluster.example.invalid/mockhttp\n";
		let seen: string | undefined;
		vi.spyOn(MongoClient.prototype, "db").mockImplementation(function (
			this: MongoClient,
		) {
			seen = (this as unknown as { s: { url: string } }).s.url;
			return {
				command: vi.fn().mockResolvedValue({ ok: 1 }),
			} as never;
		});
		vi.spyOn(MongoClient.prototype, "close").mockResolvedValue();
		const report = await binStoreRuntime.ping(uri);
		expect(seen).toBe(uri);
		expect(report.status).toBe("ok");
		if (report.status === "ok") {
			expect(report.bins.uri?.newline).toBe(true);
			expect(report.bins.uri?.trailingWhitespace).toBe(true);
			expect(report.bins.uri?.length).toBe(uri.length);
		}
		expect(JSON.stringify(report)).not.toContain("user:pass");
	});

	it("still throws the first socket error that has no listener", () => {
		installSocketProxyGuard();
		const socket = new net.Socket();
		expect(() => {
			socket.emit("error", new Error("first failure"));
		}).toThrow(/first failure/);
		socket.destroy();
	});

	it("drops a second socket error that has no listener", () => {
		installSocketProxyGuard();
		const socket = new net.Socket();
		const proxy = new Error(
			"proxy request failed, cannot connect to the specified address",
		);
		const seen: unknown[] = [];
		socket.once("error", (error: unknown) => {
			seen.push(error);
		});
		expect(socket.emit("error", proxy)).toBe(true);
		expect(() => {
			socket.emit("error", proxy);
		}).not.toThrow();
		expect(() => {
			socket.emit("error", new Error("TLS handshake failed"));
		}).not.toThrow();
		expect(seen).toEqual([proxy]);
		const later: unknown[] = [];
		socket.on("error", (error: unknown) => {
			later.push(error);
		});
		const again = new Error("later failure");
		expect(socket.emit("error", again)).toBe(true);
		expect(later).toEqual([again]);
		socket.destroy();
	});
});
