# Copilot Instructions for Kataribe

このドキュメントは、GitHub Copilot コーディングエージェントが monorepo 化された
「kataribe」リポジトリで作業する際のガイドです。現行のディレクトリ構成、ビルド、
スクリプト、テスト戦略に合わせて記載しています。

## リポジトリ概要

Kataribe は、型安全な unknown-only のエンベロープを使ってクライアント↔サーバーの
双方向 RPC とイベント配信を行うライブラリです。monorepo として複数のランタイム
ターゲット（Browser / Node.js / Deno / Bun / Cloudflare
Workers）をサポートします。

### 主な特徴

- 単一のエンベローププロトコルによる双方向 RPC（Client→Server / Server→Client）
- Fire-and-forget イベント
- コントラクト DSL（任意でランタイムバリデータを併用可能）
- in/out ミドルウェア（認可、トレース、圧縮などのフック）
- ソースコードは any 不使用・unknown ベースの厳格な型付け
- トランスポート: WebSocket
  を中心に、WebRTC（Browser/Node）、WebTransport（Deno）

## 技術スタック

- 言語: TypeScript（strict, any 不使用）
- 実行環境: Node.js >= 22（開発・ビルド）
- パッケージマネージャ: pnpm
- ビルド: tsdown（主要パッケージ）、tsc（型定義）、bun build（Bun パッケージ）、
  Deno ネイティブ（Deno パッケージ）
- 品質: Biome（lint/format/CI）
- テスト: Vitest（多くのパッケージ）、Bun Test（Bun）、Deno Test（Deno）

## モノレポの構成

```
/                          # ルート（pnpm ワークスペース）
├─ packages/
│  ├─ core/               # 型/ランタイム中核（types, runtime, utils）
│  ├─ browser/            # ブラウザ向け（WS, WebRTC）
│  ├─ nodejs/             # Node.js 向け（WS, WebRTC）
│  ├─ deno/               # Deno 向け（WS, WebTransport）
│  ├─ bun/                # Bun 向け（WS）
│  ├─ cloudflare/         # Cloudflare Workers 向け（WS/DO）
│  └─ internal/           # テスト支援・内部ユーティリティ
├─ examples/
│  ├─ nodejs-ws/          # Node.js WS サーバ/クライアント例
│  ├─ deno-ws/            # Deno WS サーバ例
│  ├─ bun-ws/             # Bun WS サーバ例
│  ├─ browser-client/     # ブラウザクライアント例（静的 HTML）
│  └─ shared/             # 例で共有するコントラクト
├─ biome.json
├─ package.json
├─ pnpm-workspace.yaml
└─ tsconfig.json
```

参考: 中核ファイルは `packages/core/src/` 配下（`index.ts`, `runtime.ts`,
`types.ts`, `utils.ts`）。各ランタイム実装は各パッケージの `src/` 配下にあります
（例: `packages/browser/src/ws`, `packages/nodejs/src/ws`,
`packages/browser/src/webrtc`, `packages/deno/src/wt` など）。

## ルートスクリプト（pnpm）

`package.json` の主要スクリプト（ルートから実行）:

- `pnpm build` — まず `@kataribe/core`
  をビルドし、その後他パッケージを並列ビルド
- `pnpm test` — 各パッケージのテストを並列実行（存在するもののみ）
- `pnpm format` — Biome によるフォーマット（自動修正）
- `pnpm lint` — Biome による Lint
- `pnpm check` — Biome CI チェック
- 開発用例:
  - `pnpm dev:server` — `examples/nodejs-ws/server.ts`
  - `pnpm dev:client` — `examples/nodejs-ws/client.ts`
  - `pnpm dev:deno` — `examples/deno-ws/server.ts`
  - `pnpm dev:bun` — `examples/bun-ws/server.ts`

その他:

- `preinstall` で `only-allow pnpm` を使用
- `publish:jsr` — `@kataribe/core`, `@kataribe/browser`, `@kataribe/deno` を JSR
  公開
- Changesets によるバージョン管理/公開補助（`ci:version`, `ci:publish`）

エンジン制約: Node >= 22、pnpm >= 10.17.1

## パッケージごとのビルド/出力/テスト概要

- `@kataribe/core`
  - ビルド: tsdown
  - 出力: CJS `dist/index.cjs`, ESM `dist/index.js`, 型 `dist/index.d.cts`
  - テスト: Vitest

