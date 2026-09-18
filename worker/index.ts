import {
	createWorkerApp,
	handleWorkerFetch,
	listenWorkerApp,
	type WorkerEnv,
} from "./app.js";

await listenWorkerApp(await createWorkerApp());

export default {
	async fetch(request: Request, env: WorkerEnv): Promise<Response> {
		return handleWorkerFetch(request, env);
	},
};
