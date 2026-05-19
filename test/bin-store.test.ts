import { beforeEach, describe, expect, it } from "vitest";
import {
	type Bin,
	type CapturedRequest,
	InMemoryBinStore,
} from "../src/bin-store.js";

function makeBin(overrides: Partial<Bin> = {}): Bin {
	const now = Date.now();
	return {
		id: overrides.id ?? "bin1",
		createdAt: new Date(now).toISOString(),
		expiresAt: new Date(now + 60_000).toISOString(),
		requestCount: 0,
		...overrides,
	};
}

function makeRequest(
	overrides: Partial<CapturedRequest> = {},
): CapturedRequest {
	return {
		id: overrides.id ?? "r1",
		binId: overrides.binId ?? "bin1",
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
		capturedAt: new Date().toISOString(),
		...overrides,
	};
}

describe("InMemoryBinStore", () => {
	let store: InMemoryBinStore;

	beforeEach(() => {
		store = new InMemoryBinStore();
	});

	it("creates and retrieves bins", () => {
		const bin = makeBin();
		store.createBin(bin);
		expect(store.getBin("bin1")).toEqual(bin);
	});

	it("returns undefined for unknown bin", () => {
		expect(store.getBin("nope")).toBeUndefined();
	});

	it("lists all bins", () => {
		store.createBin(makeBin({ id: "a" }));
		store.createBin(makeBin({ id: "b" }));
		expect(
			store
				.listBins()
				.map((b) => b.id)
				.sort(),
		).toEqual(["a", "b"]);
	});

	it("deletes bins and reports whether they existed", () => {
		store.createBin(makeBin({ id: "a" }));
		expect(store.deleteBin("a")).toBe(true);
		expect(store.deleteBin("a")).toBe(false);
		expect(store.getBin("a")).toBeUndefined();
	});

	it("adds requests newest-first and updates requestCount", () => {
		store.createBin(makeBin());
		store.addRequest("bin1", makeRequest({ id: "r1" }), 10);
		store.addRequest("bin1", makeRequest({ id: "r2" }), 10);
		const reqs = store.getRequests("bin1");
		expect(reqs.map((r) => r.id)).toEqual(["r2", "r1"]);
		expect(store.getBin("bin1")?.requestCount).toBe(2);
	});

	it("drops oldest request when bin is at capacity (FIFO)", () => {
		store.createBin(makeBin());
		store.addRequest("bin1", makeRequest({ id: "r1" }), 2);
		store.addRequest("bin1", makeRequest({ id: "r2" }), 2);
		store.addRequest("bin1", makeRequest({ id: "r3" }), 2);
		const reqs = store.getRequests("bin1");
		expect(reqs.map((r) => r.id)).toEqual(["r3", "r2"]);
		expect(store.getBin("bin1")?.requestCount).toBe(2);
	});

	it("ignores addRequest for unknown bin", () => {
		store.addRequest("ghost", makeRequest(), 10);
		expect(store.getRequests("ghost")).toEqual([]);
	});

	it("looks up a single captured request", () => {
		store.createBin(makeBin());
		store.addRequest("bin1", makeRequest({ id: "r1" }), 10);
		expect(store.getRequest("bin1", "r1")?.id).toBe("r1");
		expect(store.getRequest("bin1", "missing")).toBeUndefined();
		expect(store.getRequest("missing-bin", "r1")).toBeUndefined();
	});

	it("clears requests but keeps the bin", () => {
		store.createBin(makeBin());
		store.addRequest("bin1", makeRequest({ id: "r1" }), 10);
		store.clearRequests("bin1");
		expect(store.getRequests("bin1")).toEqual([]);
		expect(store.getBin("bin1")?.requestCount).toBe(0);
	});

	it("does nothing when clearing requests for unknown bin", () => {
		store.clearRequests("ghost");
		expect(store.getRequests("ghost")).toEqual([]);
	});

	it("returns isolated copies from getRequests", () => {
		store.createBin(makeBin());
		store.addRequest("bin1", makeRequest({ id: "r1" }), 10);
		const reqs = store.getRequests("bin1");
		reqs.pop();
		expect(store.getRequests("bin1")).toHaveLength(1);
	});

	it("does not spin forever when max is negative", () => {
		store.createBin(makeBin());
		expect(() => {
			store.addRequest("bin1", makeRequest({ id: "r1" }), -1);
		}).not.toThrow();
		// With max < 0, the single request just added gets evicted on the same
		// call, leaving the bin empty.
		expect(store.getRequests("bin1")).toEqual([]);
	});

	it("cleans up expired bins and returns their ids", () => {
		const now = Date.now();
		store.createBin(
			makeBin({ id: "old", expiresAt: new Date(now - 1).toISOString() }),
		);
		store.createBin(
			makeBin({ id: "fresh", expiresAt: new Date(now + 60_000).toISOString() }),
		);
		const removed = store.cleanupExpired(now);
		expect(removed).toEqual(["old"]);
		expect(store.getBin("old")).toBeUndefined();
		expect(store.getBin("fresh")).toBeDefined();
	});
});
