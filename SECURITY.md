# Security Policy

We take security seriously and work to keep this project up to date. If you discover a security vulnerability, please report it **privately** so we can investigate and ship a fix before the issue becomes public.

## Reporting a vulnerability

Please use one of the following private channels — **do not open a public issue, pull request, or discussion** for security concerns:

1. **Preferred:** open a private report via GitHub's [Privately reporting a security vulnerability](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) flow on this repository's **Security** tab.
2. **Email:** send the details to me@jaredwray.com. If the issue is urgent, include `[SECURITY]` in the subject line and we will respond as soon as possible.

When reporting, please include as much of the following as you can:

- A description of the vulnerability and its impact.
- Steps to reproduce, or a proof-of-concept.
- The affected version(s) and platform.
- Any suggested remediation, if you have one.

We will acknowledge receipt, work with you on a coordinated disclosure timeline, and credit you in the advisory once a fix is published unless you ask to remain anonymous.

## How this repository is secured

This repository follows the [defense-in-depth](https://github.com/jaredwray/agentic/blob/main/skills/security/defense-in-depth-nodejs/SKILL.md)
hardening checklist; progress is tracked in [DEFENSE_IN_DEPTH.md](./DEFENSE_IN_DEPTH.md). Measures currently in place:

- All changes land through pull requests — direct pushes to `main` are blocked, and merging requires passing status checks (`build (22)`, `build (24)`, `build (26)`, `Analyze (javascript)`, `zizmor`).
- Tags (and therefore releases) can only be created by repository admins.
- Workflow runs from outside collaborators always require maintainer approval, and only allowlisted GitHub Actions can run.
- CI runs with read-only default workflow tokens; every action is pinned to a full commit SHA; Socket Firewall (`sfw`) wraps `pnpm install`; workflows are security-linted with zizmor on every PR.
- Codespaces and Cursor Cloud Agents install through Aikido Safe Chain; package-manager shims must not be bypassed.
- Dependencies install through pnpm with a 7-day cooldown on new versions, lifecycle scripts blocked by default, and `trustPolicy: no-downgrade`. CI installs with `--frozen-lockfile`. Socket reviews every dependency change; Aikido scans every build. Releases are gated on Aikido `scan-release` (`AIKIDO_CLIENT_API_KEY`; scan only, no publish rights).
- High-risk paths (`.github/`, `.cursor/`, `.devcontainer/`, `scripts/`) are owned in `.github/CODEOWNERS`.
- npm releases are packed and staged via OIDC trusted publishing. There are no npm tokens. Drydock review and stage-only registry settings on npmjs.com are remaining maintainer steps.
- Secret scanning and push protection are enabled. Private vulnerability reporting is enabled. Dependabot is off.
