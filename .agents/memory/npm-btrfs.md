---
name: npm ENOTEMPTY btrfs corruption
description: npm install race condition on btrfs corrupts node_modules; workaround pattern
---

npm install on btrfs (Replit's filesystem) hits ENOTEMPTY race conditions that silently delete package.json files from installed packages (110-200 packages affected per install).

**Why:** btrfs atomic rename behavior differs from ext4; npm's extract+rename pattern races.

**How to apply:**
- Pre-download critical package tarballs to /tmp before any npm install
- After any npm install, verify key packages still have package.json: `ls node_modules/vite/package.json`
- Restore corrupted packages from /tmp tarballs: `mkdir -p node_modules/PKG && cp -r /tmp/PKGpkg/package/* node_modules/PKG/`
- Tarballs stored in /tmp: vite5pkg (Vite 5.4.19), plugin-react4pkg, esbuild021pkg, rollup4pkg, rxjs.tgz
- Use `--no-save --legacy-peer-deps --no-fund` flags to minimize npm churn
