import Keyv from "keyv";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CapturedRequest } from "../src/bin-store.js";
import { BinStoreFailure } from "../src/bin-store-diagnostics.js";
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
		vi.useRealTimers();
	});

	describe("constructor", () => {
		it("uses an in-memory Keyv and the default limits", () => {
			expect(bins.keyv).toBeInstanceOf(Keyv);
			expect(bins.maxBodySize).toBe(128 * 1024);
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

		it("rejects an id length that is not a positive integer", () => {
			expect(() => new MockHttpBins({ idLength: 1.5 })).toThrow(
				/positive integer/,
			);
			expect(() => new MockHttpBins({ idLength: 0 })).toThrow(
				/positive integer/,
			);
		});

		it("uses the Keyv instance and limits that the caller passes", () => {
			const keyv = new Keyv();
			const custom = new MockHttpBins({
				keyv,
				defaultTtlMs: 1000,
				maxRequestsPerBin: 5,
				maxBodySize: 32,
				idLength: 6,
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
			expect(Buffer.from(bin.token, "base64url").length).toBeGreaterThanOrEqual(
				32,
			);
			const { token, ...publicBin } = bin;
			expect(await bins.getBin(bin.id)).toEqual(publicBin);
			expect(await bins.authorizeOwner(bin.id, token)).toEqual({
				ok: true,
				bin: publicBin,
			});
			expect(await bins.authorizeOwner(bin.id, "other-token")).toEqual({
				ok: false,
			});
			expect(await bins.authorizeOwner("missing", token)).toEqual({
				ok: false,
			});
		});

		it("honours the configured id length", async () => {
			const custom = new MockHttpBins({ idLength: 8 });
			expect((await custom.createBin()).id).toHaveLength(8);
		});

		it("does not replace a bin when the new id is already in use", async () => {
			const first = await bins.createBin();
			const ids = vi
				.spyOn(bins as unknown as { generateId: () => string }, "generateId")
				.mockReturnValueOnce(first.id)
				.mockReturnValueOnce("freshid12ab");
			try {
				const second = await bins.createBin();
				expect(second.id).toBe("freshid12ab");
				expect((await bins.getBin(first.id))?.id).toBe(first.id);
				expect(await bins.authorizeOwner(first.id, first.token)).toEqual({
					ok: true,
					bin: expect.objectContaining({ id: first.id }),
				});
			} finally {
				ids.mockRestore();
			}
		});

		it("does not let a second store overwrite a shared short id", async () => {
			const keyv = new Keyv();
			const first = new MockHttpBins({ keyv, idLength: 1 });
			const second = new MockHttpBins({ keyv, idLength: 1 });
			for (let n = 1; n < 16; n++) {
				await keyv.set(
					`bin:${n.toString(16)}`,
					{
						bin: {
							id: n.toString(16),
							createdAt: new Date(0).toISOString(),
							expiresAt: new Date(60_000).toISOString(),
							requestCount: 0,
						},
						tokenHash: "ab".repeat(32),
						requests: [],
					},
					60_000,
				);
			}
			const set = keyv.set.bind(keyv);
			let release: (() => void) | undefined;
			const gate = new Promise<void>((resolve) => {
				release = resolve;
			});
			let writes = 0;
			vi.spyOn(keyv, "set").mockImplementation(async (key, value, ttl) => {
				writes += 1;
				if (writes === 1) {
					await gate;
				}
				return set(key, value, ttl);
			});
			const pending = Promise.allSettled([
				first.createBin(),
				second.createBin(),
			]);
			await vi.waitFor(() => expect(writes).toBe(1));
			release?.();
			const settled = await pending;
			const created = settled.flatMap((result) =>
				result.status === "fulfilled" ? [result.value] : [],
			);
			expect(created).toHaveLength(1);
			expect(
				(
					await first.authorizeOwner(
						created[0]?.id ?? "",
						created[0]?.token ?? "",
					)
				).ok,
			).toBe(true);
		});

		it("fills a one-character id space before it reports the space full", async () => {
			const small = new MockHttpBins({ idLength: 1 });
			const ids = new Set<string>();
			for (let n = 0; n < 16; n++) {
				ids.add((await small.createBin()).id);
			}
			expect(ids.size).toBe(16);
			await expect(small.createBin()).rejects.toThrow(/unique bin id/);
		});

		it("throws when every id attempt finds an existing bin", async () => {
			const first = await bins.createBin();
			const ids = vi
				.spyOn(bins as unknown as { generateId: () => string }, "generateId")
				.mockReturnValue(first.id);
			try {
				await expect(bins.createBin()).rejects.toThrow(/unique bin id/);
				expect((await bins.getBin(first.id))?.id).toBe(first.id);
			} finally {
				ids.mockRestore();
			}
		});

		it("lets Keyv expire a bin whose lifetime is zero", async () => {
			vi.useFakeTimers();
			const immediate = new MockHttpBins({ defaultTtlMs: 0 });
			const bin = await immediate.createBin();
			await vi.advanceTimersByTimeAsync(2);
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

		it("keeps a Keyv TTL when a write lands after expiresAt", async () => {
			vi.useFakeTimers();
			const bin = await bins.createBin();
			const key = `bin:${bin.id}`;
			const doc = await bins.keyv.get(key);
			if (!doc) {
				throw new Error("expected stored bin");
			}
			doc.bin.expiresAt = new Date(Date.now() - 1).toISOString();
			await bins.keyv.set(key, doc, 60_000);

			expect(await bins.recordRequest(bin.id, RAW)).toBeDefined();
			await vi.advanceTimersByTimeAsync(2);
			expect(await bins.getBin(bin.id)).toBeUndefined();
		});

		it("lists the bins that Keyv holds and ignores other keys", async () => {
			vi.useFakeTimers();
			await bins.keyv.set("other", { hello: "world" });
			const fresh = await bins.createBin();
			const expired = await bins.createBin();
			const key = `bin:${expired.id}`;
			const doc = await bins.keyv.get(key);
			if (!doc) {
				throw new Error("expected stored bin");
			}
			await bins.keyv.set(key, doc, 10);
			await vi.advanceTimersByTimeAsync(11);

			const ids = (await bins.listBins()).map((bin) => bin.id);
			expect(ids).toEqual([fresh.id]);
			expect(
				(await bins.listBinsForToken(fresh.token)).map((bin) => bin.id),
			).toEqual([fresh.id]);
			expect(await bins.listBinsForToken("other-token")).toEqual([]);
		});

		it("throws from listBins when the Keyv store has no iterator", async () => {
			bins.keyv.store.iterator = undefined;
			await expect(bins.listBins()).rejects.toThrow(
				/does not support iteration/,
			);
			await expect(bins.listBinsForToken("token")).rejects.toThrow(
				/does not support iteration/,
			);
		});

		it("lists bins when the Keyv namespace contains a colon", async () => {
			// Keyv 6 applies a namespace only when a store is also passed.
			const store = new Map();
			const namespaced = new MockHttpBins({
				keyv: new Keyv({ store, namespace: "tenant:a" }),
			});
			const bin = await namespaced.createBin();
			expect([...store.keys()]).toEqual([`tenant:a::bin:${bin.id}`]);
			expect((await namespaced.listBins()).map((entry) => entry.id)).toEqual([
				bin.id,
			]);
		});
	});

	describe("owned reads and writes", () => {
		it("does not read, clear, or delete a replacement bin for a stale token", async () => {
			const first = await bins.createBin();
			await bins.recordRequest(first.id, RAW);
			const replacement = await bins.createBin();
			const stored = await bins.keyv.get(`bin:${replacement.id}`);
			if (!stored) {
				throw new Error("expected stored bin");
			}
			await bins.keyv.set(`bin:${first.id}`, stored, 60_000);

			expect(
				await bins.readOwnedRequests(first.id, first.token),
			).toBeUndefined();
			expect(
				await bins.readOwnedRequest(first.id, first.token, "missing"),
			).toEqual({ ok: false });
			expect(await bins.clearOwnedRequests(first.id, first.token)).toBe(false);
			expect(await bins.deleteOwnedBin(first.id, first.token)).toBe(false);
			expect((await bins.getBin(first.id))?.id).toBe(replacement.id);
			expect(await bins.readOwnedRequests(first.id, replacement.token)).toEqual(
				[],
			);
		});
	});

	describe("deleteBin", () => {
		it("removes a bin and reports whether it existed", async () => {
			const bin = await bins.createBin();
			expect(await bins.deleteBin(bin.id)).toBe(true);
			expect(await bins.deleteBin(bin.id)).toBe(false);
			expect(await bins.getBin(bin.id)).toBeUndefined();
		});

		it("waits for an in-flight capture, so the capture cannot write the bin back", async () => {
			const bin = await bins.createBin();
			const set = bins.keyv.set.bind(bins.keyv);
			let deleted: Promise<boolean> | undefined;
			vi.spyOn(bins.keyv, "set").mockImplementation(async (key, value, ttl) => {
				deleted ??= bins.deleteBin(bin.id);
				await new Promise((resolve) => setTimeout(resolve, 10));
				return set(key, value, ttl);
			});

			expect(await bins.recordRequest(bin.id, RAW)).toBeDefined();
			expect(await deleted).toBe(true);
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

			const error = await bins.recordRequest(bin.id, RAW).catch((e) => e);
			expect(error.message).toBe(`MockHttpBins: could not save bin ${bin.id}`);
			expect(error.cause.message).toBe("write failed");
			const captured = await bins.recordRequest(bin.id, RAW);
			expect(captured).toBeDefined();
			expect(await bins.getRequests(bin.id)).toHaveLength(1);
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
			expect(await bins.clearRequests(bin.id)).toBe(true);
			expect(await bins.getRequests(bin.id)).toEqual([]);
			expect((await bins.getBin(bin.id))?.requestCount).toBe(0);
		});

		it("returns false when the bin does not exist", async () => {
			expect(await bins.clearRequests("ghost")).toBe(false);
			expect(await bins.getRequests("ghost")).toEqual([]);
		});
	});

	describe("write failures", () => {
		it("throws when Keyv returns false because an error listener is attached", async () => {
			const keyv = new Keyv({ store: new Map() });
			keyv.on("error", () => undefined);
			vi.spyOn(keyv.store, "set").mockRejectedValue(new Error("store down"));
			const failing = new MockHttpBins({ keyv });
			await expect(failing.createBin()).rejects.toThrow(
				/^MockHttpBins: could not save bin /,
			);
		});

		it("includes a safe store message when the Keyv write fails", async () => {
			const keyv = new Keyv({ store: new Map() });
			vi.spyOn(keyv, "set").mockRejectedValue(
				new BinStoreFailure(
					"Invalid connection string. Percent-encode reserved characters in the username and password (@ : / ? # [ ] $).",
				),
			);
			const failing = new MockHttpBins({ keyv });
			const error = await failing.createBin().catch((cause) => cause);
			expect(error).toBeInstanceOf(BinStoreFailure);
			expect(error.message).toMatch(/^MockHttpBins: could not save bin /);
			expect(error.message).toContain("Percent-encode");
			expect(error.cause).toBeInstanceOf(BinStoreFailure);
		});

		it("wraps the store error when no error listener is attached", async () => {
			const keyv = new Keyv({ store: new Map() });
			vi.spyOn(keyv.store, "set").mockRejectedValue(new Error("store down"));
			const failing = new MockHttpBins({ keyv });
			const error = await failing.createBin().catch((e) => e);
			expect(error.message).toMatch(/^MockHttpBins: could not save bin /);
			expect(error.cause.message).toBe("store down");
		});

		it("throws from clearRequests and keeps the captures when the write fails", async () => {
			const bin = await bins.createBin();
			await bins.recordRequest(bin.id, RAW);
			vi.spyOn(bins.keyv, "set").mockResolvedValue(false);
			await expect(bins.clearRequests(bin.id)).rejects.toThrow(
				`MockHttpBins: could not save bin ${bin.id}`,
			);
			vi.mocked(bins.keyv.set).mockRestore();
			expect(await bins.getRequests(bin.id)).toHaveLength(1);
		});
	});
});
