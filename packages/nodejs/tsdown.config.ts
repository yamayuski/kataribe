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
]);
