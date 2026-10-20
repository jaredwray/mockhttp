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
		expect(body).not.toContain("cluster0");
		expect(body).not.toContain(uri);
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
		}
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
			expect(report.bins.error.message).not.toContain("cluster0");
		}
	});

	it("keeps a second socket proxy error inside the process", () => {
		installSocketProxyGuard();
		const socket = new net.Socket();
		const proxy = new Error(
			"proxy request failed, cannot connect to the specified address",
		);
		expect(() => {
			socket.emit("error", proxy);
		}).not.toThrow();
		expect(() => {
			socket.emit("error", new Error("other failure"));
		}).toThrow(/other failure/);
		const seen: unknown[] = [];
		socket.on("error", (error: unknown) => {
			seen.push(error);
		});
		socket.emit("error", proxy);
		expect(seen).toEqual([proxy]);
		socket.destroy();
	});
});
