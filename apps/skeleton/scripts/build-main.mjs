import * as esbuild from "esbuild";

const ESM_BANNER = `import { createRequire as __createRequire } from "module";
import { fileURLToPath as __fileURLToPath } from "url";
import { dirname as __dirname_fn } from "path";
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __dirname_fn(__filename);`;

const shared = {
	bundle: true,
	platform: "node",
	target: "node20",
	format: "esm",
	external: ["electron"],
	sourcemap: true,
	logLevel: "info",
	banner: { js: ESM_BANNER },
};

// Build main process
await esbuild.build({
	...shared,
	entryPoints: ["src/main/index.ts"],
	outfile: "dist/main/index.mjs",
});

// Build preload script
await esbuild.build({
	...shared,
	entryPoints: ["src/preload/index.ts"],
	outfile: "dist/preload/index.js",
	// Preload runs in renderer context but needs node APIs
	platform: "node",
});

console.log("Main + preload built successfully.");
