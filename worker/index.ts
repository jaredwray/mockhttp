import { createWorkerApp, handleWorkerFetch, type WorkerEnv } from "./app.js";

const workerApp = await createWorkerApp();

export default {
	async fetch(request: Request, env: WorkerEnv): Promise<Response> {
		return handleWorkerFetch(request, env, workerApp);
	},
};
