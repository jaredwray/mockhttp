import { afterEach, describe, expect, it, vi } from "vitest";

const { FakeKeyvMongo } = vi.hoisted(() => {
	type Listener = (error: unknown) => void;

	/** Stands in for `@keyv/mongo`. Instances share one map, like one database. */
	class FakeKeyvMongo {
		static instances: FakeKeyvMongo[] = [];
		static readonly shared = new Map<string, unknown>();
		static failConnect: Error | undefined;
		static failDisconnect: Error | undefined;
		static failGet: Error | undefined;
		static disconnects = 0;

		readonly url: string;
		readonly options: Record<string, unknown> | undefined;
		readonly connect: Promise<unknown>;
		private readonly listeners: Listener[] = [];

		constructor(url: string, options?: Record<string, unknown>) {
			this.url = url;
			this.options = options;
			FakeKeyvMongo.instances.push(this);
			if (FakeKeyvMongo.failConnect) {
				this.connect = Promise.reject(FakeKeyvMongo.failConnect);
				void this.connect.catch(() => undefined);
			} else {
				this.connect = Promise.resolve("ok");
			}
		}

		on(event: string, listener: Listener): this {
			if (event === "error") {
				this.listeners.push(listener);
			}
			return this;
		}

		emitError(error: unknown): void {
			for (const listener of this.listeners) {
				listener(error);
			}
		}

		async disconnect(): Promise<void> {
			FakeKeyvMongo.disconnects += 1;
			if (FakeKeyvMongo.failDisconnect) {
				throw FakeKeyvMongo.failDisconnect;
			}
		}

		async get(key: string): Promise<unknown> {
			if (FakeKeyvMongo.failGet) {
				throw FakeKeyvMongo.failGet;
			}
			return FakeKeyvMongo.shared.get(key);
		}

		async getMany(keys: string[]): Promise<unknown[]> {
			return keys.map((key) => FakeKeyvMongo.shared.get(key));
		}

		async has(key: string): Promise<boolean> {
			return FakeKeyvMongo.shared.has(key);
		}

		async hasMany(keys: string[]): Promise<boolean[]> {
			return keys.map((key) => FakeKeyvMongo.shared.has(key));
		}

		async set(key: string, value: unknown): Promise<boolean> {
			FakeKeyvMongo.shared.set(key, value);
			return true;
		}

		async setMany(
			entries: Array<{ key: string; value: unknown }>,
		): Promise<boolean[]> {
			for (const entry of entries) {
				FakeKeyvMongo.shared.set(entry.key, entry.value);
			}
			return entries.map(() => true);
		}

		async delete(key: string): Promise<boolean> {
			return FakeKeyvMongo.shared.delete(key);
		}

		async deleteMany(keys: string[]): Promise<boolean[]> {
			return keys.map((key) => FakeKeyvMongo.shared.delete(key));
		}

		async clear(): Promise<void> {
			FakeKeyvMongo.shared.clear();
		}

		async *iterator(): AsyncGenerator<[string, unknown]> {
			for (const entry of FakeKeyvMongo.shared) {
				yield entry;
			}
		}

		static reset(): void {
			FakeKeyvMongo.instances.length = 0;
			FakeKeyvMongo.shared.clear();
			FakeKeyvMongo.failConnect = undefined;
			FakeKeyvMongo.failDisconnect = undefined;
			FakeKeyvMongo.failGet = undefined;
			FakeKeyvMongo.disconnects = 0;
		}
	}

	return { FakeKeyvMongo };
});

vi.mock("@keyv/mongo", () => ({ default: FakeKeyvMongo }));

const {
	RequestScopedMongoStore,
	closeBinStoreScope,
	createAdaptiveBinKeyv,
	createBinStoreScope,
	currentBinStoreScope,
	runInBinStoreScope,
} = await import("../worker/bin-store.js");

const URI = "mongodb+srv://user:pass@cluster0.example.invalid/mockhttp";

