#!/usr/bin/env node
// Entry point for the `ff` binary. We run under tsx (not node's native type
// stripping) because the CLI imports workspace TypeScript packages, and Node
// refuses to strip types for files under node_modules. tsx transpiles those.
// We register both loaders: ESM for our own code, CJS for the workspace
// libraries (shopify-admin-client et al.) which are published as CommonJS.
import {register as registerEsm} from "tsx/esm/api";
import {register as registerCjs} from "tsx/cjs/api";

registerCjs();
registerEsm();
await import("./index.ts");
