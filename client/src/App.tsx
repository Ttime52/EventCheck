import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

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
  registrationDeadline?: string | null;
};

type PublicEvent = Omit<PublishedEvent, "publicationState"> & { remainingPlaces: number; registrationAvailable: boolean; registrationOpen: boolean };
type Registration = { id: string; eventId: string; status: "ACTIVE" | "CANCELLED"; registeredAt: string; cancelledAt: string | null; event: Pick<PublicEvent, "id" | "title" | "description" | "location" | "startAt" | "endAt">; attendance?: Attendance | null };
type OrganizerRegistration = { id: string; participantId: string; participantDisplayName: string; status: "ACTIVE" | "CANCELLED"; registeredAt: string; cancelledAt?: string | null };
type Attendance = { id: string; registrationId: string; eventId: string; participantId: string; recordedByOrganizerId: string; checkedInAt: string };
type AttendanceState = { status: "loading" | "success" | "error"; value?: Attendance | null };

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

export function toBangkokIso(value: string) {
  if (!value) return value;
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
    const explicit = new Date(value);
    return Number.isNaN(explicit.getTime()) ? value : explicit.toISOString();
  }
  const withSeconds = value.length === 16 ? `${value}:00` : value;
  const parsed = new Date(`${withSeconds}+07:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

export function toBangkokDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")==="24" ? "00" : get("hour")}:${get("minute")}`;
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

const isPublicEvent = (value: unknown): value is PublicEvent => {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && typeof item.title === "string" && typeof item.description === "string" && typeof item.location === "string" && typeof item.startAt === "string" && typeof item.endAt === "string" && typeof item.capacity === "number" && typeof item.remainingPlaces === "number" && typeof item.registrationAvailable === "boolean" && typeof item.registrationOpen === "boolean" && (item.registrationDeadline === undefined || item.registrationDeadline === null || typeof item.registrationDeadline === "string");
};

const isOrganizerRegistration = (value: unknown): value is OrganizerRegistration => {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && typeof item.participantId === "string" && typeof item.participantDisplayName === "string" && (item.status === "ACTIVE" || item.status === "CANCELLED") && typeof item.registeredAt === "string";
};

function PublicEventsPanel({ user, onSessionExpired }: { user: User | null; onSessionExpired: () => void }) {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [selected, setSelected] = useState<PublicEvent | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationAttendance, setRegistrationAttendance] = useState<Record<string, Attendance | null>>({});
  const [attendanceStates, setAttendanceStates] = useState<Record<string, AttendanceState>>({});
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [registrationsLoading, setRegistrationsLoading] = useState(user?.role === "PARTICIPANT");
  const [registrationsError, setRegistrationsError] = useState("");
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [registrationDetailLoading, setRegistrationDetailLoading] = useState(false);
  const [registrationDetailError, setRegistrationDetailError] = useState("");
  const [failedRegistrationId, setFailedRegistrationId] = useState<string | null>(null);
  const registrationRequestRef = useRef(0);
  const attendanceRequestRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"discover" | "registrations">("discover");
  const [confirmationId, setConfirmationId] = useState<string | null>(null);
  const tabHeadingRef = useRef<HTMLHeadingElement>(null);

  async function loadEvents() {
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/v1/events", { credentials: "include" });
      const body = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(body?.data?.events)) throw new Error(errorMessage(body, "Unable to load published events"));
      const publicEvents = body.data.events.filter(isPublicEvent);
      if (publicEvents.length !== body.data.events.length) {
        throw new Error("The API returned an unsupported event format. Check that the API and client are running from the same version.");
      }
      setEvents(publicEvents);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load published events"); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    void loadEvents();
    if (user?.role === "PARTICIPANT") void loadRegistrations();

    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      void loadEvents();
      if (user?.role === "PARTICIPANT") void loadRegistrations();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, []);

  async function loadRegistrations() {
    const requestId = attendanceRequestRef.current + 1;
    attendanceRequestRef.current = requestId;
    setRegistrationsLoading(true);
    setRegistrationsError("");
    setAttendanceLoading(true);
    setAttendanceError("");
    try {
      const response = await fetch("/api/v1/me/registrations", { credentials: "include" });
      const body = await response.json().catch(() => null);
      if (response.status === 401) return onSessionExpired();
      if (!response.ok || !Array.isArray(body?.data?.registrations)) throw new Error(errorMessage(body, "Unable to load registrations"));
      const nextRegistrations = body.data.registrations as Registration[];
      if (requestId !== attendanceRequestRef.current) return;
      setRegistrations(nextRegistrations);
      setAttendanceStates(Object.fromEntries(nextRegistrations.map(registration => [registration.id, { status: "loading" as const }] )));
      setRegistrationsLoading(false);
      try {
        const results = await Promise.all(nextRegistrations.map(async registration => {
          const attendanceResponse = await fetch(`/api/v1/me/registrations/${encodeURIComponent(registration.id)}/attendance`, { credentials: "include" });
          const attendanceBody = await attendanceResponse.json().catch(() => null);
          if (attendanceResponse.status === 401) { onSessionExpired(); throw new Error("Session expired"); }
          if (!attendanceResponse.ok || !(attendanceBody?.data?.attendance === null || typeof attendanceBody?.data?.attendance === "object")) throw new Error(errorMessage(attendanceBody, "Unable to load attendance"));
          return [registration.id, attendanceBody.data.attendance as Attendance | null] as const;
        }));
        if (requestId === attendanceRequestRef.current) {
          setRegistrationAttendance(Object.fromEntries(results));
          setAttendanceStates(Object.fromEntries(results.map(([id, value]) => [id, { status: "success" as const, value }])));
        }
      } catch (error) {
        if (requestId === attendanceRequestRef.current) {
          setAttendanceError(error instanceof Error ? error.message : "Unable to load attendance");
          setAttendanceStates(current => Object.fromEntries(Object.keys(current).map(id => [id, { status: "error" as const }])));
          setMessage("Unable to load attendance. Retry to refresh attendance.");
        }
      } finally {
        if (requestId === attendanceRequestRef.current) setAttendanceLoading(false);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load registrations";
      if (requestId === attendanceRequestRef.current) { setRegistrationsError(message); setRegistrationsLoading(false); setAttendanceLoading(false); setMessage(message); }
    } finally {
      if (requestId === attendanceRequestRef.current) setRegistrationsLoading(false);
    }
  }

  async function register(event: PublicEvent) {
    if (!user) { setMessage("Sign in as a Participant to register."); return; }
    if (user.role !== "PARTICIPANT") { setMessage("Organizer accounts cannot register as Participants."); return; }
    setBusyId(event.id); setMessage("");
    try {
      const response = await fetch(`/api/v1/events/${encodeURIComponent(event.id)}/registrations`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const body = await response.json().catch(() => null);
      if (response.status === 401) return onSessionExpired();
      if (response.status === 409 && body?.error?.code === "REGISTRATION_DUPLICATE") { await refreshAvailability(event.id); setMessage("You are already registered for this event."); }
      else if (response.status === 409 && body?.error?.code === "EVENT_FULL") { await refreshAvailability(event.id); setMessage("This event is full."); }
      else if (response.status === 409 && body?.error?.code === "REGISTRATION_CLOSED") { await refreshAvailability(event.id); setMessage("Registration is closed for this event."); }
      else if (!response.ok) setMessage(errorMessage(body, "Unable to register for this event"));
      else { await loadEvents(); if (selected?.id === event.id) await viewDetail(event.id); await loadRegistrations(); setConfirmationId(body?.data?.registration?.id ?? "available"); setMessage("Registration confirmed."); }
    } catch { setMessage("Unable to register for this event. Try again."); }
    finally { setBusyId(null); }
  }

  async function cancelRegistration(registration: Registration) {
    if (registration.status !== "ACTIVE" || cancellingId) return;
    if (!window.confirm(`Cancel your registration for ${registration.event.title}? You can register again if the event is still open and has capacity.`)) return;
    setCancellingId(registration.id);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/me/registrations/${encodeURIComponent(registration.id)}/cancel`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await response.json().catch(() => null);
      if (response.status === 401) return onSessionExpired();
      if (response.status === 409 && body?.error?.code === "REGISTRATION_CHECKED_IN") {
        await loadRegistrations(); await loadEvents(); setMessage("This registration has been checked in and cannot be cancelled."); return;
      }
      if (response.status === 409 && body?.error?.code === "CANCELLATION_CLOSED") {
        await loadRegistrations(); await loadEvents(); setMessage("Cancellation is closed because this event has started."); return;
      }
      if (response.status === 404 && body?.error?.code === "REGISTRATION_NOT_FOUND") {
        await loadRegistrations(); setMessage("Registration not found. Your registrations have been refreshed."); return;
      }
      if (!response.ok || !body?.data?.registration) {
        setMessage(errorMessage(body, "Unable to cancel this registration. Try again.")); return;
      }
      const updated = body.data.registration as Pick<Registration, "status" | "cancelledAt">;
      setRegistrations(current => current.map(item => item.id === registration.id ? { ...item, ...updated } : item));
      setSelectedRegistration(null);
      await loadRegistrations();
      await loadEvents();
      setConfirmationId(null);
      setMessage("Registration cancelled.");
    } catch {
      setMessage("Unable to cancel this registration. Try again.");
    } finally {
      setCancellingId(null);
    }
  }

  async function refreshAvailability(eventId: string) {
    await loadEvents();
    if (selected?.id === eventId) await viewDetail(eventId);
  }

  async function viewDetail(eventId: string) {
    setDetailLoading(true);
    setSelected(null);
    try {
      const response = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}`, { credentials: "include" });
      const body = await response.json().catch(() => null);
      if (response.status === 401) return onSessionExpired();
      if (!response.ok || !isPublicEvent(body?.data?.event)) throw new Error(errorMessage(body, "Unable to load event details"));
      setSelected(body.data.event);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load event details"); }
    finally { setDetailLoading(false); }
  }

  useEffect(() => {
    if (selected) detailHeadingRef.current?.focus();
  }, [selected]);

  function switchTab(tab: "discover" | "registrations") {
    setActiveTab(tab);
    setSelected(null);
    window.setTimeout(() => tabHeadingRef.current?.focus(), 0);
  }

  async function viewRegistration(registrationId: string) {
    const requestId = registrationRequestRef.current + 1;
    registrationRequestRef.current = requestId;
    setRegistrationDetailLoading(true); setRegistrationDetailError(""); setFailedRegistrationId(null); setMessage(""); setSelectedRegistration(null);
    try {
      const response = await fetch(`/api/v1/me/registrations/${encodeURIComponent(registrationId)}`, { credentials: "include" });
      const body = await response.json().catch(() => null);
      if (response.status === 401) return onSessionExpired();
      if (!response.ok || !body?.data?.registration) throw new Error(errorMessage(body, "Unable to load registration details"));
      const attendanceResponse = await fetch(`/api/v1/me/registrations/${encodeURIComponent(registrationId)}/attendance`, { credentials: "include" });
      const attendanceBody = await attendanceResponse.json().catch(() => null);
      if (attendanceResponse.status === 401) return onSessionExpired();
      if (!attendanceResponse.ok || !(attendanceBody?.data?.attendance === null || typeof attendanceBody?.data?.attendance === "object")) throw new Error(errorMessage(attendanceBody, "Unable to load attendance"));
      if (requestId === registrationRequestRef.current) setSelectedRegistration({ ...body.data.registration, attendance: attendanceBody.data.attendance });
    } catch (error) { if (requestId === registrationRequestRef.current) { setFailedRegistrationId(registrationId); setRegistrationDetailError(error instanceof Error ? error.message : "Unable to load registration details"); } }
    finally { if (requestId === registrationRequestRef.current) setRegistrationDetailLoading(false); }
  }

  useEffect(() => {
    if (selectedRegistration) window.setTimeout(() => document.getElementById("registration-detail-heading")?.focus(), 0);
    else if (activeTab === "registrations") window.setTimeout(() => tabHeadingRef.current?.focus(), 0);
  }, [selectedRegistration, activeTab]);

  return <section className="public-events-panel" aria-labelledby="public-events-heading">
    <div className="section-heading"><p className="eyebrow">{user?.role === "PARTICIPANT" && activeTab === "registrations" ? "Participant records" : "University Events"}</p><h2 id="public-events-heading" ref={tabHeadingRef} tabIndex={-1}>{user?.role === "PARTICIPANT" && activeTab === "registrations" ? "My Registrations" : "Discover published events"}</h2><p className="section-intro">{user?.role === "PARTICIPANT" && activeTab === "registrations" ? "Review your event registration and attendance history." : "Browse public event details and availability. Dates are shown in Asia/Bangkok (UTC+7)."}</p></div>
    {user?.role === "PARTICIPANT" && <div className="tab-list" role="tablist" aria-label="Participant dashboard sections"><button type="button" role="tab" aria-selected={activeTab === "discover"} className={`dashboard-tab${activeTab === "discover" ? " is-active" : ""}`} onClick={() => switchTab("discover")}>Discover Events</button><button type="button" role="tab" aria-selected={activeTab === "registrations"} className={`dashboard-tab${activeTab === "registrations" ? " is-active" : ""}`} onClick={() => switchTab("registrations")}>My Registrations</button></div>}
    {message && <div className="status-text" role="status" aria-live="polite"><span>{message}</span>{confirmationId && <button type="button" className="button button-secondary confirmation-action" onClick={() => switchTab("registrations")}>View My Registrations</button>}</div>}
    {(!user || user.role !== "PARTICIPANT" || activeTab === "discover") && (detailLoading ? <p className="empty-state" role="status">Loading event details...</p> : selected ? <div className="public-detail-card" role="region" aria-label="Public event details"><button type="button" className="back-button" onClick={() => setSelected(null)}>Back to events</button><h3 ref={detailHeadingRef} tabIndex={-1}>{selected.title}</h3><p>{selected.description}</p><dl className="event-meta"><div><dt>Location</dt><dd>{selected.location}</dd></div><div><dt>When</dt><dd>{formatBangkokDate(selected.startAt)} – {formatBangkokDate(selected.endAt)}</dd></div><div><dt>Capacity</dt><dd>{selected.capacity} ({selected.remainingPlaces} remaining)</dd></div><div><dt>Availability</dt><dd>{selected.registrationOpen ? selected.registrationAvailable ? "Available" : "Full" : "Closed"}</dd></div><div><dt>Registration deadline</dt><dd>{formatBangkokDate(selected.registrationDeadline ?? selected.startAt)}{selected.registrationDeadline ? "" : " (at event start)"}</dd></div></dl><div className="event-card-actions">{user?.role === "PARTICIPANT" && (registrations.some((registration) => registration.eventId === selected.id && registration.status === "ACTIVE") ? <button type="button" className="button button-secondary view-event-button" disabled>Registered</button> : selected.registrationAvailable && selected.registrationOpen && <button type="button" className="button button-primary view-event-button" onClick={() => void register(selected)} disabled={busyId === selected.id}>{busyId === selected.id ? "Registering..." : registrations.some(registration => registration.eventId === selected.id && registration.status === "CANCELLED") ? "Register again" : "Register"}</button>)}{!user && <span className="sign-in-hint">Sign in as a Participant to register</span>}</div></div> : loading ? <p className="empty-state" role="status">Loading published events...</p> : events.length === 0 ? <p className="empty-state">No published events are available.</p> : <ul className="event-list">
      {events.map((event) => <li className="event-card" key={event.id}><div className="event-card-heading"><h3>{event.title}</h3><span className="published-badge">{event.registrationAvailable ? `${event.remainingPlaces} places` : "Full"}</span></div><p>{event.description}</p><dl className="event-meta"><div><dt>Location</dt><dd>{event.location}</dd></div><div><dt>When</dt><dd>{formatBangkokDate(event.startAt)} – {formatBangkokDate(event.endAt)}</dd></div><div><dt>Capacity</dt><dd>{event.capacity} ({event.remainingPlaces} remaining)</dd></div></dl><div className="event-card-actions"><button type="button" className="button button-secondary view-event-button" onClick={() => void viewDetail(event.id)}>View details</button>{!user && <span className="sign-in-hint">Sign in as a Participant to register</span>}</div></li>)}
    </ul>)}
    {activeTab === "registrations" && <>{registrationDetailLoading && <p className="detail-status" role="status">Loading registration details...</p>}
    {registrationDetailError && <div className="registration-detail-card" role="alert"><p>{registrationDetailError}</p>{failedRegistrationId && <button type="button" className="button button-secondary" onClick={() => void viewRegistration(failedRegistrationId)}>Retry</button>}</div>}
    {selectedRegistration && <section className="registration-detail-card registration-detail-view" aria-labelledby="registration-detail-heading"><button type="button" className="back-button" onClick={() => setSelectedRegistration(null)}>Back to My Registrations</button><p className="eyebrow">Selected registration</p><span className="event-status event-status-neutral">{Date.now() < new Date(selectedRegistration.event.startAt).getTime() ? "Upcoming" : Date.now() < new Date(selectedRegistration.event.endAt).getTime() ? "Ongoing" : "Ended"}</span><h3 id="registration-detail-heading" tabIndex={-1}>{selectedRegistration.event.title}</h3><div className={`attendance-status ${selectedRegistration.attendance ? "attendance-success" : "attendance-neutral"}`} role="status" aria-live="polite"><strong>{selectedRegistration.attendance ? "Checked In" : "Not Checked In"}</strong>{selectedRegistration.attendance && <span>{formatBangkokDate(selectedRegistration.attendance.checkedInAt)}</span>}</div><dl className="event-meta"><div><dt>Registration status</dt><dd>{selectedRegistration.status}</dd></div><div><dt>Registered</dt><dd>{formatBangkokDate(selectedRegistration.registeredAt)}</dd></div>{selectedRegistration.cancelledAt && <div><dt>Cancelled</dt><dd>{formatBangkokDate(selectedRegistration.cancelledAt)}</dd></div>}<div><dt>Description</dt><dd>{selectedRegistration.event.description}</dd></div><div><dt>Location</dt><dd>{selectedRegistration.event.location}</dd></div><div><dt>When</dt><dd>{formatBangkokDate(selectedRegistration.event.startAt)} – {formatBangkokDate(selectedRegistration.event.endAt)}</dd></div></dl><details className="technical-details"><summary>Technical details</summary><p><span>Registration ID</span> <code className="event-id">{selectedRegistration.id}</code></p></details>{selectedRegistration.status === "ACTIVE" && new Date(selectedRegistration.event.startAt).getTime() > Date.now() && <button type="button" className="button button-secondary" onClick={() => void cancelRegistration(selectedRegistration)} disabled={cancellingId === selectedRegistration.id}>{cancellingId === selectedRegistration.id ? "Cancelling..." : `Cancel registration for ${selectedRegistration.event.title}`}</button>}</section>}</>}
    {user?.role === "PARTICIPANT" && activeTab === "registrations" && !selectedRegistration && <section className="registrations-card" aria-labelledby="public-events-heading"><div className="section-heading compact-heading"><p className="eyebrow">Participant records</p></div>{registrationsLoading ? <p className="empty-state" role="status">Loading your registrations...</p> : registrationsError ? <div className="registration-detail-card" role="alert"><p>{registrationsError}</p><button type="button" className="button button-secondary" onClick={() => void loadRegistrations()}>Retry</button></div> : registrations.length === 0 ? <p className="empty-state">You have no registrations yet.</p> : <>{attendanceError && <div className="registration-detail-card" role="alert"><p>{attendanceError}</p><button type="button" className="button button-secondary" onClick={() => void loadRegistrations()}>Retry attendance</button></div>}{attendanceLoading && <p className="detail-status" role="status">Loading attendance...</p>}<ul className="event-list">{registrations.map((registration) => { const state = attendanceStates[registration.id]; const attendanceText = !state || state.status === "loading" ? "Loading attendance..." : state.status === "error" ? "Attendance unavailable" : state.value ? `Checked In · ${formatBangkokDate(state.value.checkedInAt)}` : "Not Checked In"; return <li className="event-card" key={registration.id}><h3>{registration.event.title}</h3><p>{registration.event.location} · {formatBangkokDate(registration.event.startAt)}</p><p>Status: {registration.status} · Registered {formatBangkokDate(registration.registeredAt)}{registration.cancelledAt ? ` · Cancelled ${formatBangkokDate(registration.cancelledAt)}` : ""}</p><p>Attendance: {attendanceText}</p><div className="event-card-actions"><button type="button" className="button button-secondary view-event-button" onClick={() => void viewRegistration(registration.id)} disabled={registrationDetailLoading}>{registrationDetailLoading ? "Loading details..." : "View registration details"}</button>{registration.status === "ACTIVE" && new Date(registration.event.startAt).getTime() > Date.now() && <button type="button" className="button button-secondary" onClick={() => void cancelRegistration(registration)} disabled={cancellingId === registration.id}>{cancellingId === registration.id ? "Cancelling..." : `Cancel registration for ${registration.event.title}`}</button>}</div></li>; })}</ul></>}</section>}
  </section>;
}

