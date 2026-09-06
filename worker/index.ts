import { Container, getRandom } from "@cloudflare/containers";

export const MAX_CONTAINERS = 3;
export const CONTAINER_PORT = 3000;
export const CONTAINER_SLEEP_AFTER = "24h";

export class MockHttpContainer extends Container {
	defaultPort = CONTAINER_PORT;
	sleepAfter = CONTAINER_SLEEP_AFTER;
	envVars = {
		NODE_ENV: "production",
		PORT: String(CONTAINER_PORT),
	};
}

export type WorkerEnv = {
	MOCKHTTP_CONTAINER: Parameters<typeof getRandom>[0];
};

export async function proxyToContainer(
	request: Request,
	env: WorkerEnv,
	instanceCount = MAX_CONTAINERS,
): Promise<Response> {
	const containerInstance = await getRandom(
		env.MOCKHTTP_CONTAINER,
		instanceCount,
	);
	return containerInstance.fetch(request);
}

export default {
	async fetch(request: Request, env: WorkerEnv): Promise<Response> {
		return proxyToContainer(request, env);
	},
};
