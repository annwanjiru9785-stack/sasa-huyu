---
name: rsbuild HMR infinite loop causing stuck Suspense
description: When rsbuild continuously rebuilds a lazy-loaded chunk, React.lazy() suspends on every rebuild and the parent Suspense boundary shows its fallback forever — fix by making it a static import.
---

## The rule
If a component is wrapped in `React.lazy()` AND rsbuild keeps rebuilding its chunk in an HMR loop, the parent `Suspense` will show its fallback indefinitely because every rebuild invalidates the lazy module and throws a new Promise.

**Fix:** Import the component directly (static `import`) instead of via `React.lazy()`. React Fast Refresh will then hot-update it in-place without triggering Suspense.

**Why:** rsbuild (rspack) in dev mode rebuilds lazy chunks whenever any dependency in their graph changes or when the browser requests them repeatedly. Each rebuild invalidates the React.lazy() cache, causing a new Promise to be thrown upward into the nearest Suspense boundary.

**How to apply:** In this project, `AppRoot` was lazy-loaded inside the same `Suspense` that shows "Please wait while we connect to the server...". The fix was to change `App.tsx` from `const AppRoot = lazy(() => import('./app-root'))` to a static `import AppRoot from './app-root'`. `AppContent` (inside AppRoot) retains its own inner Suspense with a separate fallback ("Loading...").
