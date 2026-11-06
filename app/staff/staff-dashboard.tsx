"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type StaffSession = {
  id: number;
  activityType: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  location: string;
  capacity: number;
  description: string;
  isCancelled: number;
  bookedCount: number;
};

type JoinRequest = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  program: string;
  status: "new" | "contacted" | "closed";
  createdAt: string;
};

type SessionAttendee = {
  memberId: number;
  name: string;
  email: string;
  attended: boolean | null;
};

const programLabels: Record<string, string> = {
  "run-club": "Run club",
  strength: "Strength",
  recovery: "Recovery",
  "not-sure": "Open to suggestions",
};

function localDateTime(value: string) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export default function StaffDashboard() {
  const router = useRouter();
  const [sessions, setSessions] = useState<StaffSession[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [editingSession, setEditingSession] = useState<StaffSession | null>(null);
  const [attendanceSession, setAttendanceSession] = useState<StaffSession | null>(null);
  const [attendees, setAttendees] = useState<SessionAttendee[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState("");
  const [attendanceBusyMemberId, setAttendanceBusyMemberId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyItem, setBusyItem] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStaffData() {
      try {
        const [sessionsResponse, requestsResponse] = await Promise.all([
          fetch("/api/staff/sessions", { cache: "no-store" }),
          fetch("/api/staff/requests", { cache: "no-store" }),
        ]);
        if (sessionsResponse.status === 401 || requestsResponse.status === 401) {
          router.replace("/login");
          return;
        }
        if (sessionsResponse.status === 403 || requestsResponse.status === 403) {
          setError("This account is not on the staff access list. Configure MESH_ADMIN_EMAILS and sign in again.");
          return;
        }
        if (!sessionsResponse.ok || !requestsResponse.ok) throw new Error("We couldn’t load the staff desk.");
        const sessionResult: { sessions: StaffSession[] } = await sessionsResponse.json();
        const requestResult: { requests: JoinRequest[] } = await requestsResponse.json();
        setSessions(sessionResult.sessions);
        setRequests(requestResult.requests);
      } catch {
        setError("We couldn’t load the staff desk. Refresh the page to try again.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadStaffData();
  }, [router]);

  async function refreshSessions() {
    const response = await fetch("/api/staff/sessions", { cache: "no-store" });
    if (!response.ok) throw new Error("We couldn’t refresh the session list.");
    const result: { sessions: StaffSession[] } = await response.json();
    setSessions(result.sessions);
  }

  async function saveSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setMessage("");

    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const payload = {
      activityType: values.activityType,
      title: values.title,
      startsAt: new Date(String(values.startsAt)).toISOString(),
      durationMinutes: Number(values.durationMinutes),
      location: values.location,
      capacity: Number(values.capacity),
      description: values.description,
    };

    try {
      const response = await fetch(
        editingSession ? `/api/staff/sessions/${editingSession.id}` : "/api/staff/sessions",
        {
          method: editingSession ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result: { message?: string; error?: string } = await response.json();
      if (!response.ok) {
        setError(result.error ?? "We couldn’t save this session.");
        return;
      }
      await refreshSessions();
      setEditingSession(null);
      form.reset();
      setMessage(result.message ?? "Session published.");
    } catch {
      setError("We couldn’t save this session. Check the date and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateSessionStatus(session: StaffSession) {
    setBusyItem(session.id);
    setError("");
    try {
      const response = await fetch(`/api/staff/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCancelled: session.isCancelled !== 1 }),
      });
      const result: { message?: string; error?: string } = await response.json();
      if (!response.ok) {
        setError(result.error ?? "We couldn’t update this session.");
        return;
      }
      setSessions((current) => current.map((item) => item.id === session.id
        ? { ...item, isCancelled: session.isCancelled === 1 ? 0 : 1 }
        : item));
      setMessage(result.message ?? "Session updated.");
    } catch {
      setError("We couldn’t reach the server. Check your connection and try again.");
    } finally {
      setBusyItem(null);
    }
  }

  async function updateRequestStatus(requestItem: JoinRequest, status: JoinRequest["status"]) {
    setBusyItem(requestItem.id);
    setError("");
    try {
      const response = await fetch(`/api/staff/requests/${requestItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) {
        setError(result.error ?? "We couldn’t update this inquiry.");
        return;
      }
      setRequests((current) => current.map((item) => item.id === requestItem.id ? { ...item, status } : item));
    } catch {
      setError("We couldn’t reach the server. Check your connection and try again.");
    } finally {
      setBusyItem(null);
    }
  }

  async function loadAttendance(session: StaffSession) {
    setAttendanceSession(session);
    setAttendanceLoading(true);
    setAttendanceError("");
    try {
      const response = await fetch(`/api/staff/sessions/${session.id}/attendance`, { cache: "no-store" });
      const result: { attendees?: SessionAttendee[]; error?: string } = await response.json();
      if (!response.ok || !result.attendees) throw new Error(result.error ?? "We couldn’t load the roster.");
      setAttendees(result.attendees);
    } catch (caught) {
      setAttendanceError(caught instanceof Error ? caught.message : "We couldn’t load the roster.");
      setAttendees([]);
    } finally {
      setAttendanceLoading(false);
    }
  }

  async function updateAttendance(attendee: SessionAttendee, attended: boolean) {
    if (!attendanceSession) return;
    setAttendanceBusyMemberId(attendee.memberId);
    setAttendanceError("");
    try {
      const response = await fetch(`/api/staff/sessions/${attendanceSession.id}/attendance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: attendee.memberId, attended }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "We couldn’t update attendance.");
      setAttendees((current) => current.map((item) => item.memberId === attendee.memberId ? { ...item, attended } : item));
    } catch (caught) {
      setAttendanceError(caught instanceof Error ? caught.message : "We couldn’t update attendance.");
    } finally {
      setAttendanceBusyMemberId(null);
    }
  }

  return (
    <div className="staff-dashboard">
      <header className="member-header">
        <Link className="brand" href="/" aria-label="Mesh Sports home">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span className="brand-name">MESH<span>SPORTS</span></span>
        </Link>
        <div className="member-actions">
          <Link className="member-connect-google" href="/progress">Member dashboard</Link>
        </div>
      </header>

      <section className="staff-welcome">
        <p className="eyebrow">MESH TEAM</p>
        <h1>Staff desk</h1>
        <p>Publish sessions, manage reservations, and follow up on new member requests.</p>
      </section>

      {error && <p className="form-feedback form-feedback-error" role="alert">{error}</p>}

      <div className="staff-layout">
        <section className="staff-session-editor" aria-labelledby="staff-session-title">
          <p className="eyebrow">SCHEDULE</p>
          <h2 id="staff-session-title">{editingSession ? "Edit session" : "Publish a session"}</h2>
          <form className="activity-form" key={editingSession?.id ?? "new-session"} onSubmit={saveSession}>
            <label className="form-field">
              <span>ACTIVITY</span>
              <select defaultValue={editingSession?.activityType ?? "run-club"} name="activityType" required>
                <option value="run-club">Run club</option>
                <option value="strength">Strength</option>
                <option value="recovery">Recovery</option>
              </select>
            </label>
            <label className="form-field">
              <span>SESSION NAME</span>
              <input defaultValue={editingSession?.title ?? ""} maxLength={120} minLength={2} name="title" required />
            </label>
            <label className="form-field">
              <span>DATE AND TIME</span>
              <input defaultValue={editingSession ? localDateTime(editingSession.startsAt) : ""} name="startsAt" required type="datetime-local" />
            </label>
            <div className="activity-form-pair">
              <label className="form-field">
                <span>DURATION (MINUTES)</span>
                <input defaultValue={editingSession?.durationMinutes ?? 60} max={720} min={1} name="durationMinutes" required type="number" />
              </label>
              <label className="form-field">
                <span>CAPACITY</span>
                <input defaultValue={editingSession?.capacity ?? 12} max={100} min={1} name="capacity" required type="number" />
              </label>
            </div>
            <label className="form-field">
              <span>LOCATION</span>
              <input defaultValue={editingSession?.location ?? ""} maxLength={160} minLength={2} name="location" required />
            </label>
            <label className="form-field">
              <span>SESSION DETAILS <span className="field-optional">(OPTIONAL)</span></span>
              <textarea defaultValue={editingSession?.description ?? ""} maxLength={600} name="description" rows={3} />
            </label>
            <button className="button button-dark activity-submit" disabled={isSaving || isLoading} type="submit">
              {isSaving ? "Saving..." : editingSession ? "Save changes" : "Publish session"}<span aria-hidden="true">↗</span>
            </button>
            {editingSession && (
              <button className="staff-cancel-edit" onClick={() => setEditingSession(null)} type="button">Cancel editing</button>
            )}
            {(message || error) && <p aria-live="polite" className={`form-feedback${error ? " form-feedback-error" : " form-feedback-success"}`} role={error ? "alert" : "status"}>{error || message}</p>}
          </form>
        </section>

        <div className="staff-workspace">
          <section className="staff-session-list" aria-labelledby="staff-sessions-title">
            <div className="activity-history-heading">
              <div>
                <p className="eyebrow">UPCOMING AND PAST</p>
                <h2 id="staff-sessions-title">Sessions</h2>
              </div>
            </div>
            {isLoading ? <p className="activity-empty">Loading sessions...</p> : sessions.length === 0 ? (
              <p className="activity-empty">No sessions have been published yet.</p>
            ) : (
              <ul className="staff-list">
                {sessions.map((session) => (
                  <li className="staff-list-row" key={session.id}>
                    <div className="staff-list-main">
                      <span className="staff-item-label">{programLabels[session.activityType] ?? session.activityType}</span>
                      <h3>{session.title}</h3>
                      <p>{new Date(session.startsAt).toLocaleString()} · {session.durationMinutes} min · {session.location}</p>
                      <p>{session.bookedCount} / {session.capacity} spots reserved{session.isCancelled ? " · Cancelled" : ""}</p>
                    </div>
                    <div className="staff-item-actions">
                      <button className="staff-text-button" onClick={() => { setEditingSession(session); setMessage(""); }} type="button">Edit</button>
                      <button className="staff-text-button" onClick={() => void loadAttendance(session)} type="button">Attendance</button>
                      <button className="staff-text-button" disabled={busyItem === session.id} onClick={() => void updateSessionStatus(session)} type="button">
                        {session.isCancelled ? "Restore" : "Cancel session"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {attendanceSession && (
              <section className="attendance-panel" aria-labelledby="attendance-title">
                <div className="activity-history-heading">
                  <div>
                    <p className="eyebrow">SESSION ROSTER</p>
                    <h3 id="attendance-title">{attendanceSession.title}</h3>
                  </div>
                  <button className="staff-text-button" onClick={() => setAttendanceSession(null)} type="button">Close</button>
                </div>
                {attendanceError && <p className="form-feedback form-feedback-error" role="alert">{attendanceError}</p>}
                {attendanceLoading ? <p className="activity-empty">Loading roster...</p> : attendees.length === 0 ? (
                  <p className="activity-empty">No confirmed bookings for this session.</p>
                ) : (
                  <ul className="attendance-list">
                    {attendees.map((attendee) => (
                      <li className="attendance-row" key={attendee.memberId}>
                        <div>
                          <strong>{attendee.name}</strong>
                          <span>{attendee.email}</span>
                        </div>
                        <div className="attendance-actions" aria-label={`Attendance for ${attendee.name}`}>
                          <button aria-pressed={attendee.attended === true} disabled={attendanceBusyMemberId === attendee.memberId} onClick={() => void updateAttendance(attendee, true)} type="button">Present</button>
                          <button aria-pressed={attendee.attended === false} disabled={attendanceBusyMemberId === attendee.memberId} onClick={() => void updateAttendance(attendee, false)} type="button">Absent</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </section>

          <section className="staff-request-list" aria-labelledby="staff-requests-title">
            <div className="activity-history-heading">
              <div>
                <p className="eyebrow">FOLLOW UP WITH PEOPLE</p>
                <h2 id="staff-requests-title">Member inquiries</h2>
              </div>
              <span className="member-email">{requests.filter((item) => item.status === "new").length} new</span>
            </div>
            {isLoading ? <p className="activity-empty">Loading inquiries...</p> : requests.length === 0 ? (
              <p className="activity-empty">No inquiries yet. New requests from the Join page will appear here.</p>
            ) : (
              <ul className="staff-list">
                {requests.map((requestItem) => (
                  <li className="staff-list-row" key={requestItem.id}>
                    <div className="staff-list-main">
                      <span className={`inquiry-status inquiry-status-${requestItem.status}`}>{requestItem.status}</span>
                      <h3>{requestItem.name}</h3>
                      <p><a href={`mailto:${requestItem.email}`}>{requestItem.email}</a>{requestItem.phone ? ` · ${requestItem.phone}` : ""}</p>
                      <p>{programLabels[requestItem.program] ?? requestItem.program} · {new Date(`${requestItem.createdAt.replace(" ", "T")}Z`).toLocaleDateString()}</p>
                    </div>
                    <label className="staff-status-control">
                      <span>STATUS</span>
                      <select
                        aria-label={`Inquiry status for ${requestItem.name}`}
                        disabled={busyItem === requestItem.id}
                        onChange={(event) => void updateRequestStatus(requestItem, event.target.value as JoinRequest["status"])}
                        value={requestItem.status}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="closed">Closed</option>
                      </select>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}