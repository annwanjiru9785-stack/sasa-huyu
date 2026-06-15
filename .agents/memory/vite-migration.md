---
name: Vite migration from rsbuild
description: Why rsbuild was replaced with Vite 5 and how the config was set up
---

rspack and rolldown use native .node binaries that crash with Bus error on NixOS/btrfs (Replit's environment). Must use Vite 5 (not Vite 8 which uses rolldown) with esbuild 0.21.5 + rollup 4.x.

**Why:** NixOS uses a patched glibc path; native binaries compiled for standard Linux fail.

**How to apply:** 
- vite.config.ts replaces rsbuild.config.ts
- Dev Server workflow: `node node_modules/vite/bin/vite.js --config vite.config.ts`
- index.html needs `<script type="module" src="/src/main.tsx">` (Vite doesn't auto-inject like rsbuild)
- Set `optimizeDeps.esbuildOptions.target: 'es2020'` to handle modern syntax in node_modules
- esbuild target set to 'esnext' in build config to avoid destructuring transform errors