- `@kataribe/browser`
  - ビルド: tsdown
  - 出力: ESM `dist/index.js`, 型 `dist/index.d.ts`
  - テスト: Vitest（jsdom）

- `@kataribe/nodejs`
  - ビルド: tsdown
  - 出力: CJS `dist/index.cjs`, 型 `dist/index.d.cts`
  - テスト: Vitest

- `@kataribe/deno`
  - ビルド: 生成物なし（Deno ネイティブを想定）
  - 出力: ソース（`src/`）+ 型（宣言のみ必要時）
  - テスト: `deno test`（WS、WebTransport 実装あり）

- `@kataribe/bun`
  - ビルド: `bun build` + `tsc --emitDeclarationOnly`
  - 出力: `dist/index.js`, 型 `dist/index.d.ts`
  - テスト: Bun Test

- `@kataribe/cloudflare`
  - ビルド: `wrangler types` で環境型生成 + `tsc` で型定義出力
  - 出力: `src/`（実装はソース参照）, 型 `dist/index.d.ts`
  - テスト: Vitest

- `@kataribe/internal`
  - テスト補助/モックなど（ビルド/配布対象外）

注: 旧 UMD バンドルはありません。パッケージごとに ESM/CJS/型の構成が異なります。

## アーキテクチャ（要点）

1. エンベローププロトコル
   - 形: `{ v, ts, id?, kind, ch?, p?, m?, code?, meta?, feat? }`
   - 種別: `rpc_req`, `rpc_res`, `rpc_err`, `event`, `hello`
2. コントラクト DSL
   - 例:
     ```ts
     const contract = defineContract({
       rpcToServer: { method: rpc<Req, Res>() },
       rpcToClient: { method: rpc<Req, Res>() },
       events: { event: event<Payload>() },
     });
     ```
3. ランタイム（`@kataribe/core`）
   - 送受信、ミドルウェア、ID 生成、ロギングなど
4. トランスポート
   - Browser/Node: WebSocket, WebRTC（DataChannel）
   - Deno: WebSocket, WebTransport

### 型安全のガイドライン

- any を使わず unknown と厳格なジェネリクスで表現
- 可能ならランタイムバリデーションを併用
- すべての通信はエンベロープ型で表現

## コーディング規約

- Biome
  によるフォーマット/リンティング（`pnpm format`/`pnpm lint`/`pnpm check`）
- TypeScript 慣習
  - オブジェクトは `interface`、合成/ユニオンは `type`
  - リテラルは `as const` を活用
  - ジェネリクスは意味のある名前（`Req`, `Res`, `Payload`）
  - 明示的な import/export を推奨

## 例と手動テスト

- Node.js WebSocket（2 ターミナル）
  - サーバ: `pnpm dev:server`
  - クライアント: `pnpm dev:client`
- Deno WebSocket: `pnpm dev:deno`
- Bun WebSocket: `pnpm dev:bun`
- Browser クライアント: `examples/browser-client/index.html` を静的サーバで配信
  （任意の静的サーバで OK）

## 作業の進め方（推奨）

1. 依存関係のインストール: `pnpm i`
2. 事前チェック: `pnpm check`
3. 実装/修正 → `pnpm format` / `pnpm lint`
4. ビルド: `pnpm build`
5. テスト: `pnpm test`（必要に応じて各パッケージで）

プッシュ前チェック: 必ず `pnpm check` を実行し、CI 体裁を満たすこと。

## CI/CD（概略）

- Node 24 系での動作確認
- Biome CI（`pnpm check`）
- ビルド検証（`pnpm build`）

## トラブルシューティング

- ビルド失敗: 各パッケージのビルド方法に注意（tsdown / tsc / bun / Deno）。
- フォーマット/Lint: `pnpm format` / `pnpm lint` を実行。
- 依存解決: pnpm ワークスペースのリンク状態を確認。
- 型エラー: any を使わず unknown を活用、ジェネリクス制約を見直す。

## ロードマップ（抜粋）

- WebRTC DataChannel 既実装（Browser/Node）
- Deno WebTransport 実装あり
- 追加トランスポート（HTTP/2 等）
- ストリーム RPC、RPC キャンセル、スキーマ統合（zod/valibot）
- 再接続/セッション再開、暗号化/圧縮の例
