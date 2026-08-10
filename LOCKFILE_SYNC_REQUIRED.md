# ⚠️ LOCKFILE SYNCHRONIZATION REQUIRED

## Current State

✅ **Code Implementation Complete:**
- QR game modes (silentfilms, drawguess) fully implemented with 100 questions
- QRDisplay.tsx component with local QR generation  
- Timer persistence with lifecycle safety
- Official logo branding and all gameplay features
- Source code production-ready

❌ **Build Blocked:**
- `package.json` contains `qrcode: ^1.5.3`
- `package-lock.json` does NOT contain qrcode or its transitive dependencies
- `npm ci` will fail: "npm ci can only install packages when package.json and package-lock.json are in sync"

## Required Action

**On a machine with Node.js and npm installed, run:**

```bash
cd [repository-root]
npm install qrcode@^1.5.3 --save
```

This will:
1. Install qrcode@1.5.3
2. Resolve and install all transitive dependencies:
   - dijkstrajs@1.0.1
   - encode-utf8@1.0.3
   - pngjs@5.0.0
   - yargs@15.4.1
   - And their dependencies (y18n, cliui, get-caller-file, require-directory, string-width, etc.)
3. Generate a complete, valid `package-lock.json`

## Verification Steps

After running `npm install qrcode@^1.5.3 --save`:

```bash
npm ci
npm run build
```

Both commands must succeed.

## Why This Is Required

- Cloudflare Pages runs `npm ci` (clean install from lockfile)
- `npm ci` does NOT regenerate the lockfile — it uses the existing one
- A valid, complete lockfile with all dependencies is mandatory for CI/CD
- Manual lockfile construction is error-prone without npm's dependency resolution

## Context

- No Node.js/npm available in CLI build environment
- All source code is complete and correct
- Only dependency management blocking deployment
- Once lockfile is regenerated, no further code changes needed
