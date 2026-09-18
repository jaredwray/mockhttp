# Defense in Depth

Tracking against https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth-nodejs/SKILL.md.

Profile: npm library · public

## 1. Security docs
- [x] `SECURITY.md` present — contact info + "How this repository is secured" summary (#182)
- [x] `DEFENSE_IN_DEPTH.md` present (this file) (#182)

## 2. CODEOWNERS and cloud bootstrap
- [x] `.github/CODEOWNERS` covers `/.github/`, `/.vscode/`, `/.cursor/`, `/.devcontainer/`, `/scripts/` with owners the maintainer names (#183; `/.vscode/` in #221)
- [x] Codespaces and Cursor Cloud Agents bootstrap Aikido Safe Chain via scripts/setup-cloud-environment.sh (--ci shims, frozen lockfile) (#184)
- [x] Dev Container `image` pinned by digest (`name:<tag>@sha256:<digest>`; not a floating tag) (#214)

## 3. Dependencies (pnpm)
- [x] `packageManager: pnpm@11.3+` pinned in `package.json` (#185; currently `pnpm@12.4.1`)
- [x] 7-day cooldown: `minimumReleaseAge: 10080`, `minimumReleaseAgeStrict: true`, `minimumReleaseAgeIgnoreMissingTime: false`; no first-party `minimumReleaseAgeExclude` — verified on main
- [x] `trustPolicy: no-downgrade`; no first-party `trustPolicyExclude` — verified on main
- [x] Lifecycle scripts blocked: `strictDepBuilds: true`, `dangerouslyAllowAllBuilds: false`, `allowBuilds: {}` baseline (#186; exceptions `@swc/core`, `esbuild`)
- [x] `blockExoticSubdeps: true` — verified on main
- [x] Lockfile committed; CI installs with `sfw pnpm install --frozen-lockfile`
- [x] No `.github/dependabot.yml`; other dependency-update tools (if any) open PRs only — never auto-merge — verified on main

## 4. GitHub Actions
- [x] `permissions: contents: read` (or `{}` + per-job grants) on every workflow — verified on main
- [x] No `contents: write` except jobs whose purpose is mutating the repo (GitHub Release, Changesets version PR); generated output is a workflow artifact, never committed back from CI — verified on main
- [x] Every action pinned to a full commit SHA (`npx actions-up`) (#187, #213)
- [x] Every job installs Socket Firewall (`SocketDev/action` SHA-pinned, `firewall-version` pinned); `pnpm install` / `npm install` run as `sfw pnpm install` / `sfw npm install` (#188)
- [x] `.github/workflows/check-workflows.yaml` lints workflows with zizmor on every PR (#189)
- [x] Workflow `name:` and job `name:` contain no spaces (kebab-case) so they can be set as required status checks (#221)
- [x] `persist-credentials: false` on checkouts that don't push (#189)
- [x] No `pull_request_target` on workflows that run untrusted PR code — verified on main
- [x] Artifact-publishing workflows disable `actions/setup-node` default caching (`package-manager-cache: false`) to prevent cache poisoning — verified on main
- [x] No npm tokens (or other registry credentials) in Actions secrets — npm is OIDC-only; container images publish to GHCR with the job's `GITHUB_TOKEN` (#223)

## 5. npm publishing — npm libraries only
- [x] OIDC trusted publishing configured **stage-only** on npmjs.com for the publish workflow — it can stage, never publish live (manual)
- [x] `.github/workflows/release.yaml` packs then stages with `pnpm stage publish ./packed/*.tgz --no-git-checks` (#190)
- [x] Maintainer promotes staged versions with 2FA (manual)
- [x] Drydock connected — staged releases reviewed before promotion (manual)
- [x] No direct publish rights: package requires 2FA and disallows tokens (manual)
- [x] `package.json` `repository.url` accurate so provenance maps to this repo — verified on main

## 6. Security tooling
- [x] Aikido runs on every build — GitHub app scans PRs
- [x] Aikido release gate: the release workflow's stage-publish job `needs:` a passing `scan-release` (#191); Actions secret `AIKIDO_CLIENT_API_KEY` configured
- [x] Socket reviews every PR that changes dependencies — GitHub app scans PRs

## 7. Repository lockdown
- [x] Phishing-resistant 2FA (passkeys / hardware keys) on the GitHub and npm accounts (manual)
- [x] Recovery codes stored offline in a password manager (manual)
- [x] `lockdown-repo.sh` applied by a repo admin (never committed to this repo); `--check` with `--required-checks "build-22,build-24,build-26,analyze,zizmor"` and `--allowed-actions "codecov/*,peter-evans/*,docker/*"` passes (PRs required on the default branch, merges blocked unless required status checks pass, tag ruleset, immutable releases, fork-PR approval (public repos), read-only workflow tokens, Actions allowlist, secret scanning, Dependabot disabled, private vulnerability reporting (public repos)) (#221)

## Repo-specific notes

- Extra CODEOWNERS paths: `/worker/`, `/wrangler.jsonc`.
- Site deploy (`deploy-site.yaml`) uses a Cloudflare Worker via Wrangler. Production GitHub environment secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. The token needs Workers edit and the mockhttp.org zone (custom domain + DNS) permissions.
- Container images publish to `ghcr.io/jaredwray/mockhttp`. Delete leftover `DOCKER_USERNAME` / `DOCKER_PASSWORD` secrets and drop `peter-evans/*` from the Actions allowlist (`--allowed-actions "codecov/*,docker/*"`).

## Release flow

GitHub Releases can go live. `release.yaml` stages `@jaredwray/mockhttp` via OIDC; promote from [Drydock](https://drydock.org) with 2FA. Do not live-publish from CI. `docker-publish.yaml` pushes `ghcr.io/jaredwray/mockhttp` with the workflow `GITHUB_TOKEN` and a provenance attestation.
