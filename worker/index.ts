import { env as workerEnv } from "cloudflare:workers";
import {
	createWorkerApp,
	handleWorkerFetch,
	listenWorkerApp,
	type WorkerEnv,
	type WorkerExecutionContext,
} from "./app.js";

// Fastify compiles routes with `new Function()`. workerd allows that only
// while the isolate is starting, so the server has to listen at module load.
// `cloudflare:workers` exposes MONGODB_URI here. The Mongo client connects
// later, on the first bin operation of a request, because network I/O is
// rejected during startup. It closes when that request ends.
await listenWorkerApp(await createWorkerApp(workerEnv));

export default {
	async fetch(
		request: Request,
		env: WorkerEnv,
		ctx: WorkerExecutionContext,
	): Promise<Response> {
		return handleWorkerFetch(request, env, ctx);
	},
};
