"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

type Activity = {
  id: number;
  activityType: string;
  activityDate: string;
  durationMinutes: number;
  distanceKm: number | null;
  attended: boolean;
  notes: string;
};

type Member = { id: number; name: string; email: string; isStaff: boolean };

type ClubSession = {
  id: number;
  activityType: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  location: string;
  capacity: number;
  description: string;
  bookedCount: number;
  isBooked: boolean;
  spotsLeft: number;
};

const activityLabels: Record<string, string> = {
  "run-club": "Run club",
  strength: "Strength",
  recovery: "Recovery",
  other: "Other activity",
};

const activityGuides: Record<string, { description: string; focus: string; track: string }> = {
  "run-club": {
    description: "Social running with space for every pace and experience level.",
    focus: "Build a steady rhythm, explore a route, and enjoy moving with others.",
    track: "Distance, time, route, or how the pace felt.",
  },
  strength: {
    description: "Small-group strength work focused on building confidence and consistency.",
    focus: "Record the movements or muscle groups you worked on and how challenging it felt.",
    track: "Exercises, sets, weights, or a personal best.",
  },
  recovery: {
    description: "A lower-intensity session to support mobility, rest, and your next effort.",
    focus: "Notice what feels tight or tired and give yourself room to reset.",
    track: "Mobility work, areas of focus, or how you felt afterward.",
  },
  other: {
    description: "Log any movement that does not fit the other activity types.",
    focus: "Use the notes to capture what you did and what made the session meaningful.",
    track: "Activity details, time, distance, or how it felt.",
  },
};

