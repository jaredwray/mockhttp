import { chdir } from "node:process";
import { start } from "./dist/index.mjs";

// This file is copied to the root of the deploy bundle, next to dist/ and public/.
chdir("/app");
await start();