type EventDetailViewProps = {
  event: PublishedEvent | null;
  loading: boolean;
  message: string;
  onBack: () => void;
  onViewRegistrations: () => void;
};

function EventDetailView({ event, loading, message, onBack, onViewRegistrations }: EventDetailViewProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); }, []);

  return (
    <section className="event-detail-page" aria-labelledby="event-detail-page-heading">
      <button type="button" className="back-button" onClick={onBack}>Back to Your events</button>
      <div className="section-heading">
        <p className="eyebrow">Owned event</p>
        <h2 id="event-detail-page-heading" ref={headingRef} tabIndex={-1}>Event details</h2>
        <p className="section-intro">Published event details are read-only in Sprint 1.</p>
      </div>
      {loading ? <p className="detail-status" role="status">Loading event details...</p> : event ? (
        <>
        {message && <p className="detail-status" role="alert">{message}</p>}
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
        <div className="event-card-actions">
          <button type="button" className="button button-secondary" onClick={onViewRegistrations}>View registrations</button>
        </div>
        </>
      ) : <p className="detail-status" role="alert">{message || "Unable to load event details"}</p>}
    </section>
  );
}

type OrganizerRegistrationsViewProps = {
  event: PublishedEvent;
  onBack: () => void;
  onSessionExpired: () => void;
};

