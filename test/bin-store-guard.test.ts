import { afterEach, describe, expect, it, vi } from "vitest";
import { guardMongoStore } from "../worker/bin-store.js";

describe("guardMongoStore", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("logs Keyv failures, redacts them, and drops a broken client once", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const uri = "mongodb://user:p@ssw!rd@cluster0.abcde.mongodb.net/mockhttp";
		const resets: object[] = [];
		let disconnected = 0;
		const store = {
			url: "kept",
			label() {
				return "bound";
			},
			async set() {
				return false;
			},
			async delete() {
				throw Object.assign(new Error(`Invalid connection string ${uri}`), {
					name: "MongoParseError",
				});
			},
			async *iterator(): AsyncGenerator<unknown> {
				if (disconnected >= 0) {
					throw new Error("iterator exploded");
				}
				yield undefined;
			},
			async disconnect() {
				disconnected += 1;
			},
		};
		const guarded = guardMongoStore(store, uri, () => {
			resets.push(store);
		}) as typeof store;

		expect(guarded.url).toBe("kept");
		expect(guarded.label()).toBe("bound");
		await expect(guarded.set()).resolves.toBe(false);
		await expect(guarded.delete()).rejects.toThrow(/Percent-encode/);
		await expect(guarded.iterator().next()).rejects.toThrow(
			"iterator exploded",
		);
		await guarded.disconnect();
		expect(disconnected).toBe(1);
		store.disconnect = async () => {
			throw new Error("disconnect failed");
		};
		await expect(guarded.disconnect()).rejects.toThrow("disconnect failed");
		expect(resets).toHaveLength(1);
		expect(console.error).toHaveBeenCalled();
		const logged = vi.mocked(console.error).mock.calls.join("\n");
		expect(logged).not.toContain("p@ssw");
		expect(logged).not.toContain("cluster0");
	});
});
