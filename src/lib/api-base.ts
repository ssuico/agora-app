/**
 * Resolve the backend API base URL for Astro proxy routes.
 *
 * In development, API_URL points to the separate Express dev server.
 * In production (monorepo), Express and Astro share the same process,
 * so we fall back to http://localhost:PORT.
 */
export function getApiBase(): string {
  // Prefer explicit env var (set in .env for dev, optional in prod)
  const explicit = import.meta.env.API_URL;
  if (explicit) return explicit;

  // Monorepo production: same server, use localhost
  const port = process.env.PORT || 3001;
  return `http://localhost:${port}`;
}
