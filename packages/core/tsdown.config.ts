import { defineConfig } from "tsdown";

export default defineConfig([
  {
  entry: "./src/index.ts",
  platform: "node",
  outDir: "dist",
  clean: true,
  dts: true,
  format: [
    "commonjs",
  ],
  minify: true,
  sourcemap: true,
  target: "node",
  },
  {
  entry: "./src/index.ts",
  platform: "browser",
  outDir: "dist",
  clean: false,
  dts: false,
  format: [
    "esm",
  ],
  minify: true,
  sourcemap: true,
  target: "es2020",
  },
]);