export default function ProgressDashboard() {
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [sessions, setSessions] = useState<ClubSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [sessionActionId, setSessionActionId] = useState<number | null>(null);
  const [selectedActivityType, setSelectedActivityType] = useState("run-club");
  const selectedActivityGuide = activityGuides[selectedActivityType];

  useEffect(() => {
    async function loadProgress() {
      try {
        const [response, sessionsResponse] = await Promise.all([
          fetch("/api/activities", { cache: "no-store" }),
          fetch("/api/sessions", { cache: "no-store" }),
        ]);
        if (response.status === 401 || sessionsResponse.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) throw new Error("We couldn’t load your progress.");
        const result: { member: Member; activities: Activity[] } = await response.json();
        setMember(result.member);
        setActivities(result.activities);
        if (!sessionsResponse.ok) throw new Error("We couldn’t load upcoming sessions.");
        const sessionResult: { sessions: ClubSession[] } = await sessionsResponse.json();
        setSessions(sessionResult.sessions);
      } catch {
        setError("We couldn’t load your progress. Refresh the page to try again.");
      } finally {
        setIsLoading(false);
      }
    }

    void loadProgress();
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setMessage("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      activityType: formData.get("activityType"),
      activityDate: formData.get("activityDate"),
      durationMinutes: Number(formData.get("durationMinutes")),
      distanceKm: formData.get("distanceKm"),
      attended: formData.get("attended") === "on",
      notes: formData.get("notes"),
    };

    try {
      const response = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: { activity?: Activity; error?: string } = await response.json();

      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok || !result.activity) {
        setError(result.error ?? "We couldn’t save this activity.");
        return;
      }

      setActivities((current) => [result.activity!, ...current]);
      form.reset();
      setSelectedActivityType("run-club");
      setMessage("Activity added to your progress.");
    } catch {
      setError("We couldn’t reach the server. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeActivity(activityId: number) {
    setError("");
    try {
      const response = await fetch(`/api/activities/${activityId}`, { method: "DELETE" });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        const result: { error?: string } = await response.json();
        setError(result.error ?? "We couldn’t remove this activity.");
        return;
      }
      setActivities((current) => current.filter((activity) => activity.id !== activityId));
    } catch {
      setError("We couldn’t reach the server. Check your connection and try again.");
    }
  }

  async function changeReservation(session: ClubSession) {
    setSessionActionId(session.id);
    setSessionError("");
    setSessionMessage("");

    try {
      const response = session.isBooked
        ? await fetch(`/api/sessions/${session.id}/booking`, { method: "DELETE" })
        : await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: session.id }),
          });
      const result: { message?: string; error?: string } = await response.json();

      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        setSessionError(result.error ?? "We couldn’t update your reservation.");
        return;
      }

      const sessionsResponse = await fetch("/api/sessions", { cache: "no-store" });
      const sessionsResult: { sessions: ClubSession[] } = await sessionsResponse.json();
      if (!sessionsResponse.ok) throw new Error("We couldn’t refresh upcoming sessions.");
      setSessions(sessionsResult.sessions);
      setSessionMessage(result.message ?? "Your reservation was updated.");
    } catch {
      setSessionError("We couldn’t reach the server. Check your connection and try again.");
    } finally {
      setSessionActionId(null);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login?mode=login");
    router.refresh();
  }

  const attendedCount = activities.filter((activity) => activity.attended).length;
  const totalMinutes = activities.reduce((total, activity) => total + activity.durationMinutes, 0);
  const totalDistance = activities.reduce((total, activity) => total + (activity.distanceKm ?? 0), 0);

  return (
    <div className="member-dashboard">
      <header className="member-header">
        <Link className="brand" href="/" aria-label="Mesh Sports home">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span className="brand-name">MESH<span>SPORTS</span></span>
        </Link>
        <div className="member-actions">
          {member?.isStaff && <Link className="member-connect-google" href="/staff">Staff desk</Link>}
          <a className="member-connect-google" href="/api/auth/google?mode=link">Connect Google</a>
          <button className="member-signout" onClick={signOut} type="button">Sign out</button>
        </div>
      </header>

      <section className="member-welcome" aria-labelledby="progress-title">
        <p className="eyebrow">YOUR MOVEMENT, IN MOTION</p>
        <h1 id="progress-title">{member ? `Keep going, ${member.name.split(" ")[0]}.` : "Your progress."}</h1>
        <p>Every session adds up. Log your movement and see how far you’ve come.</p>
      </section>

      <section className="progress-stats" aria-label="Progress summary">
        <div className="progress-stat"><span>ACTIVITIES</span><strong>{isLoading ? "—" : activities.length}</strong></div>
        <div className="progress-stat"><span>ATTENDED</span><strong>{isLoading ? "—" : attendedCount}</strong></div>
        <div className="progress-stat"><span>TIME MOVING</span><strong>{isLoading ? "—" : `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`}</strong></div>
        <div className="progress-stat"><span>DISTANCE</span><strong>{isLoading ? "—" : `${totalDistance.toFixed(1)} km`}</strong></div>
      </section>

      <section className="member-sessions" aria-labelledby="member-sessions-title">
        <div className="member-sessions-heading">
          <div>
            <p className="eyebrow">MOVE WITH MESH</p>
            <h2 id="member-sessions-title">Upcoming sessions</h2>
          </div>
          <p>Find a spot that works for you.</p>
        </div>
        {isLoading ? (
          <p className="activity-empty">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="activity-empty">There are no upcoming sessions right now. Check back soon.</p>
        ) : (
          <ul className="member-session-list">
            {sessions.map((session) => (
              <li className="member-session-row" key={session.id}>
                <div className="member-session-details">
                  <p className="member-session-type">{activityLabels[session.activityType] ?? "Mesh session"}</p>
                  <h3>{session.title}</h3>
                  {session.description && <p className="member-session-description">{session.description}</p>}
                  <div className="member-session-meta">
                    <time dateTime={session.startsAt}>
                      {new Date(session.startsAt).toLocaleString(undefined, {
                        weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                    </time>
                    <span>{session.durationMinutes} min</span>
                    <span>{session.location}</span>
                    <span>{session.spotsLeft} {session.spotsLeft === 1 ? "spot" : "spots"} left</span>
                  </div>
                </div>
                <button
                  className={session.isBooked ? "session-reserve session-reserve-booked" : "session-reserve"}
                  disabled={sessionActionId === session.id || (!session.isBooked && session.spotsLeft === 0)}
                  onClick={() => void changeReservation(session)}
                  type="button"
                >
                  {sessionActionId === session.id ? "Updating..." : session.isBooked ? "Cancel spot" : session.spotsLeft === 0 ? "Full" : "Reserve spot"}
                </button>
              </li>
            ))}
          </ul>
        )}
        {(sessionError || sessionMessage) && (
          <p aria-live="polite" className={`form-feedback${sessionError ? " form-feedback-error" : " form-feedback-success"}`} role={sessionError ? "alert" : "status"}>
            {sessionError || sessionMessage}
          </p>
        )}
      </section>

      <div className="progress-layout">
        <section className="activity-entry" aria-labelledby="activity-form-title">
          <p className="eyebrow">ADD TO YOUR LOG</p>
          <h2 id="activity-form-title">Log an activity</h2>
          <form className="activity-form" onSubmit={handleSubmit}>
            <label className="form-field">
              <span>ACTIVITY</span>
              <select
                defaultValue="run-club"
                name="activityType"
                onChange={(event) => setSelectedActivityType(event.target.value)}
                required
              >
                <option value="run-club">Run club</option>
                <option value="strength">Strength</option>
                <option value="recovery">Recovery</option>
                <option value="other">Other activity</option>
              </select>
            </label>
            <div className="activity-guide" aria-live="polite">
              <p>{selectedActivityGuide.description}</p>
              <dl>
                <div><dt>SESSION FOCUS</dt><dd>{selectedActivityGuide.focus}</dd></div>
                <div><dt>GOOD TO TRACK</dt><dd>{selectedActivityGuide.track}</dd></div>
              </dl>
            </div>
            <label className="form-field">
              <span>DATE</span>
              <input name="activityDate" required type="date" />
            </label>
            <div className="activity-form-pair">
              <label className="form-field">
                <span>DURATION (MINUTES)</span>
                <input max={1440} min={1} name="durationMinutes" placeholder="45" required type="number" />
              </label>
              <label className="form-field">
                <span>DISTANCE (KM)</span>
                <input max={1000} min={0} name="distanceKm" placeholder="Optional" step="0.1" type="number" />
              </label>
            </div>
            <label className="attendance-check">
              <input defaultChecked name="attended" type="checkbox" />
              <span>I attended this activity</span>
            </label>
            <label className="form-field">
              <span>NOTES <span className="field-optional">(OPTIONAL)</span></span>
              <textarea maxLength={500} name="notes" placeholder={selectedActivityGuide.track} rows={3} />
            </label>
            <button className="button button-dark activity-submit" disabled={isSaving || isLoading} type="submit">
              {isSaving ? "Saving..." : "Save activity"}<span aria-hidden="true">↗</span>
            </button>
            <p aria-live="polite" className={`form-feedback${error ? " form-feedback-error" : " form-feedback-success"}`} role={error ? "alert" : "status"}>
              {error || message}
            </p>
          </form>
        </section>

        <section className="activity-history" aria-labelledby="activity-history-title">
          <div className="activity-history-heading">
            <div>
              <p className="eyebrow">SHOWING UP IS THE WORK</p>
              <h2 id="activity-history-title">Your activity</h2>
            </div>
            {member && <span className="member-email">{member.email}</span>}
          </div>
          {isLoading ? (
            <p className="activity-empty">Loading your progress...</p>
          ) : activities.length === 0 ? (
            <p className="activity-empty">Your first session is waiting. Log an activity to start your progress history.</p>
          ) : (
            <ul className="activity-list">
              {activities.map((activity) => (
                <li className="activity-row" key={activity.id}>
                  <div className="activity-row-main">
                    <span className="activity-type">{activityLabels[activity.activityType] ?? "Activity"}</span>
                    <p className="activity-description">
                      {activityGuides[activity.activityType]?.description ?? activityGuides.other.description}
                    </p>
                    <time dateTime={activity.activityDate}>
                      {new Date(`${activity.activityDate}T00:00:00`).toLocaleDateString(undefined, {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </time>
                    <span>{activity.durationMinutes} min{activity.distanceKm !== null ? ` · ${activity.distanceKm} km` : ""}</span>
                    <span className={activity.attended ? "activity-attended" : "activity-missed"}>
                      {activity.attended ? "Attended" : "Missed"}
                    </span>
                    {activity.notes && <p className="activity-notes">{activity.notes}</p>}
                  </div>
                  <button className="activity-remove" onClick={() => void removeActivity(activity.id)} type="button">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}