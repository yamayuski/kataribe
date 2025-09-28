# @kataribe/internal

`@kataribe/internal` houses non-public helpers shared across the Kataribe
monorepo. The package is marked private and is used to support tests, examples,
and other development tooling.

## Contents

- `MockTransport` — a lightweight in-memory `Transport` implementation for unit
  tests
- `MockWebSocket` — a WebSocket shim for exercising runtime behaviour without a
  network stack

Because the package is private, it is not published to npm or JSR. Local
consumers inside the repository can import from `@kataribe/internal` via
workspace references.
