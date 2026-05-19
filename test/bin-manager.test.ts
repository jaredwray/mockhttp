import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BinManager } from "../src/bin-manager.js";
import { InMemoryBinStore } from "../src/bin-store.js";

describe("BinManager", () => {
	let manager: BinManager;

	beforeEach(() => {
		manager = new BinManager();
	});

	afterEach(() => {
		manager.stop();
		vi.useRealTimers();
	});

	describe("constructor + defaults", () => {
		it("uses default options when none provided", () => {
			expect(manager.maxBodySize).toBe(1024 * 1024);
			expect(manager.maxRequestsPerBin).toBe(100);
			expect(manager.defaultTtlMs).toBe(24 * 60 * 60 * 1000);
			expect(manager.store).toBeInstanceOf(InMemoryBinStore);
		});

		it("clamps a negative maxRequestsPerBin to 0", () => {
			const m = new BinManager({ maxRequestsPerBin: -10 });
			expect(m.maxRequestsPerBin).toBe(0);
		});

		it("accepts a custom store and option overrides", () => {
			const store = new InMemoryBinStore();
			const custom = new BinManager({
				store,
				defaultTtlMs: 1000,
				maxRequestsPerBin: 5,
				maxBodySize: 32,
				idLength: 6,
				cleanupIntervalMs: 50,
			});
			expect(custom.store).toBe(store);
			expect(custom.defaultTtlMs).toBe(1000);
			expect(custom.maxRequestsPerBin).toBe(5);
			expect(custom.maxBodySize).toBe(32);
		});
	});

	describe("createBin", () => {
		it("creates a bin with a short id and TTL-based expiresAt", () => {
			const bin = manager.createBin();
			expect(bin.id).toHaveLength(12);
			expect(bin.requestCount).toBe(0);
			expect(Date.parse(bin.expiresAt)).toBeGreaterThan(
				Date.parse(bin.createdAt),
			);
		});

		it("honours the configured idLength", () => {
			const custom = new BinManager({ idLength: 8 });
			expect(custom.createBin().id).toHaveLength(8);
		});
	});

	describe("getBin / listBins (lazy expiration)", () => {
		it("returns the bin while it is alive", () => {
			const bin = manager.createBin();
			expect(manager.getBin(bin.id)?.id).toBe(bin.id);
		});

		it("returns undefined and removes an expired bin", () => {
			const short = new BinManager({ defaultTtlMs: 1 });
			const bin = short.createBin();
			vi.useFakeTimers();
			vi.setSystemTime(Date.now() + 1000);
			expect(short.getBin(bin.id)).toBeUndefined();
			expect(short.listBins()).toEqual([]);
		});

		it("filters expired bins from listBins and preserves fresh ones", () => {
			const short = new BinManager({ defaultTtlMs: 1 });
			const expiring = short.createBin();
			vi.useFakeTimers();
			vi.setSystemTime(Date.now() + 1000);
			const fresh = short.createBin();
			const ids = short.listBins().map((b) => b.id);
			expect(ids).toEqual([fresh.id]);
			expect(ids).not.toContain(expiring.id);
		});

		it("returns undefined for an unknown bin", () => {
			expect(manager.getBin("nope")).toBeUndefined();
		});
	});

	describe("deleteBin", () => {
		it("removes a bin and reports whether it existed", () => {
			const bin = manager.createBin();
			expect(manager.deleteBin(bin.id)).toBe(true);
			expect(manager.deleteBin(bin.id)).toBe(false);
		});
	});

	describe("recordRequest", () => {
		it("appends a captured request and assigns an id + capturedAt", () => {
			const bin = manager.createBin();
			const captured = manager.recordRequest(bin.id, {
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
			});
			expect(captured?.id).toBeDefined();
			expect(captured?.capturedAt).toBeDefined();
			expect(manager.getRequests(bin.id)).toHaveLength(1);
		});

		it("returns undefined for an unknown bin", () => {
			const captured = manager.recordRequest("ghost", {
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
			});
			expect(captured).toBeUndefined();
		});

		it("respects maxRequestsPerBin (FIFO drop)", () => {
			const small = new BinManager({ maxRequestsPerBin: 2 });
			const bin = small.createBin();
			for (let i = 0; i < 5; i += 1) {
				small.recordRequest(bin.id, {
					method: "POST",
					url: "/",
					path: "/",
					query: {},
					headers: {},
					remoteAddress: "127.0.0.1",
					bodySize: 0,
					body: null,
					bodyEncoding: "none",
					truncated: false,
				});
			}
			expect(small.getRequests(bin.id)).toHaveLength(2);
		});
	});

	describe("getRequest / clearRequests", () => {
		it("looks up a single captured request by id", () => {
			const bin = manager.createBin();
			const captured = manager.recordRequest(bin.id, {
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
			});
			expect(manager.getRequest(bin.id, captured?.id ?? "")?.id).toBe(
				captured?.id,
			);
			expect(manager.getRequest(bin.id, "missing")).toBeUndefined();
		});

		it("clears all requests in a bin", () => {
			const bin = manager.createBin();
			manager.recordRequest(bin.id, {
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
			});
			manager.clearRequests(bin.id);
			expect(manager.getRequests(bin.id)).toEqual([]);
		});
	});

	describe("start / stop cleanup timer", () => {
		it("calls cleanupExpired on the configured interval", () => {
			vi.useFakeTimers();
			const store = new InMemoryBinStore();
			const spy = vi.spyOn(store, "cleanupExpired");
			const m = new BinManager({ store, cleanupIntervalMs: 100 });
			m.start();
			vi.advanceTimersByTime(350);
			expect(spy).toHaveBeenCalledTimes(3);
			m.stop();
		});

		it("is idempotent: start twice only schedules one timer", () => {
			vi.useFakeTimers();
			const store = new InMemoryBinStore();
			const spy = vi.spyOn(store, "cleanupExpired");
			const m = new BinManager({ store, cleanupIntervalMs: 100 });
			m.start();
			m.start();
			vi.advanceTimersByTime(100);
			expect(spy).toHaveBeenCalledTimes(1);
			m.stop();
		});

		it("stop is idempotent and safe to call before start", () => {
			expect(() => manager.stop()).not.toThrow();
			manager.start();
			manager.stop();
			expect(() => manager.stop()).not.toThrow();
		});
	});
});
