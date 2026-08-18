# Defense in Depth

Tracking against https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth-nodejs/SKILL.md.

Profile: npm library · public

## 1. Security docs
- [x] `SECURITY.md` present — contact info + "How this repository is secured" summary (#182)
- [x] `DEFENSE_IN_DEPTH.md` present (this file) (#182)

## 2. CODEOWNERS and cloud bootstrap
- [x] `.github/CODEOWNERS` covers `/.github/`, `/.cursor/`, `/.devcontainer/`, `/scripts/` with owners the maintainer names (#183)
- [x] Codespaces and Cursor Cloud Agents bootstrap Aikido Safe Chain via scripts/setup-cloud-environment.sh (--ci shims, frozen lockfile) (#184)

## 3. Dependencies (pnpm)
- [x] `packageManager: pnpm@11.20.0` pinned in `package.json` (#185)
- [x] 7-day cooldown: `minimumReleaseAge: 10080`, `minimumReleaseAgeStrict: true`, `minimumReleaseAgeIgnoreMissingTime: false` — verified on main
- [x] Lifecycle scripts blocked: `strictDepBuilds: true`, `dangerouslyAllowAllBuilds: false`; `allowBuilds` only `@swc/core`, `esbuild`, `vue-demi` (#186)
- [x] `blockExoticSubdeps: true` — verified on main
- [x] Lockfile committed; CI installs with `sfw pnpm install --frozen-lockfile`
- [x] No `.github/dependabot.yml`; other dependency-update tools (if any) open PRs only — never auto-merge — verified on main
- [x] New direct dependencies get human review; prefer `~` ranges over `^` (this PR)

## 4. GitHub Actions
- [x] `permissions: contents: read` (or `{}` + per-job grants) on every workflow — verified on main
- [x] Every action pinned to a full commit SHA (`npx actions-up`) (#187)
- [x] Every job installs Socket Firewall (`SocketDev/action` SHA-pinned, `firewall-version` pinned); `pnpm install` / `npm install` run as `sfw pnpm install` / `sfw npm install` (#188)
- [x] `.github/workflows/check-workflows.yaml` lints workflows with zizmor on every PR (#189)
- [x] `persist-credentials: false` on checkouts that don't push (#189)
- [x] No `pull_request_target` on workflows that run untrusted PR code — verified on main
- [x] Artifact-publishing workflows disable `actions/setup-node` default caching (`package-manager-cache: false`) to prevent cache poisoning — verified on main
- [x] No npm tokens in Actions secrets — verified on main (Docker Hub and GCP deploy still use long-lived registry credentials)

## 5. npm publishing — npm libraries only
- [ ] OIDC trusted publishing configured **stage-only** on npmjs.com for the publish workflow — it can stage, never publish live (manual)
- [x] `.github/workflows/release.yaml` packs then stages with `pnpm stage publish ./packed/*.tgz --no-git-checks` (#190)
- [ ] Maintainer promotes staged versions with 2FA (manual)
- [ ] Drydock connected — staged releases reviewed before promotion (manual)
- [ ] No direct publish rights: package requires 2FA and disallows tokens (manual)
- [x] `package.json` `repository.url` accurate so provenance maps to this repo — verified on main

## 6. Security tooling
- [x] Aikido runs on every build — GitHub app scans PRs
- [x] Aikido release gate: the release workflow's stage-publish job `needs:` a passing `scan-release` (#191)
- [x] Socket reviews every PR that changes dependencies — GitHub app scans PRs

## 7. Repository lockdown
- [ ] `lockdown-repo.sh` applied; `--check` with `--required-checks` and `--allowed-actions` passes (PRs required on the default branch, merges blocked unless required status checks pass, tag ruleset, fork-PR approval, read-only workflow tokens, Actions allowlist, secret scanning, Dependabot disabled, private vulnerability reporting as applicable)
- [ ] Phishing-resistant 2FA (passkeys / hardware keys) on the GitHub and npm accounts (manual)
- [ ] Recovery codes stored offline in a password manager (manual)

## Maintainer Stage 7 (last)

Do this after #192 is on `main`. Do not run `lockdown-repo.sh` in apply mode until you have audited `--check` as a repo admin.

1. Confirm the **Aikido** and **Socket** GitHub apps (they already scan PRs). Add Actions secret `AIKIDO_CLIENT_API_KEY` from Aikido CI settings — without it, a real release fails closed at `aikido-gate`.
2. On npmjs.com for `@jaredwray/mockhttp`: trusted publisher = this repo, workflow filename `release.yaml`, environment `npm`, **stage-only**. Connect [Drydock](https://drydock.org). Require 2FA and disallow tokens.
3. Phishing-resistant 2FA (passkeys / hardware keys) on the GitHub and npm accounts. Store recovery codes offline.
4. Download [`lockdown-repo.sh`](https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth-nodejs/scripts/lockdown-repo.sh) (do not commit it here). Audit, then apply as a repo admin. Confirm check names from a green PR:

```bash
lockdown-repo.sh jaredwray/mockhttp --check \
  --required-checks "build (22),build (24),build (26),Analyze,zizmor" \
  --allowed-actions "codecov/*,peter-evans/*,google-github-actions/*,docker/*"

lockdown-repo.sh jaredwray/mockhttp \
  --required-checks "build (22),build (24),build (26),Analyze,zizmor" \
  --allowed-actions "codecov/*,peter-evans/*,google-github-actions/*,docker/*"
```

5. Recording PR: tick the lockdown item in this file and expand the `SECURITY.md` summary to the full live end-state. Tick the `(manual)` boxes yourself.
