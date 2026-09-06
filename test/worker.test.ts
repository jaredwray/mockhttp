import { beforeEach, describe, expect, it, vi } from "vitest";

const { getRandomMock } = vi.hoisted(() => ({
	getRandomMock: vi.fn(),
}));

vi.mock("@cloudflare/containers", () => {
	class Container {}
	return {
		Container,
		getRandom: getRandomMock,
	};
});

const {
	CONTAINER_PORT,
	CONTAINER_SLEEP_AFTER,
	MAX_CONTAINERS,
	MockHttpContainer,
	proxyToContainer,
	default: worker,
} = await import("../worker/index.js");

describe("cloudflare worker", () => {
	const fetchMock = vi.fn();

	beforeEach(() => {
		getRandomMock.mockReset();
		fetchMock.mockReset();
		getRandomMock.mockResolvedValue({ fetch: fetchMock });
	});

	it("caps load balancing at five container instances", () => {
		expect(MAX_CONTAINERS).toBe(5);
	});

	it("listens on the Fastify port with a long idle timeout", () => {
		const container = new MockHttpContainer();
		expect(container.defaultPort).toBe(CONTAINER_PORT);
		expect(container.defaultPort).toBe(3000);
		expect(container.sleepAfter).toBe(CONTAINER_SLEEP_AFTER);
		expect(container.envVars).toEqual({
			NODE_ENV: "production",
			PORT: "3000",
		});
	});

	it("proxies each request to a random container", async () => {
		const request = new Request("https://mockhttp.org/get");
		const env = {
			MOCKHTTP_CONTAINER: { binding: "mockhttp-container" },
		};
		const expected = new Response("ok", { status: 200 });
		fetchMock.mockResolvedValue(expected);

		const response = await proxyToContainer(
			request,
			env as unknown as Parameters<typeof proxyToContainer>[1],
		);

		expect(getRandomMock).toHaveBeenCalledWith(
			env.MOCKHTTP_CONTAINER,
			MAX_CONTAINERS,
		);
		expect(fetchMock).toHaveBeenCalledWith(request);
		expect(response).toBe(expected);
	});

	it("allows an explicit instance count when proxying", async () => {
		const request = new Request("https://mockhttp.org/uuid");
		const env = {
			MOCKHTTP_CONTAINER: { binding: "mockhttp-container" },
		};
		fetchMock.mockResolvedValue(new Response("ok"));

		await proxyToContainer(
			request,
			env as unknown as Parameters<typeof proxyToContainer>[1],
			2,
		);

		expect(getRandomMock).toHaveBeenCalledWith(env.MOCKHTTP_CONTAINER, 2);
	});

	it("uses the default instance count from the worker fetch handler", async () => {
		const request = new Request("https://mockhttp.org/ip");
		const env = {
			MOCKHTTP_CONTAINER: { binding: "mockhttp-container" },
		};
		fetchMock.mockResolvedValue(new Response("ok"));

		const response = await worker.fetch(
			request,
			env as unknown as Parameters<typeof worker.fetch>[1],
		);

		expect(getRandomMock).toHaveBeenCalledWith(
			env.MOCKHTTP_CONTAINER,
			MAX_CONTAINERS,
		);
		expect(response.status).toBe(200);
	});
});
