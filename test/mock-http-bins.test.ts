import Keyv from "keyv";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CapturedRequest } from "../src/bin-store.js";
import { MockHttpBins } from "../src/mock-http-bins.js";

const RAW: Omit<CapturedRequest, "id" | "binId" | "capturedAt"> = {
	method: "GET",
	url: "/",
	path: "/",
	query: {},
	headers: {},
	remoteAddress: "127.0.0.1",
	bodySize: 0,
	body: null,
	bodyEncoding: "none",
	truncated: false,
};

describe("MockHttpBins", () => {
	let bins: MockHttpBins;

	beforeEach(() => {
		bins = new MockHttpBins();
	});

	afterEach(() => {
		bins.stop();
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	describe("constructor", () => {
		it("uses an in-memory Keyv and the default limits", () => {
			expect(bins.keyv).toBeInstanceOf(Keyv);
			expect(bins.maxBodySize).toBe(1024 * 1024);
			expect(bins.maxRequestsPerBin).toBe(100);
			expect(bins.defaultTtlMs).toBe(24 * 60 * 60 * 1000);
		});

		it("clamps a negative request limit to 0 and then stores nothing", async () => {
			const limited = new MockHttpBins({ maxRequestsPerBin: -10 });
			expect(limited.maxRequestsPerBin).toBe(0);
			const bin = await limited.createBin();
			await limited.recordRequest(bin.id, RAW);
			expect(await limited.getRequests(bin.id)).toEqual([]);
			expect((await limited.getBin(bin.id))?.requestCount).toBe(0);
		});

		it("uses the Keyv instance and limits that the caller passes", () => {
			const keyv = new Keyv();
			const custom = new MockHttpBins({
				keyv,
				defaultTtlMs: 1000,
				maxRequestsPerBin: 5,
				maxBodySize: 32,
				idLength: 6,
				cleanupIntervalMs: 50,
			});
			expect(custom.keyv).toBe(keyv);
			expect(custom.defaultTtlMs).toBe(1000);
			expect(custom.maxRequestsPerBin).toBe(5);
			expect(custom.maxBodySize).toBe(32);
		});
	});

	describe("createBin", () => {
		it("creates a bin with a short id and a later expiry", async () => {
			const bin = await bins.createBin();
			expect(bin.id).toHaveLength(12);
			expect(bin.requestCount).toBe(0);
			expect(Date.parse(bin.expiresAt)).toBeGreaterThan(
				Date.parse(bin.createdAt),
			);
		});

		it("honours the configured id length", async () => {
			const custom = new MockHttpBins({ idLength: 8 });
			expect((await custom.createBin()).id).toHaveLength(8);
		});

		it("does not return a bin whose lifetime is zero", async () => {
			const immediate = new MockHttpBins({ defaultTtlMs: 0 });
			const bin = await immediate.createBin();
			expect(await immediate.getBin(bin.id)).toBeUndefined();
		});
	});

	describe("getBin and listBins", () => {
		it("returns a bin while its lifetime is still open", async () => {
			const bin = await bins.createBin();
			expect((await bins.getBin(bin.id))?.id).toBe(bin.id);
		});

		it("returns undefined for an unknown bin", async () => {
			expect(await bins.getBin("nope")).toBeUndefined();
		});

		it("drops a bin after the Keyv lifetime ends", async () => {
			vi.useFakeTimers();
			const short = new MockHttpBins({ defaultTtlMs: 1000 });
			const bin = await short.createBin();
			await vi.advanceTimersByTimeAsync(1001);
			expect(await short.getBin(bin.id)).toBeUndefined();
			expect(await short.listBins()).toEqual([]);
		});

		it("deletes a bin whose expiresAt is past even when Keyv still returns it", async () => {
			const bin = await bins.createBin();
			const key = `bin:${bin.id}`;
			const doc = await bins.keyv.get(key);
			expect(doc).toBeDefined();
			if (!doc) {
				return;
			}
			doc.bin.expiresAt = new Date(Date.now() - 1).toISOString();
			await bins.keyv.set(key, doc, 60_000);
			expect(await bins.getBin(bin.id)).toBeUndefined();
			expect(await bins.keyv.get(key)).toBeUndefined();
		});

		it("lists live bins, drops expired ones, and ignores other keys", async () => {
			await bins.keyv.set("other", { hello: "world" });
			const fresh = await bins.createBin();
			const expired = await bins.createBin();
			const key = `bin:${expired.id}`;
			const doc = await bins.keyv.get(key);
			if (!doc) {
				throw new Error("expected stored bin");
			}
			doc.bin.expiresAt = new Date(Date.now() - 1).toISOString();
			await bins.keyv.set(key, doc, 60_000);

			const ids = (await bins.listBins()).map((bin) => bin.id);
			expect(ids).toEqual([fresh.id]);
			expect(await bins.keyv.get(key)).toBeUndefined();
		});

		it("throws from listBins when the Keyv store has no iterator", async () => {
			bins.keyv.store.iterator = undefined;
			await expect(bins.listBins()).rejects.toThrow(
				/does not support iteration/,
			);
		});

		it("lists bins when the Keyv namespace contains a colon", async () => {
			const namespaced = new MockHttpBins({
				keyv: new Keyv({ namespace: "tenant:a" }),
			});
			const bin = await namespaced.createBin();
			expect((await namespaced.listBins()).map((entry) => entry.id)).toEqual([
				bin.id,
			]);
		});
	});

	describe("deleteBin", () => {
		it("removes a bin and reports whether it existed", async () => {
			const bin = await bins.createBin();
			expect(await bins.deleteBin(bin.id)).toBe(true);
			expect(await bins.deleteBin(bin.id)).toBe(false);
			expect(await bins.getBin(bin.id)).toBeUndefined();
		});
	});

	describe("recordRequest", () => {
		it("stores captures newest first and sets requestCount", async () => {
			const bin = await bins.createBin();
			const first = await bins.recordRequest(bin.id, RAW);
			const second = await bins.recordRequest(bin.id, {
				...RAW,
				method: "POST",
			});
			const stored = await bins.getRequests(bin.id);
			expect(stored.map((request) => request.id)).toEqual([
				second?.id,
				first?.id,
			]);
			expect(first?.id).toHaveLength(12);
			expect(first?.capturedAt).toBeDefined();
			expect((await bins.getBin(bin.id))?.requestCount).toBe(2);
		});

		it("returns undefined for an unknown bin", async () => {
			expect(await bins.recordRequest("ghost", RAW)).toBeUndefined();
		});

		it("drops the oldest capture when the bin is full", async () => {
			const small = new MockHttpBins({ maxRequestsPerBin: 2 });
			const bin = await small.createBin();
			const ids: string[] = [];
			for (let i = 0; i < 3; i += 1) {
				const captured = await small.recordRequest(bin.id, RAW);
				ids.push(captured?.id ?? "");
			}
			const stored = await small.getRequests(bin.id);
			expect(stored.map((request) => request.id)).toEqual([ids[2], ids[1]]);
			expect((await small.getBin(bin.id))?.requestCount).toBe(2);
		});

		it("keeps every capture when many writes run at the same time", async () => {
			const bin = await bins.createBin();
			await Promise.all(
				Array.from({ length: 20 }, () => bins.recordRequest(bin.id, RAW)),
			);
			const stored = await bins.getRequests(bin.id);
			expect(stored).toHaveLength(20);
			expect(new Set(stored.map((request) => request.id)).size).toBe(20);
			expect((await bins.getBin(bin.id))?.requestCount).toBe(20);
		});

		it("accepts a later capture after one write fails", async () => {
			const bin = await bins.createBin();
			const set = bins.keyv.set.bind(bins.keyv);
			let failed = false;
			vi.spyOn(bins.keyv, "set").mockImplementation(async (key, value, ttl) => {
				if (!failed) {
					failed = true;
					throw new Error("write failed");
				}
				return set(key, value, ttl);
			});

			await expect(bins.recordRequest(bin.id, RAW)).rejects.toThrow(
				"write failed",
			);
			const captured = await bins.recordRequest(bin.id, RAW);
			expect(captured).toBeDefined();
			expect(await bins.getRequests(bin.id)).toHaveLength(1);
		});

		it("does not throw when the bin disappears before the write", async () => {
			const bin = await bins.createBin();
			const get = bins.keyv.get.bind(bins.keyv);
			let reads = 0;
			vi.spyOn(bins.keyv, "get").mockImplementation(async (key) => {
				reads += 1;
				if (reads === 2) {
					return undefined;
				}
				return get(key);
			});

			const captured = await bins.recordRequest(bin.id, RAW);
			expect(captured).toBeDefined();
			vi.mocked(bins.keyv.get).mockRestore();
			expect(await bins.getRequests(bin.id)).toEqual([]);
		});

		it("returns a copy of the request list", async () => {
			const bin = await bins.createBin();
			await bins.recordRequest(bin.id, RAW);
			const stored = await bins.getRequests(bin.id);
			stored.pop();
			expect(await bins.getRequests(bin.id)).toHaveLength(1);
		});
	});

	describe("getRequest and clearRequests", () => {
		it("looks up one capture and misses an unknown id", async () => {
			const bin = await bins.createBin();
			const captured = await bins.recordRequest(bin.id, RAW);
			expect((await bins.getRequest(bin.id, captured?.id ?? ""))?.id).toBe(
				captured?.id,
			);
			expect(await bins.getRequest(bin.id, "missing")).toBeUndefined();
			expect(await bins.getRequest("missing-bin", "r1")).toBeUndefined();
		});

		it("clears captures and keeps the bin", async () => {
			const bin = await bins.createBin();
			await bins.recordRequest(bin.id, RAW);
			await bins.clearRequests(bin.id);
			expect(await bins.getRequests(bin.id)).toEqual([]);
			expect((await bins.getBin(bin.id))?.requestCount).toBe(0);
		});

		it("does nothing when the bin does not exist", async () => {
			await bins.clearRequests("ghost");
			expect(await bins.getRequests("ghost")).toEqual([]);
		});
	});

	describe("cleanup timer", () => {
		it("sweeps on the configured interval and a second start does not add a timer", async () => {
			vi.useFakeTimers();
			const timed = new MockHttpBins({ cleanupIntervalMs: 100 });
			const bin = await timed.createBin();
			const key = `bin:${bin.id}`;
			const doc = await timed.keyv.get(key);
			if (!doc) {
				throw new Error("expected stored bin");
			}
			doc.bin.expiresAt = new Date(Date.now() - 1).toISOString();
			await timed.keyv.set(key, doc, 60_000);

			const iterator = vi.spyOn(timed.keyv, "iterator");
			timed.start();
			timed.start();
			await vi.advanceTimersByTimeAsync(100);
			expect(iterator).toHaveBeenCalledTimes(1);
			expect(await timed.keyv.get(key)).toBeUndefined();

			await vi.advanceTimersByTimeAsync(200);
			expect(iterator).toHaveBeenCalledTimes(3);
			timed.stop();
		});

		it("does not remove bins when the adapter has no iterator", async () => {
			vi.useFakeTimers();
			const timed = new MockHttpBins({ cleanupIntervalMs: 50 });
			const bin = await timed.createBin();
			timed.keyv.store.iterator = undefined;
			timed.start();
			await vi.advanceTimersByTimeAsync(50);
			expect(await timed.keyv.get(`bin:${bin.id}`)).toBeDefined();
			timed.stop();
		});

		it("swallows a sweep error so the timer does not emit an unhandled rejection", async () => {
			vi.useFakeTimers();
			const errors: unknown[] = [];
			const onError = (error: unknown) => {
				errors.push(error);
			};
			process.on("unhandledRejection", onError);
			const timed = new MockHttpBins({ cleanupIntervalMs: 50 });
			vi.spyOn(timed.keyv, "iterator").mockImplementation(() => {
				throw new Error("sweep failed");
			});
			try {
				timed.start();
				await vi.advanceTimersByTimeAsync(50);
				await Promise.resolve();
				expect(errors).toEqual([]);
			} finally {
				process.off("unhandledRejection", onError);
				timed.stop();
			}
		});

		it("stop is safe before start and after stop", () => {
			expect(() => bins.stop()).not.toThrow();
			bins.start();
			bins.stop();
			expect(() => bins.stop()).not.toThrow();
		});

		it("starts when the timer cannot be unref'd", () => {
			vi.stubGlobal("setInterval", () => 123);
			const timed = new MockHttpBins();
			expect(() => timed.start()).not.toThrow();
			timed.stop();
		});
	});
});
