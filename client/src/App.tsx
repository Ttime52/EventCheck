import { FormEvent, useEffect, useState } from "react";

type User = {
  id: string;
  displayName: string;
  role: "PARTICIPANT" | "ORGANIZER";
};

type PublishedEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  capacity: number;
  publicationState: "PUBLISHED";
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

const isPublishedEvent = (value: unknown): value is PublishedEvent => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.location === "string" &&
    typeof candidate.startAt === "string" &&
    typeof candidate.endAt === "string" &&
    typeof candidate.capacity === "number" &&
    candidate.publicationState === "PUBLISHED"
  );
};

function toBangkokIso(value: string) {
  if (!value) return value;
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const parsed = new Date(`${withSeconds}+07:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function formatBangkokDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

function validationDetails(body: unknown) {
  const details = (body as { error?: { details?: unknown } } | null)?.error?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(
    details.flatMap((detail) => {
      if (!detail || typeof detail !== "object") return [];
      const item = detail as { field?: unknown; message?: unknown };
      return typeof item.field === "string" && typeof item.message === "string" ? [[item.field, item.message]] : [];
    }),
  );
}

function errorMessage(body: unknown, fallback: string) {
  const message = (body as { error?: { message?: unknown } } | null)?.error?.message;
  return typeof message === "string" ? message : fallback;
}

type EventDetailViewProps = {
  event: PublishedEvent | null;
  loading: boolean;
  message: string;
  onBack: () => void;
};

function EventDetailView({ event, loading, message, onBack }: EventDetailViewProps) {
  return (
    <section className="event-detail-page" aria-labelledby="event-detail-page-heading">
      <button type="button" className="back-button" onClick={onBack}>Back to Your events</button>
      <div className="section-heading">
        <p className="eyebrow">Owned event</p>
        <h2 id="event-detail-page-heading">Event details</h2>
        <p className="section-intro">Published event details are read-only in Sprint 1.</p>
      </div>
      {loading ? <p className="detail-status" role="status">Loading event details...</p> : event ? (
        <form className="event-detail-form" aria-label="Event details" onSubmit={(formEvent) => formEvent.preventDefault()}>
          <label htmlFor="detail-title">
            Title
            <input id="detail-title" value={event.title} readOnly />
          </label>
          <label htmlFor="detail-description">
            Description
            <textarea id="detail-description" value={event.description} readOnly />
          </label>
          <label htmlFor="detail-location">
            Location
            <input id="detail-location" value={event.location} readOnly />
          </label>
          <div className="event-date-grid">
            <label htmlFor="detail-start">
              Start date and time — Asia/Bangkok (UTC+7)
              <input id="detail-start" value={formatBangkokDate(event.startAt)} readOnly />
            </label>
            <label htmlFor="detail-end">
              End date and time — Asia/Bangkok (UTC+7)
              <input id="detail-end" value={formatBangkokDate(event.endAt)} readOnly />
            </label>
          </div>
          <label htmlFor="detail-capacity">
            Capacity
            <input id="detail-capacity" value={event.capacity} readOnly />
          </label>
          <label htmlFor="detail-state">
            Publication state
            <input id="detail-state" value={event.publicationState} readOnly />
          </label>
          <label htmlFor="detail-id">
            Event ID
            <input id="detail-id" value={event.id} readOnly />
          </label>
        </form>
      ) : <p className="detail-status" role="alert">{message || "Unable to load event details"}</p>}
    </section>
  );
}

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("Loading…");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [events, setEvents] = useState<PublishedEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventSubmitting, setEventSubmitting] = useState(false);
  const [eventsMessage, setEventsMessage] = useState("");
  const [eventErrors, setEventErrors] = useState<Record<string, string>>({});
  const [selectedEvent, setSelectedEvent] = useState<PublishedEvent | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventDetailLoading, setEventDetailLoading] = useState(false);
  const [eventDetailMessage, setEventDetailMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/v1/me", { credentials: "include" })
      .then(async (response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!active) return;
        const next = body?.data?.user;
        setUser(isUser(next) ? next : null);
        setMessage(isUser(next) ? "Signed in" : "Sign in");
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setMessage("Sign in");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user || user.role !== "ORGANIZER") {
      setEvents([]);
      setEventsMessage("");
      setEventErrors({});
      setSelectedEvent(null);
      setSelectedEventId(null);
      setEventDetailLoading(false);
      setEventDetailMessage("");
      return;
    }

    let active = true;
    setEventsLoading(true);
    fetch("/api/v1/organizer/events", { credentials: "include" })
      .then(async (response) => ({ response, body: await response.json().catch(() => null) }))
      .then(({ response, body }) => {
        if (!active) return;
        if (response.status === 401) {
          setUser(null);
          setMessage("Session expired; sign in again");
          return;
        }
        if (!response.ok || !Array.isArray(body?.data?.events)) {
          setEventsMessage(errorMessage(body, "Unable to load your events"));
          return;
        }
        setEvents(body.data.events.filter(isPublishedEvent));
        setEventsMessage("");
      })
      .catch(() => {
        if (active) setEventsMessage("Unable to load your events");
      })
      .finally(() => {
        if (active) setEventsLoading(false);
      });
    return () => { active = false; };
  }, [user]);

  async function viewEventDetail(eventId: string) {
    setSelectedEventId(eventId);
    setSelectedEvent(null);
    setEventDetailMessage("");
    setEventDetailLoading(true);

    try {
      const response = await fetch(`/api/v1/organizer/events/${encodeURIComponent(eventId)}`, { credentials: "include" });
      const body = await response.json().catch(() => null);
      if (response.status === 401) {
        setUser(null);
        setMessage("Session expired; sign in again");
        return;
      }
      if (!response.ok || !isPublishedEvent(body?.data?.event)) {
        setEventDetailMessage(errorMessage(body, "Unable to load event details"));
        return;
      }
      setSelectedEvent(body.data.event);
    } catch {
      setEventDetailMessage("Unable to load event details. Try again.");
    } finally {
      setEventDetailLoading(false);
    }
  }

  function backToEvents() {
    setSelectedEvent(null);
    setSelectedEventId(null);
    setEventDetailLoading(false);
    setEventDetailMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const values = new FormData(event.currentTarget);
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

  async function publishEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || eventSubmitting) return;

    const form = event.currentTarget;
    const values = new FormData(event.currentTarget);
    setEventSubmitting(true);
    setEventsMessage("Publishing event...");
    setEventErrors({});

    try {
      const response = await fetch("/api/v1/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(values.get("title") ?? ""),
          description: String(values.get("description") ?? ""),
          location: String(values.get("location") ?? ""),
          startAt: toBangkokIso(String(values.get("startAt") ?? "")),
          endAt: toBangkokIso(String(values.get("endAt") ?? "")),
          capacity: Number(values.get("capacity")),
        }),
      });
      const body = await response.json().catch(() => null);
      if (response.status === 401) {
        setUser(null);
        setMessage("Session expired; sign in again");
        return;
      }
      if (!response.ok) {
        setEventErrors(validationDetails(body));
        setEventsMessage(errorMessage(body, "Unable to publish event"));
        return;
      }

      const created = body?.data?.event;
      if (!isPublishedEvent(created)) {
        setEventsMessage("Unable to publish event");
        return;
      }
      setEvents((current) => [...current, created].sort((left, right) => left.startAt.localeCompare(right.startAt)));
      setEventsMessage(`Event published. Event ID: ${created.id}`);
      form.reset();
    } catch {
      setEventsMessage("Unable to publish event. Try again.");
    } finally {
      setEventSubmitting(false);
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
      setEvents([]);
      setSelectedEvent(null);
      setSelectedEventId(null);
      setEventDetailLoading(false);
      setEventDetailMessage("");
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
        {user.role === "ORGANIZER" ? selectedEventId ? (
          <EventDetailView event={selectedEvent} loading={eventDetailLoading} message={eventDetailMessage} onBack={backToEvents} />
        ) : (
          <section className="event-management" aria-labelledby="event-management-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Organizer workspace</p>
                <h2 id="event-management-heading">Create and publish an event</h2>
                <p className="section-intro">Publish a University Event with a positive capacity. Times are entered in Asia/Bangkok (UTC+7).</p>
              </div>
            </div>
            <div className="event-layout">
              <form className="event-form" aria-label="Create and publish event" onSubmit={publishEvent}>
                <label htmlFor="event-title">
                  Title
                  <input id="event-title" name="title" required disabled={eventSubmitting} aria-invalid={Boolean(eventErrors.title)} aria-describedby={eventErrors.title ? "event-title-error" : undefined} />
                  {eventErrors.title && <span id="event-title-error" className="field-error" role="alert">{eventErrors.title}</span>}
                </label>
                <label htmlFor="event-description">
                  Description
                  <textarea id="event-description" name="description" required disabled={eventSubmitting} aria-invalid={Boolean(eventErrors.description)} aria-describedby={eventErrors.description ? "event-description-error" : undefined} />
                  {eventErrors.description && <span id="event-description-error" className="field-error" role="alert">{eventErrors.description}</span>}
                </label>
                <label htmlFor="event-location">
                  Location
                  <input id="event-location" name="location" required disabled={eventSubmitting} aria-invalid={Boolean(eventErrors.location)} aria-describedby={eventErrors.location ? "event-location-error" : undefined} />
                  {eventErrors.location && <span id="event-location-error" className="field-error" role="alert">{eventErrors.location}</span>}
                </label>
                <div className="event-date-grid">
                  <label htmlFor="event-start">
                    Start date and time — Asia/Bangkok (UTC+7)
                    <input id="event-start" name="startAt" type="datetime-local" required disabled={eventSubmitting} aria-invalid={Boolean(eventErrors.startAt)} aria-describedby={eventErrors.startAt ? "event-start-error" : undefined} />
                    {eventErrors.startAt && <span id="event-start-error" className="field-error" role="alert">{eventErrors.startAt}</span>}
                  </label>
                  <label htmlFor="event-end">
                    End date and time — Asia/Bangkok (UTC+7)
                    <input id="event-end" name="endAt" type="datetime-local" required disabled={eventSubmitting} aria-invalid={Boolean(eventErrors.endAt)} aria-describedby={eventErrors.endAt ? "event-end-error" : undefined} />
                    {eventErrors.endAt && <span id="event-end-error" className="field-error" role="alert">{eventErrors.endAt}</span>}
                  </label>
                </div>
                <label htmlFor="event-capacity">
                  Capacity (positive integer)
                  <input id="event-capacity" name="capacity" type="number" min="1" step="1" required disabled={eventSubmitting} aria-invalid={Boolean(eventErrors.capacity)} aria-describedby={eventErrors.capacity ? "event-capacity-error" : undefined} />
                  {eventErrors.capacity && <span id="event-capacity-error" className="field-error" role="alert">{eventErrors.capacity}</span>}
                </label>
                <button className="button button-primary" type="submit" disabled={eventSubmitting}>
                  {eventSubmitting ? "Publishing..." : "Publish event"}
                </button>
                <p role="status" aria-live="polite" className="status-text">{eventsMessage}</p>
              </form>
              <section className="owned-events" aria-labelledby="owned-events-heading">
                <div className="section-heading compact-heading">
                  <div>
                    <p className="eyebrow">Persisted records</p>
                    <h2 id="owned-events-heading">Your events</h2>
                  </div>
                </div>
                {eventsLoading ? <p className="empty-state">Loading your events...</p> : events.length === 0 ? (
                  <p className="empty-state">No published events yet. Use the form to create your first one.</p>
                ) : (
                  <ul className="event-list">
                    {events.map((event) => (
                      <li className="event-card" key={event.id}>
                        <div className="event-card-heading">
                          <h3>{event.title}</h3>
                          <span className="published-badge">Published</span>
                        </div>
                        <p>{event.description}</p>
                        <dl className="event-meta">
                          <div><dt>Location</dt><dd>{event.location}</dd></div>
                          <div><dt>When</dt><dd>{formatBangkokDate(event.startAt)} – {formatBangkokDate(event.endAt)}</dd></div>
                          <div><dt>Capacity</dt><dd>{event.capacity}</dd></div>
                          <div><dt>Event ID</dt><dd className="event-id">{event.id}</dd></div>
                        </dl>
                        <div className="event-card-actions">
                          <button
                            type="button"
                            className="button button-secondary view-event-button"
                            onClick={() => void viewEventDetail(event.id)}
                            disabled={eventDetailLoading}
                          >
                            {selectedEventId === event.id && eventDetailLoading ? "Loading details..." : "View details"}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </section>
        ) : (
          <section className="future-card">
            <span className="calendar-icon" aria-hidden="true">◷</span>
            <div>
              <h2>Your events are coming soon</h2>
              <p>Event discovery and attendance tools will appear here in the next Sprint.</p>
            </div>
          </section>
        )}
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
