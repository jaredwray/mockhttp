declare module "cloudflare:workers" {
	export const env: import("./app.js").WorkerEnv;
}
