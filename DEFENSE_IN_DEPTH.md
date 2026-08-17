# Defense in Depth

Tracking against https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth-nodejs/SKILL.md.

Profile: npm library · public

## 1. Security docs
- [ ] `SECURITY.md` present — contact info + "How this repository is secured" summary (PR #182 pending)
- [ ] `DEFENSE_IN_DEPTH.md` present (this file) (PR #182 pending)

## 2. CODEOWNERS and cloud bootstrap
- [ ] `.github/CODEOWNERS` covers `/.github/`, `/.cursor/`, `/.devcontainer/`, `/scripts/` with owners the maintainer names (PR #183 pending)
- [ ] Codespaces and Cursor Cloud Agents bootstrap Aikido Safe Chain via scripts/setup-cloud-environment.sh (--ci shims, frozen lockfile) (PR #184 pending)

## 3. Dependencies (pnpm)
- [ ] `packageManager: pnpm@11.3+` pinned in `package.json` (PR #185 pending)
- [x] 7-day cooldown: `minimumReleaseAge: 10080`, `minimumReleaseAgeStrict: true`, `minimumReleaseAgeIgnoreMissingTime: false` — verified on main
- [ ] Lifecycle scripts blocked: `strictDepBuilds: true`, `dangerouslyAllowAllBuilds: false`, `allowBuilds: {}` baseline (PR #186 pending)
- [x] `blockExoticSubdeps: true` — verified on main
- [x] Lockfile committed; CI installs with `pnpm install --frozen-lockfile` — verified on main
- [x] No `.github/dependabot.yml`; other dependency-update tools (if any) open PRs only — never auto-merge — verified on main
- [ ] New direct dependencies get human review; prefer `~` ranges over `^` (PR #192 pending)

## 4. GitHub Actions
- [x] `permissions: contents: read` (or `{}` + per-job grants) on every workflow — verified on main
- [ ] Every action pinned to a full commit SHA (`npx actions-up`) (PR #187 pending)
- [ ] Every job installs Socket Firewall (`SocketDev/action` SHA-pinned, `firewall-version` pinned); `pnpm install` / `npm install` run as `sfw pnpm install` / `sfw npm install` (PR #188 pending)
- [ ] `.github/workflows/check-workflows.yaml` lints workflows with zizmor on every PR (PR #189 pending)
- [ ] `persist-credentials: false` on checkouts that don't push (PR #189 pending)
- [x] No `pull_request_target` on workflows that run untrusted PR code — verified on main
- [x] Artifact-publishing workflows disable `actions/setup-node` default caching (`package-manager-cache: false`) to prevent cache poisoning — verified on main
- [x] No npm tokens (or other registry credentials) in Actions secrets — verified on main

## 5. npm publishing — npm libraries only
- [ ] OIDC trusted publishing configured **stage-only** on npmjs.com for the publish workflow — it can stage, never publish live (manual)
- [ ] `.github/workflows/release.yaml` packs then stages with `pnpm stage publish ./packed/*.tgz --no-git-checks` (PR #190 pending)
- [ ] Maintainer promotes staged versions with 2FA (manual)
- [ ] Drydock connected — staged releases reviewed before promotion (manual)
- [ ] No direct publish rights: package requires 2FA and disallows tokens (manual)
- [x] `package.json` `repository.url` accurate so provenance maps to this repo — verified on main

## 6. Security tooling
- [x] Aikido runs on every build — verified on PRs (GitHub app)
- [ ] Aikido release gate: the release workflow's stage-publish job `needs:` a passing `scan-release` (PR #191 pending)
- [x] Socket reviews every PR that changes dependencies — verified on PRs (GitHub app)

## 7. Repository lockdown
- [ ] `lockdown-repo.sh` applied; `--check` with `--required-checks` and `--allowed-actions` passes (PRs required on the default branch, merges blocked unless required status checks pass, tag ruleset, fork-PR approval, read-only workflow tokens, Actions allowlist, secret scanning, Dependabot disabled, private vulnerability reporting as applicable)
- [ ] Phishing-resistant 2FA (passkeys / hardware keys) on the GitHub and npm accounts (manual)
- [ ] Recovery codes stored offline in a password manager (manual)

## Maintainer Stage 7 (last)

Do this only after PRs #182–#191 are on `main`. This agent did not apply GitHub settings (`lockdown-repo.sh --check` on 2026-08-17: not a repo admin; CODEOWNERS is not on `main` yet; 10 settings not in the desired state).

1. The **Aikido** and **Socket** GitHub apps are already on this repo. Add Actions secret `AIKIDO_CLIENT_API_KEY` from Aikido CI settings (needed by the release-gate job in #191).
2. On npmjs.com for `@jaredwray/mockhttp`: trusted publisher = this repo, workflow filename `release.yaml`, environment `npm`, **stage-only**. Connect [Drydock](https://drydock.org). Require 2FA and disallow tokens.
3. Phishing-resistant 2FA (passkeys / hardware keys) on the GitHub and npm accounts. Store recovery codes offline.
4. Download [`lockdown-repo.sh`](https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth-nodejs/scripts/lockdown-repo.sh) (do not commit it here). Audit, then apply as a repo admin. Confirm check names from a green PR after this stack lands:

```bash
lockdown-repo.sh jaredwray/mockhttp --check \
  --required-checks "build (22),build (24),build (26),Analyze,zizmor" \
  --allowed-actions "codecov/*,peter-evans/*,google-github-actions/*,docker/*"

lockdown-repo.sh jaredwray/mockhttp \
  --required-checks "build (22),build (24),build (26),Analyze,zizmor" \
  --allowed-actions "codecov/*,peter-evans/*,google-github-actions/*,docker/*"
```

5. Recording PR: tick the lockdown item in this file and expand the `SECURITY.md` summary to the full live end-state. Tick the `(manual)` boxes yourself.