describe("request scoped mongo store", () => {
	afterEach(() => {
		FakeKeyvMongo.reset();
		vi.restoreAllMocks();
	});

	it("shares one client across the operations of a scope and closes it once", async () => {
		vi.spyOn(console, "info").mockImplementation(() => undefined);
		const store = new RequestScopedMongoStore(() => URI);
		const scope = createBinStoreScope();
		expect(currentBinStoreScope()).toBeUndefined();

		await runInBinStoreScope(scope, async () => {
			expect(currentBinStoreScope()).toBe(scope);
			expect(await store.set("a", 1)).toBe(true);
			expect(await store.setMany([{ key: "b", value: 2 }])).toEqual([true]);
			expect(await store.get("a")).toBe(1);
			expect(await store.getMany(["a", "b"])).toEqual([1, 2]);
			expect(await store.has("a")).toBe(true);
			expect(await store.hasMany(["a", "zzz"])).toEqual([true, false]);
			const seen: unknown[] = [];
			for await (const entry of store.iterator()) {
				seen.push(entry);
			}
			expect(seen).toEqual([
				["a", 1],
				["b", 2],
			]);
			expect(await store.delete("b")).toBe(true);
			expect(await store.deleteMany(["a"])).toEqual([true]);
			await store.clear();
		});

		expect(FakeKeyvMongo.instances).toHaveLength(1);
		expect(FakeKeyvMongo.instances[0]?.url).toBe(URI);
		expect(FakeKeyvMongo.disconnects).toBe(0);
		expect(scope.pending.size).toBeGreaterThan(0);

		await closeBinStoreScope(scope);
		expect(scope.closed).toBe(true);
		expect(scope.client).toBeUndefined();
		expect(scope.pending.size).toBe(0);
		expect(FakeKeyvMongo.disconnects).toBe(1);
		expect(console.info).toHaveBeenCalledTimes(1);
		expect(vi.mocked(console.info).mock.calls.join("\n")).toContain(
			"keyv.connect",
		);

		// Closing again is a no-op.
		await closeBinStoreScope(scope);
		expect(FakeKeyvMongo.disconnects).toBe(1);
	});

	it("waits for operations still running when the scope closes", async () => {
		vi.spyOn(console, "info").mockImplementation(() => undefined);
		const store = new RequestScopedMongoStore(() => URI);
		const scope = createBinStoreScope();
		let release: () => void = () => undefined;
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const client = await runInBinStoreScope(scope, async () => {
			await store.set("k", "v");
			return FakeKeyvMongo.instances[0];
		});
		const slowGet = vi
			.spyOn(client as FakeKeyvMongo, "get")
			.mockImplementation(async () => {
				await gate;
				return "late";
			});
		const read = runInBinStoreScope(scope, () => store.get("k"));

		let closed = false;
		const closing = closeBinStoreScope(scope).then(() => {
			closed = true;
		});
		await new Promise((resolve) => setTimeout(resolve, 5));
		expect(closed).toBe(false);
		expect(FakeKeyvMongo.disconnects).toBe(0);

		release();
		expect(await read).toBe("late");
		await closing;
		expect(closed).toBe(true);
		expect(slowGet).toHaveBeenCalledOnce();
		expect(FakeKeyvMongo.disconnects).toBe(1);
	});

	it("opens and closes a client per operation outside a scope or after close", async () => {
		vi.spyOn(console, "info").mockImplementation(() => undefined);
		const store = new RequestScopedMongoStore(() => URI);

		expect(await store.set("x", 1)).toBe(true);
		expect(FakeKeyvMongo.instances).toHaveLength(1);
		expect(FakeKeyvMongo.disconnects).toBe(1);

		const seen: unknown[] = [];
		for await (const entry of store.iterator()) {
			seen.push(entry);
		}
		expect(seen).toEqual([["x", 1]]);
		expect(FakeKeyvMongo.instances).toHaveLength(2);
		expect(FakeKeyvMongo.disconnects).toBe(2);

		const scope = createBinStoreScope();
		await closeBinStoreScope(scope);
		await runInBinStoreScope(scope, async () => {
			expect(await store.get("x")).toBe(1);
			const again: unknown[] = [];
			for await (const entry of store.iterator()) {
				again.push(entry);
			}
			expect(again).toEqual([["x", 1]]);
		});
		expect(scope.client).toBeUndefined();
		expect(FakeKeyvMongo.instances).toHaveLength(4);
		expect(FakeKeyvMongo.disconnects).toBe(4);

		// Nothing is open outside a request, so disconnect has nothing to do.
		await store.disconnect();
		expect(FakeKeyvMongo.disconnects).toBe(4);
	});

	it("disconnect closes the current scope's client", async () => {
		vi.spyOn(console, "info").mockImplementation(() => undefined);
		const store = new RequestScopedMongoStore(() => URI);
		const scope = createBinStoreScope();
		await runInBinStoreScope(scope, async () => {
			await store.set("k", "v");
			await store.disconnect();
		});
		expect(scope.closed).toBe(true);
		expect(FakeKeyvMongo.disconnects).toBe(1);
	});

	it("fails cleanly when the URI disappears before the first operation", async () => {
		const store = new RequestScopedMongoStore(() => undefined);
		await expect(store.get("k")).rejects.toMatchObject({
			name: "BinStoreFailure",
			message: "MONGODB_URI is not set",
		});
		expect(FakeKeyvMongo.instances).toHaveLength(0);
	});

	it("drops a client after a connection failure and skips closing it", async () => {
		const errorLog = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const store = new RequestScopedMongoStore(() => URI);
		const scope = createBinStoreScope();
		FakeKeyvMongo.failConnect = Object.assign(
			new Error(`querySrv ENOTFOUND ${URI}`),
			{ name: "MongoNetworkError", code: "ENOTFOUND" },
		);
		FakeKeyvMongo.failGet = FakeKeyvMongo.failConnect;

		await runInBinStoreScope(scope, async () => {
			await expect(store.get("k")).rejects.toMatchObject({
				name: "BinStoreFailure",
			});
			// The failed client was dropped, so the next operation opens a new one.
			expect(scope.client).toBeUndefined();
			FakeKeyvMongo.failConnect = undefined;
			FakeKeyvMongo.failGet = undefined;
			expect(await store.get("k")).toBeUndefined();
		});
		expect(FakeKeyvMongo.instances).toHaveLength(2);
		await closeBinStoreScope(scope);
		// Only the client that connected is closed.
		expect(FakeKeyvMongo.disconnects).toBe(1);
		const logged = errorLog.mock.calls.join("\n");
		expect(logged).toContain("keyv.connect");
		expect(logged).toContain("keyv.get");
		expect(logged).not.toContain("user:pass");
		expect(logged).not.toContain("cluster0");
	});

	it("ignores a reset for a client the scope no longer holds", async () => {
		vi.spyOn(console, "info").mockImplementation(() => undefined);
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		const store = new RequestScopedMongoStore(() => URI);
		const scope = createBinStoreScope();
		await runInBinStoreScope(scope, () => store.set("k", "v"));
		const first = FakeKeyvMongo.instances[0] as FakeKeyvMongo;
		await closeBinStoreScope(scope);
		expect(FakeKeyvMongo.disconnects).toBe(1);

		const failure = Object.assign(new Error("connection reset"), {
			name: "MongoNetworkError",
		});
		first.emitError(failure);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(FakeKeyvMongo.disconnects).toBe(1);
	});

	it("forwards store errors to Keyv and logs a failed close", async () => {
		vi.spyOn(console, "info").mockImplementation(() => undefined);
		const errorLog = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const store = new RequestScopedMongoStore(() => URI);
		const forwarded: unknown[] = [];
		expect(
			store.on("error", (error) => {
				forwarded.push(error);
			}),
		).toBe(store);
		store.on("other", () => undefined);
		expect(store.capabilities.expires).toBe(true);
		expect(store.capabilities.compatible).toBe(true);

		FakeKeyvMongo.failDisconnect = new Error(`close failed ${URI}`);
		const scope = createBinStoreScope();
		await runInBinStoreScope(scope, () => store.set("k", "v"));
		const client = FakeKeyvMongo.instances[0] as FakeKeyvMongo;
		const failure = new Error("write concern");
		client.emitError(failure);
		expect(forwarded).toEqual([failure]);

		await closeBinStoreScope(scope);
		const logged = errorLog.mock.calls.join("\n");
		expect(logged).toContain("keyv.error");
		expect(logged).toContain("keyv.close");
		expect(logged).not.toContain("user:pass");
		expect(logged).not.toContain("cluster0");
	});

	it("logs a URI whose shape is dirty when the client opens", async () => {
		vi.spyOn(console, "info").mockImplementation(() => undefined);
		const errorLog = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const dirty = '"mongodb://user:p@ss@cluster0.example.invalid/db "';
		const store = new RequestScopedMongoStore(() => dirty);
		await store.set("k", "v");
		const logged = errorLog.mock.calls.join("\n");
		expect(logged).toContain("keyv.open");
		expect(logged).toContain('"extraAt":true');
		expect(logged).toContain('"whitespace":true');
		expect(logged).toContain('"wrappedQuotes":true');
		expect(logged).not.toContain("p@ss");
	});

	it("adaptive Keyv switches between memory and MongoDB by URI", async () => {
		vi.spyOn(console, "info").mockImplementation(() => undefined);
		let uri: string | undefined;
		const keyv = createAdaptiveBinKeyv(() => uri);

		await keyv.set("memory", { bin: "m" } as never);
		expect(await keyv.get("memory")).toEqual({ bin: "m" });
		expect(FakeKeyvMongo.instances).toHaveLength(0);
		expect(typeof keyv.store.iterator).toBe("function");

		uri = URI;
		expect(await keyv.get("memory")).toBeUndefined();
		await keyv.set("mongo", { bin: "x" } as never);
		expect(await keyv.get("mongo")).toEqual({ bin: "x" });
		expect(typeof keyv.store.iterator).toBe("function");
		expect(keyv.store).toBeInstanceOf(RequestScopedMongoStore);
		expect(FakeKeyvMongo.instances.length).toBeGreaterThan(0);
		expect(FakeKeyvMongo.disconnects).toBe(FakeKeyvMongo.instances.length);

		uri = undefined;
		expect(await keyv.get("memory")).toEqual({ bin: "m" });
	});
});
