import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..");
const workflowsDir = path.join(repoRoot, ".github", "workflows");

const workflowFiles = readdirSync(workflowsDir).filter((name) =>
	name.endsWith(".yaml"),
);

function workflowAndJobNames(source: string): string[] {
	const names: string[] = [];
	let inJobs = false;
	for (const line of source.split("\n")) {
		if (/^jobs:\s*$/.test(line)) {
			inJobs = true;
			continue;
		}
		if (!inJobs) {
			const workflowName = line.match(/^name:\s*(.+)\s*$/);
			if (workflowName) {
				names.push(workflowName[1].replace(/^["']|["']$/g, ""));
			}
			continue;
		}
		const jobName = line.match(/^ {4}name:\s*(.+)\s*$/);
		if (jobName) {
			names.push(jobName[1].replace(/^["']|["']$/g, ""));
		}
	}
	return names;
}

describe("defense in depth catalog", () => {
	test("CODEOWNERS covers high-risk paths including /.vscode/", () => {
		const owners = readFileSync(
			path.join(repoRoot, ".github", "CODEOWNERS"),
			"utf8",
		);
		for (const pattern of [
			"/.github/",
			"/.vscode/",
			"/.cursor/",
			"/.devcontainer/",
			"/scripts/",
		]) {
			expect(owners).toContain(`${pattern} @jaredwray`);
		}
	});

	test("Dev Container image is digest-pinned with a non-latest tag", () => {
		const config = JSON.parse(
			readFileSync(
				path.join(repoRoot, ".devcontainer", "devcontainer.json"),
				"utf8",
			),
		) as { image: string };
		expect(config.image).toMatch(
			/^mcr\.microsoft\.com\/devcontainers\/javascript-node:[^:@]+@sha256:[a-f0-9]{64}$/,
		);
		expect(config.image).not.toContain(":latest@");
	});

	test("Safe Chain bootstrap installs pnpm into ~/.safe-chain/bin", () => {
		const script = readFileSync(
			path.join(repoRoot, "scripts", "setup-cloud-environment.sh"),
			"utf8",
		);
		expect(script).toContain(
			'corepack enable --install-directory "$SAFE_CHAIN_BIN" pnpm',
		);
		expect(script).toContain('sh "$installer" --ci');
	});

	test("allowBuilds has no unused vue-demi exception", () => {
		const workspace = readFileSync(
			path.join(repoRoot, "pnpm-workspace.yaml"),
			"utf8",
		);
		expect(workspace).not.toMatch(/vue-demi/);
		expect(workspace).toMatch(/'@swc\/core': true/);
		expect(workspace).toMatch(/esbuild: true/);
	});

	test("workflow and job names have no spaces", () => {
		expect(workflowFiles.length).toBeGreaterThan(0);
		for (const file of workflowFiles) {
			const source = readFileSync(path.join(workflowsDir, file), "utf8");
			for (const name of workflowAndJobNames(source)) {
				expect(name, `${file} name "${name}"`).not.toMatch(/ /);
			}
		}
	});
});
