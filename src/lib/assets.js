// Resolves a public/ asset path against the app's base URL. On GitHub Pages
// the site lives under /fitness-website/, so hardcoded "/foo.png" paths 404 —
// always go through this helper for anything in public/.
export function asset(path) {
  return import.meta.env.BASE_URL + path.replace(/^\//, '')
}
