# Contributing to Kataribe

Thanks for your interest in contributing! This document explains how to set up
your environment, propose changes, report issues, and open pull requests for the
Kataribe monorepo.

Please read and follow the Code of Conduct. By participating, you agree to abide
by it.

- Code of Conduct: ./CODE_OF_CONDUCT.md
- Security Policy: ./SECURITY.md

## Repository overview

Kataribe is a TypeScript monorepo that implements bidirectional RPC and events
over WebSocket (and more) with a type-safe unknown-only envelope.

Top-level layout:

- packages/
  - core/ — Types, runtime, utilities (the foundation)
  - browser/ — Browser transports (WebSocket, WebRTC)
  - nodejs/ — Node.js transports (WebSocket, WebRTC)
  - deno/ — Deno transports (WebSocket, WebTransport)
  - bun/ — Bun transports (WebSocket)
  - cloudflare/ — Cloudflare Workers transports (WebSocket/DO)
  - internal/ — Test helpers and internal utilities (not published)
- examples/ — Minimal runnable examples for Node.js, Deno, Bun, and browser

Key characteristics:

- Language: TypeScript (strict, no any — unknown only)
- Package manager: pnpm
- Lint/format: Biome
- Tests: Vitest (majority), Bun Test (Bun), Deno Test (Deno)
- Build: tsdown/tsc/bun/deno depending on package

## Prerequisites

- Node.js >= 22
- pnpm >= 10.17.1
- Optional for runtime-specific tests/examples:
  - Deno (for packages/deno and examples/deno-ws)
  - Bun (for packages/bun and examples/bun-ws)
  - A browser or static server (for examples/browser-client)

Note: The repository enforces pnpm via a preinstall hook. If npm/yarn is used,
installation will fail on purpose.

## Quick start

1. Fork and clone the repository.

2. Install dependencies at the repo root:

```
pnpm i
```

3. Sanity checks (format, lint, type hints as configured by Biome CI):

```
pnpm check
```

4. Build all packages:

```
pnpm build
```

5. Run tests for all packages that define them:

```
pnpm test
```

## Developing and running examples

From the repository root you can run the example servers/clients:

- Node.js WebSocket (two terminals):
  - Server:
    ```
    pnpm dev:server
    ```
  - Client:
    ```
    pnpm dev:client
    ```
- Deno WebSocket:
  ```
  pnpm dev:deno
  ```
- Bun WebSocket:
  ```
  pnpm dev:bun
  ```
- Browser client: serve examples/browser-client/index.html via any static
  server.

Each package may also be developed and tested in isolation by running commands
from within its directory; consult the package-specific README where available.

## Scripts and tooling

- Install: `pnpm i`
- Clean: handled by `prebuild` (rimraf dist)
- Build: `pnpm build` (builds @kataribe/core first, then others in parallel)
- Test: `pnpm test` (runs tests in all packages that define them)
- Format (write): `pnpm format` (Biome — auto-fixes and organizes imports)
- Lint (no write): `pnpm lint`
- CI check (no write): `pnpm check`
- Publish (maintainers):
  - JS Runtime (JSR): `pnpm publish:jsr` (core/browser/deno)
  - npm publishing is handled via Changesets: see below

## Code style and conventions

TypeScript:

- Strict typing, no `any`. Prefer `unknown` with proper narrowing.
- Use meaningful generic names (Req, Res, Payload, etc.).
- Prefer `interface` for object shapes; use `type` for unions/compositions.
- Use `as const` for literal types where appropriate.
- Keep imports explicit; Biome will organize imports for you.

Protocol and runtime:

- All communication uses the envelope shape
  `{ v, ts, id?, kind, ch?, p?, m?, code?, meta?, feat? }`.
- Contracts are defined via the DSL (e.g., `defineContract`, `rpc`, `event`).

Tests:

- Prefer Vitest for Node/Browser packages; Deno/Bun packages use their native
  test runners.
- Include both a happy path and at least one edge case.

Docs:

- Update README in the affected package if public behavior changes.
- Keep examples working when you change public APIs.

## Branches, commits, and PRs

- Create a feature branch from `main` for your work.
- Keep changes focused and reasonably small; split large efforts into
  incremental PRs.
- Commit style: Conventional Commits are welcome but not required. Changesets
  (see next section) drive versioning.
- Open a Draft PR early if you want feedback; mark Ready for Review when stable.

### Pull Request Checklist

Before requesting review, please ensure:

- [ ] Code compiles and builds: `pnpm build`
- [ ] Tests pass locally: `pnpm test`
- [ ] Lint/format is clean: `pnpm check` (and/or `pnpm format`)
- [ ] Relevant tests added/updated (happy path + edge cases)
- [ ] Package README/docs updated if public behavior changed
- [ ] A Changeset added if the change affects published packages (see below)

## Versioning and releases (Changesets)

This repo uses Changesets for versioning and publishing. When your change
affects a published package (anything under `packages/` except internal/testing
utilities and examples), please add a changeset:

```
pnpm exec changeset
```

Guidance on bump types:

- patch: bug fixes, refactors without API changes, internal improvements
- minor: backward-compatible feature additions or deprecations
- major: breaking changes to public APIs

Notes:

- The base branch is `main`.
- Example packages are ignored for release (`@kataribe/examples*`).
- Maintainers will run `pnpm exec changeset version` and
  `pnpm exec changeset publish` (or CI equivalents) when cutting a release.

## Filing issues and feature requests

Before opening a new issue, please:

1. Search existing issues to avoid duplicates.
2. Provide clear reproduction steps and minimal code snippets where possible.
3. Include environment details (OS, Node version, browser, Deno/Bun versions if
   relevant).

For feature requests, describe the problem you’re trying to solve, not just the
desired API. If you can, outline a small contract snippet or example to
illustrate the use case.

## Security

Please do not open security issues publicly. See ./SECURITY.md for how to report
vulnerabilities.

## License and IP

This project is licensed under the MIT License. By contributing, you agree that
your contributions will be licensed under the MIT License.

## Maintainers’ notes (advanced)

- CI typically runs Biome checks and builds using a current Node LTS (e.g.,
  Node 24) while local development targets Node >= 22.
- Package build outputs differ by target:
  - core/nodejs: CJS and/or ESM plus type declarations (tsdown)
  - browser: ESM + types (tsdown)
  - deno: source-only (Deno native) with declarations as needed
  - bun: `bun build` + `tsc --emitDeclarationOnly`
  - cloudflare: `wrangler types` + `tsc` declarations
- Refer to each package’s README for transport-specific details (WebSocket,
  WebRTC, WebTransport).

Thank you for contributing to Kataribe! Your improvements help make the library
more robust across runtimes and transports.
