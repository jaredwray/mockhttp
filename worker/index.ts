import {
	createWorkerApp,
	handleWorkerFetch,
	listenWorkerApp,
	type WorkerEnv,
} from "./app.js";

let listening: Promise<void> | undefined;

// The Atlas URI is on the request env, so Fastify starts on the first fetch.
async function ensureWorkerListening(env: WorkerEnv): Promise<void> {
	if (!listening) {
		const pending = (async () => {
			try {
				await listenWorkerApp(await createWorkerApp(env));
			} catch (error) {
				if (listening === pending) {
					listening = undefined;
				}
				throw error;
			}
		})();
		listening = pending;
	}

	await listening;
}

export default {
	async fetch(request: Request, env: WorkerEnv): Promise<Response> {
		await ensureWorkerListening(env);
		return handleWorkerFetch(request, env);
	},
};
