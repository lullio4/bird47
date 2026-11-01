// Build the deployable single-file server artifact (root index.js) from server/src.
import { build } from "esbuild";

await build({
  entryPoints: ["server/index.js"],
  bundle: true,
  platform: "node",
  target: "node18",
  outfile: "index.js",
  banner: { js: "#!/usr/bin/env node" },
  // optional dependency: only loaded if ptStorage backend is selected
  external: ["protectedtext-api"],
  legalComments: "none",
  logLevel: "info",
});
console.log("build complete → index.js");
