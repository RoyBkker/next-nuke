import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  // CLI app, not a library — no consumer imports its types, so skip .d.ts
  // (also avoids coupling the build to the TS 7 native compiler's dts pipeline).
  dts: false,
  clean: true,
  minify: false,
  sourcemap: false,
  // src/index.ts starts with a shebang; tsup preserves it. Make the output
  // executable so `npm link` / direct invocation works even before npm sets +x.
  onSuccess: "chmod +x dist/index.js",
});
