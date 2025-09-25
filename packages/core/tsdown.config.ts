import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: "./src/index.ts",
    platform: "node",
    outDir: "dist",
    clean: true,
    dts: true,
    format: ["commonjs"],
    minify: true,
    sourcemap: true,
  },
  {
    entry: "./src/index.ts",
    platform: "browser",
    outDir: "dist",
    clean: false,
    dts: false,
    format: ["esm"],
    minify: true,
    sourcemap: true,
  },
]);
