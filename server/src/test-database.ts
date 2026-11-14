export function isIsolatedTestDatabase(value = process.env.DATABASE_URL): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "postgresql:" && url.hostname === "127.0.0.1" && url.port === "5433" && url.pathname === "/eventcheck_test";
  } catch { return false; }
}
