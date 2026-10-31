// Service worker registration is intentionally a no-op. The app is a
// gallery-style display that always lives online, and the previous SW
// implementation caused stale-cache black screens on every redeploy
// (cached index.html pointed at the previous build's hashed assets).
// For a freshly served app the user always sees the latest build; for
// an app loaded with a previously installed SW, the browser will keep
// using it until the user clears site data. We avoid registering a new
// one to prevent yet another round of stale cache from taking effect.
export function registerServiceWorker(): void {
  // no-op
}