function OrganizerRegistrationsView({ event, onBack, onSessionExpired }: OrganizerRegistrationsViewProps) {
  const [registrations, setRegistrations] = useState<OrganizerRegistration[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance | null>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [listError, setListError] = useState("");
  const [attendanceError, setAttendanceError] = useState("");
  const [attendanceLoaded, setAttendanceLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { headingRef.current?.focus(); }, []);
  useEffect(() => { const timer = window.setInterval(() => setClock(Date.now()), 1000); return () => window.clearInterval(timer); }, []);

  useEffect(() => {
    let active = true;
    let registrationsLoaded = false;
    setLoading(true);
    setListError("");
    setAttendanceError("");
    setAttendanceLoaded(false);
    fetch(`/api/v1/organizer/events/${encodeURIComponent(event.id)}/registrations`, { credentials: "include" })
      .then(async (response) => ({ response, body: await response.json().catch(() => null) }))
      .then(async ({ response, body }) => {
        if (!active) return;
        if (response.status === 401) {
          onSessionExpired();
          return;
        }
        if (!response.ok || !Array.isArray(body?.data?.registrations) || !body.data.registrations.every(isOrganizerRegistration)) {
          setListError(errorMessage(body, "Unable to load registrations for this event"));
          return;
        }
        const loadedRegistrations = body.data.registrations as OrganizerRegistration[];
        setRegistrations(loadedRegistrations);
        registrationsLoaded = true;
        const attendanceResponse = await fetch(`/api/v1/organizer/events/${encodeURIComponent(event.id)}/attendance`, { credentials: "include" });
        const attendanceBody = await attendanceResponse.json().catch(() => null);
        if (!active) return;
        if (attendanceResponse.status === 401) { onSessionExpired(); return; }
        if (!attendanceResponse.ok || !Array.isArray(attendanceBody?.data?.attendances)) {
          setAttendanceError(errorMessage(attendanceBody, "Unable to load attendance. Try again."));
          return;
        }
        const byRegistration = Object.fromEntries((attendanceBody.data.attendances as Attendance[]).map(item => [item.registrationId, item]));
        setAttendance(Object.fromEntries(loadedRegistrations.map(registration => [registration.id, byRegistration[registration.id] ?? null])));
        setAttendanceLoaded(true);
      })
      .catch(() => {
        if (active && !registrationsLoaded) setListError("Unable to load registrations for this event. Try again.");
        else if (active) setAttendanceError("Unable to load attendance. Try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [event.id, attempt, onSessionExpired]);

  async function checkIn(registration: OrganizerRegistration) {
    if (checkingInId) return;
    setCheckingInId(registration.id);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/organizer/registrations/${encodeURIComponent(registration.id)}/attendance`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: event.id }) });
      const body = await response.json().catch(() => null);
      if (response.status === 401) return onSessionExpired();
      if (!response.ok || !body?.data?.attendance) { setMessage(errorMessage(body, "Unable to check in this registration")); return; }
      setAttendance(current => ({ ...current, [registration.id]: body.data.attendance }));
      setMessage("Attendance recorded.");
    } catch {
      setMessage("Unable to check in this registration. Try again.");
    } finally {
      setCheckingInId(null);
    }
  }

  const activeRegistrations = registrations.filter(registration => registration.status === "ACTIVE");
  const cancelledRegistrations = registrations.filter(registration => registration.status === "CANCELLED");
  const registrationCount = registrations.length;
  const registrationCountLabel = `${registrationCount} ${registrationCount === 1 ? "registration" : "registrations"}`;
  const now = clock;
  const eventStatus = now < new Date(event.startAt).getTime() ? "Upcoming" : now < new Date(event.endAt).getTime() ? "Ongoing" : "Ended";
  const checkedInCount = activeRegistrations.filter(registration => Boolean(attendance[registration.id])).length;
  const notCheckedInCount = Math.max(0, activeRegistrations.length - checkedInCount);

  return (
    <section className="event-detail-page organizer-registrations-page" aria-labelledby="organizer-registrations-heading">
      <button type="button" className="back-button" onClick={onBack}>Back to Event details</button>
      <div className="section-heading">
        <p className="eyebrow">Event registrations</p>
        <h2 id="organizer-registrations-heading" ref={headingRef} tabIndex={-1}>Registrations for {event.title}</h2>
        <p className="section-intro">Registration times are shown in Asia/Bangkok (UTC+7).</p>
        <div className="attendance-event-summary"><span className={`event-status event-status-${eventStatus.toLowerCase()}`}>{eventStatus}</span><span>{formatBangkokDate(event.startAt)} – {formatBangkokDate(event.endAt)}</span></div>
        {message && <p className="status-text" role="status" aria-live="polite">{message}</p>}
      </div>
      {attendanceError && <div className="registration-detail-card" role="alert"><p>{attendanceError}</p><button type="button" className="button button-secondary" onClick={() => setAttempt(value => value + 1)}>Retry attendance</button></div>}
      {loading && registrations.length > 0 && !attendanceLoaded && !attendanceError && <p className="detail-status" role="status" aria-live="polite">Loading attendance...</p>}
      {attendanceLoaded && <div className="attendance-metrics" aria-label="Attendance summary"><div><strong>{activeRegistrations.length}</strong><span>Active registrations</span></div><div><strong>{cancelledRegistrations.length}</strong><span>Cancelled registrations</span></div><div><strong>{checkedInCount}</strong><span>Checked in</span></div><div><strong>{notCheckedInCount}</strong><span>Not checked in</span></div><div><strong>{Math.max(0, event.capacity - activeRegistrations.length)}</strong><span>Remaining seats</span></div><div><strong>{registrationCount}</strong><span>Total registration records</span></div></div>}
      {loading ? <p className="detail-status" role="status">Loading registrations...</p> : listError ? (
        <div className="registration-detail-card" role="alert">
          <p>{listError}</p>
          <button type="button" className="button button-secondary" onClick={() => setAttempt(value => value + 1)}>Retry</button>
        </div>
      ) : (
        <>
          <p className="detail-status" role="status" aria-live="polite">{registrationCountLabel}</p>
          {registrationCount === 0 ? <p className="empty-state">No registrations for this event yet.</p> : (
            <>
            <h3>Active Registrations</h3>
            <ul className="event-list" aria-label="Active Registrations">
              {activeRegistrations.map(registration => (
                <li className="event-card" key={registration.id}>
                  <div className="event-card-heading">
                    <h3>{registration.participantDisplayName}</h3>
                    <span className="published-badge">{registration.status}</span>
                  </div>
                  <dl className="event-meta">
                    <div><dt>Registered (Asia/Bangkok, UTC+7)</dt><dd>{formatBangkokDate(registration.registeredAt)}</dd></div>
                    <div><dt>Attendance</dt><dd>{!attendanceLoaded ? "Attendance unavailable" : attendance[registration.id] ? `Checked In — ${formatBangkokDate(attendance[registration.id]!.checkedInAt)}` : "Not Checked In"}</dd></div>
                  </dl>
                  <details className="technical-details"><summary>Technical details</summary><p><span>Registration ID</span> <code className="event-id">{registration.id}</code></p><p><span>Participant ID</span> <code className="event-id">{registration.participantId}</code></p></details>
                  {(() => { const eligible = now >= new Date(event.startAt).getTime() && now < new Date(event.endAt).getTime(); const reason = !attendanceLoaded ? "Attendance unavailable; retry to check in." : attendance[registration.id] ? "Already checked in." : !eligible ? (now < new Date(event.startAt).getTime() ? "Check-in opens at event start." : "Check-in closed after the event ended.") : ""; return <>{registration.status === "ACTIVE" && !attendance[registration.id] && <button type="button" className="button button-secondary" onClick={() => void checkIn(registration)} disabled={checkingInId !== null || !eligible || !attendanceLoaded}>{checkingInId === registration.id ? "Checking in..." : "Check in participant"}</button>}{reason && <span className="field-help">{reason}</span>}</>; })()}
                </li>
              ))}
            </ul>
            {cancelledRegistrations.length > 0 && <><h3>Registration History</h3><ul className="event-list" aria-label="Registration History">{cancelledRegistrations.map(registration => <li className="event-card" key={registration.id}><div className="event-card-heading"><h3>{registration.participantDisplayName}</h3><span className="published-badge">CANCELLED</span></div><p>Registered {formatBangkokDate(registration.registeredAt)}</p><p>Registration cancelled{registration.cancelledAt ? ` · ${formatBangkokDate(registration.cancelledAt)}` : ""}</p></li>)}</ul></>}
            </>
          )}
        </>
      )}
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
  const [eventSettingsMessages, setEventSettingsMessages] = useState<Record<string, string>>({});
  const [eventErrors, setEventErrors] = useState<Record<string, string>>({});
  const [eventSavingId, setEventSavingId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<PublishedEvent | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventDetailLoading, setEventDetailLoading] = useState(false);
  const [eventDetailMessage, setEventDetailMessage] = useState("");
  const [showPublicEvents, setShowPublicEvents] = useState(false);
  const [organizerTab, setOrganizerTab] = useState<"create" | "events" | "discover">("create");
  const [selectedEventSection, setSelectedEventSection] = useState<"details" | "registrations">("details");
  const handleSessionExpired = useCallback(() => {
    setUser(null);
    setMessage("Session expired; sign in again");
  }, []);

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
      setSelectedEventSection("details");
      setOrganizerTab("create");
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
    setSelectedEventSection("details");
    const listed = events.find(event => event.id === eventId);
    setSelectedEvent(listed ?? null);
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
      if (!response.ok || !body?.data?.event) {
        setSelectedEvent(null);
        setEventDetailMessage(errorMessage(body, "Unable to load event details"));
        return;
      }
      const event = body.data.event;
      const remainingPlaces = typeof event.remainingPlaces === "number" ? event.remainingPlaces : event.capacity;
      setSelectedEvent({ ...event, remainingPlaces, registrationAvailable: typeof event.registrationAvailable === "boolean" ? event.registrationAvailable : remainingPlaces > 0, registrationOpen: typeof event.registrationOpen === "boolean" ? event.registrationOpen : new Date(event.startAt).getTime() > Date.now(), registrationDeadline: event.registrationDeadline ?? null });
    } catch {
      setSelectedEvent(null);
      setEventDetailMessage("Unable to load event details. Try again.");
    } finally {
      setEventDetailLoading(false);
    }
  }

  function backToEvents() {
    setSelectedEvent(null);
    setSelectedEventId(null);
    setSelectedEventSection("details");
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

  async function updateEvent(eventId: string, formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const values = new FormData(formEvent.currentTarget);
    const rawDeadline = String(values.get("registrationDeadline") ?? "");
    const current = events.find(item => item.id === eventId);
    if (!current) return;
    const nextCapacity = Number(values.get("capacity"));
    const nextDeadline = rawDeadline ? toBangkokIso(rawDeadline) : null;
    const payload: Record<string, unknown> = {};
    if (nextCapacity !== current.capacity) payload.capacity = nextCapacity;
    if ((current.registrationDeadline ?? null) !== nextDeadline) payload.registrationDeadline = nextDeadline;
    if (Object.keys(payload).length === 0) { setEventSettingsMessages(current => ({ ...current, [eventId]: "No changes to save" })); return; }
    setEventSavingId(eventId);
    setEventSettingsMessages(current => ({ ...current, [eventId]: "Saving event settings..." }));
    try {
      const response = await fetch(`/api/v1/organizer/events/${encodeURIComponent(eventId)}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => null);
      if (response.status === 401) return handleSessionExpired();
      if (!response.ok || !isPublishedEvent(body?.data?.event)) {
        setEventSettingsMessages(current => ({ ...current, [eventId]: errorMessage(body, "Unable to save event settings") }));
        return;
      }
      setEvents(current => current.map(item => item.id === eventId ? body.data.event : item));
      setEventSettingsMessages(current => ({ ...current, [eventId]: "Event settings saved" }));
    } catch {
      setEventSettingsMessages(current => ({ ...current, [eventId]: "Unable to save event settings. Try again." }));
    } finally { setEventSavingId(null); }
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
        <div className="dashboard-container">
        <section className="welcome-panel">
          <div>
            <p className="eyebrow">Your event space</p>
            <h1>Welcome, {user.displayName}</h1>
            <p className="lede">You’re signed in and ready to discover what’s happening next.</p>
            <p role="status" aria-live="polite" className="status-text">{message}</p>
          </div>
        </section>
        {user.role === "ORGANIZER" && <div className="dashboard-tabs" role="tablist" aria-label="Organizer dashboard sections"><button type="button" role="tab" aria-selected={organizerTab === "create"} className={`dashboard-tab${organizerTab === "create" ? " is-active" : ""}`} onClick={() => { setOrganizerTab("create"); setSelectedEventId(null); setSelectedEventSection("details"); }}>Create Event</button><button type="button" role="tab" aria-selected={organizerTab === "events"} className={`dashboard-tab${organizerTab === "events" ? " is-active" : ""}`} onClick={() => { setOrganizerTab("events"); setSelectedEventId(null); setSelectedEventSection("details"); }}>My Events</button><button type="button" role="tab" aria-selected={organizerTab === "discover"} className={`dashboard-tab${organizerTab === "discover" ? " is-active" : ""}`} onClick={() => { setOrganizerTab("discover"); setSelectedEventId(null); setSelectedEventSection("details"); }}>Discover Events</button></div>}
        {user.role === "ORGANIZER" && organizerTab === "discover" && <PublicEventsPanel user={user} onSessionExpired={handleSessionExpired} />}
        {user.role === "PARTICIPANT" && <PublicEventsPanel user={user} onSessionExpired={handleSessionExpired} />}
        {user.role === "ORGANIZER" && organizerTab !== "discover" ? selectedEventId ? (
          selectedEventSection === "registrations" && selectedEvent ? (
            <OrganizerRegistrationsView event={selectedEvent} onBack={() => setSelectedEventSection("details")} onSessionExpired={handleSessionExpired} />
          ) : (
            <EventDetailView event={selectedEvent} loading={eventDetailLoading} message={eventDetailMessage} onBack={backToEvents} onViewRegistrations={() => setSelectedEventSection("registrations")} />
          )
        ) : (
          <section className="event-management" aria-labelledby="event-management-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Organizer workspace</p>
                <h2 id="event-management-heading">{organizerTab === "create" ? "Create and publish an event" : "My Events"}</h2>
                {organizerTab === "create" && <p className="section-intro">Publish a University Event with a positive capacity. Times are entered in Asia/Bangkok (UTC+7).</p>}
              </div>
            </div>
            <div className={`event-layout${organizerTab === "events" ? " single-pane" : ""}`}>
              {organizerTab === "create" && <form className="event-form" aria-label="Create and publish event" onSubmit={publishEvent}>
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
              </form>}
              {organizerTab === "events" && <section className="owned-events" aria-labelledby="owned-events-heading">
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
                          <div><dt>Registration deadline</dt><dd>{event.registrationDeadline ? formatBangkokDate(event.registrationDeadline) : "At event start"}</dd></div>
                          <div><dt>Event ID</dt><dd className="event-id">{event.id}</dd></div>
                        </dl>
                        <form key={`settings-${event.id}-${event.capacity}-${event.registrationDeadline ?? "none"}`} className="event-settings-form" onSubmit={(formEvent) => void updateEvent(event.id, formEvent)} aria-label={`Edit ${event.title}`}>
                          <div className="event-settings-heading"><h4>Event Settings</h4><p>Manage registration capacity and deadline for this event.</p></div>
                          <div className="event-settings-fields">
                            <div className="event-settings-field"><label htmlFor={`capacity-${event.id}`}>Capacity</label><input id={`capacity-${event.id}`} name="capacity" type="number" min="1" step="1" defaultValue={event.capacity} disabled={eventSavingId === event.id} /></div>
                            <div className="event-settings-field"><label htmlFor={`deadline-${event.id}`}>Registration deadline (optional)</label><input id={`deadline-${event.id}`} name="registrationDeadline" type="datetime-local" aria-describedby={`deadline-help-${event.id}`} defaultValue={toBangkokDateTimeLocal(event.registrationDeadline)} disabled={eventSavingId === event.id} /><span id={`deadline-help-${event.id}`} className="field-help">Leave blank to close registration at event start.</span></div>
                          </div>
                          <div className="event-settings-actions"><button type="submit" className="button button-secondary" disabled={eventSavingId === event.id}>{eventSavingId === event.id ? "Saving..." : "Save settings"}</button></div>
                          {eventSettingsMessages[event.id] && <p role="status" aria-live="polite">{eventSettingsMessages[event.id]}</p>}
                        </form>
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
              </section>}
            </div>
          </section>
        ) : null}
        </div>
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
        <p className="deployment-label">EventCheck — Deployment verification v2</p>
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
        <button type="button" className="browse-public-button" onClick={() => setShowPublicEvents((visible) => !visible)}>{showPublicEvents ? "Hide published events" : "Browse published events"}</button>
        {showPublicEvents && <PublicEventsPanel user={null} onSessionExpired={() => setMessage("Session expired; sign in again")} />}
      </section>
    </main>
  );
}
