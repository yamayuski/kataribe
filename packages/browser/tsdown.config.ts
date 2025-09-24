import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: "./src/index.ts",
    platform: "browser",
    outDir: "dist",
    clean: false,
    dts: false,
    format: ["esm"],
    minify: true,
    sourcemap: true,
    target: "es2020",
  },
]);
