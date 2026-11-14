import { FormEvent, useEffect, useState } from "react";

type User = {
  id: string;
  displayName: string;
  role: "PARTICIPANT" | "ORGANIZER";
};

const isUser = (value: unknown): value is User => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.displayName === "string" &&
    (candidate.role === "PARTICIPANT" || candidate.role === "ORGANIZER")
  );
};

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Loading…");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetch("/api/v1/me", { credentials: "include" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((body) => {
        const next = body?.data?.user;
        setUser(isUser(next) ? next : null);
        setMessage(isUser(next) ? "Signed in" : "Sign in");
      })
      .catch(() => {
        setUser(null);
        setMessage("Sign in");
      });
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;

    const values = new FormData(event.currentTarget as HTMLFormElement);
    setBusy(true);
    setMessage("Signing in…");

    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginIdentifier: String(values.get("loginIdentifier") ?? loginIdentifier),
          password: String(values.get("password") ?? password),
        }),
      });
      const body = await response.json().catch(() => null);
      const next = body?.data?.user;

      if (!response.ok || !isUser(next)) {
        setMessage("Invalid credentials");
        return;
      }

      setUser(next);
      setPassword("");
      setShowPassword(false);
      setMessage("Signed in");
    } catch {
      setMessage("Unable to sign in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (busy) return;
    setBusy(true);
    setMessage("Signing out…");

    try {
      const response = await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        setMessage("Unable to sign out. Try again.");
        return;
      }
      setUser(null);
      setMessage("Signed out");
    } catch {
      setMessage("Unable to sign out. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    return (
      <main className="app-shell authenticated-shell">
        <header className="topbar">
          <a className="brand" href="/" aria-label="EventCheck home">
            <span className="brand-mark" aria-hidden="true">✦</span>
            EventCheck
          </a>
          <div className="topbar-actions">
            <span className="role-chip">{user.role}</span>
            <button className="button button-secondary nav-logout" onClick={logout} disabled={busy}>
              {busy ? "Signing out…" : "Log out"}
            </button>
          </div>
        </header>
        <section className="welcome-panel">
          <div>
            <p className="eyebrow">Your event space</p>
            <h1>Welcome, {user.displayName}</h1>
            <p className="lede">You’re signed in and ready to discover what’s happening next.</p>
            <p role="status" aria-live="polite" className="status-text">{message}</p>
          </div>
        </section>
        <section className="future-card">
          <span className="calendar-icon" aria-hidden="true">◷</span>
          <div>
            <h2>Your events are coming soon</h2>
            <p>Event discovery and attendance tools will appear here in the next Sprint.</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <div className="ambient-shape ambient-shape-one" aria-hidden="true" />
      <div className="ambient-shape ambient-shape-two" aria-hidden="true" />
      <section className="login-card" aria-labelledby="login-heading">
        <a className="brand" href="/" aria-label="EventCheck home">
          <span className="brand-mark" aria-hidden="true">✦</span>
          EventCheck
        </a>
        <div className="card-heading">
          <p className="eyebrow">Welcome back</p>
          <h1 id="login-heading">Let’s get you there.</h1>
          <p className="card-intro">Sign in to continue to EventCheck.</p>
        </div>
        <form onSubmit={submit} aria-label="Login" className="login-form">
          <label htmlFor="loginIdentifier">
            Login identifier
            <input id="loginIdentifier" name="loginIdentifier" value={loginIdentifier} onChange={(event) => setLoginIdentifier(event.target.value)} autoComplete="username" disabled={busy} />
          </label>
          <label className="password-label" htmlFor="password">Password</label>
          <span className="password-field">
            <input id="password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" disabled={busy} />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} disabled={busy}>
              <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d={showPassword ? "M2.7 4.7 19.3 21.3M9.9 9.9a3 3 0 0 0 4.2 4.2M6.7 6.7C4.1 8.5 2.5 11 2 12c1.3 2.6 4.8 7 10 7 1.5 0 2.9-.4 4.1-1M10.1 5.1C10.7 5 11.3 5 12 5c5.2 0 8.7 4.4 10 7-.4.8-1.3 2.2-2.6 3.5" : "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"} /></svg>
            </button>
          </span>
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Log in"}<span aria-hidden="true">→</span>
          </button>
        </form>
        <p role="status" aria-live="polite" className="status-text">{message}</p>
        <p className="privacy-note">Your account is protected with secure server-side sessions.</p>
      </section>
    </main>
  );
}
