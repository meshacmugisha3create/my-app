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

type ActivitySummary = {
  activityCount: number;
  attendedCount: number;
  totalMinutes: number;
  totalDistance: number;
};

type WeeklyCount = { weekStart: string; count: number };

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
  isWaitlisted: boolean;
  spotsLeft: number;
};

function localDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localWeekStart(value: Date): string {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return localDateKey(start);
}

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
  const [activitySummary, setActivitySummary] = useState<ActivitySummary>({
    activityCount: 0,
    attendedCount: 0,
    totalMinutes: 0,
    totalDistance: 0,
  });
  const [weeklyCounts, setWeeklyCounts] = useState<WeeklyCount[]>([]);
  const [hasMoreActivities, setHasMoreActivities] = useState(false);
  const [isLoadingMoreActivities, setIsLoadingMoreActivities] = useState(false);
  const [sessions, setSessions] = useState<ClubSession[]>([]);
  const [weeklyActivityGoal, setWeeklyActivityGoal] = useState(3);
  const [weeklyGoalDraft, setWeeklyGoalDraft] = useState(3);
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [goalMessage, setGoalMessage] = useState("");
  const [goalError, setGoalError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sessionMessage, setSessionMessage] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [sessionActionId, setSessionActionId] = useState<number | null>(null);
  const [sessionActivityFilter, setSessionActivityFilter] = useState("all");
  const [sessionLocationFilter, setSessionLocationFilter] = useState("");
  const [sessionView, setSessionView] = useState<"list" | "calendar">("list");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(2000, 0, 1));
  const [today, setToday] = useState<Date | null>(null);
  const [selectedActivityType, setSelectedActivityType] = useState("run-club");
  const selectedActivityGuide = activityGuides[selectedActivityType];
  const visibleSessions = sessions.filter((session) =>
    (sessionActivityFilter === "all" || session.activityType === sessionActivityFilter) &&
    session.location.toLowerCase().includes(sessionLocationFilter.trim().toLowerCase()),
  );
  const sessionsByDate = new Map<string, ClubSession[]>();
  for (const session of visibleSessions) {
    const dateKey = localDateKey(new Date(session.startsAt));
    const dateSessions = sessionsByDate.get(dateKey) ?? [];
    dateSessions.push(session);
    sessionsByDate.set(dateKey, dateSessions);
  }
  const calendarStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1 - calendarMonth.getDay());
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(calendarStart);
    day.setDate(calendarStart.getDate() + index);
    return day;
  });

  useEffect(() => {
    async function loadProgress() {
      try {
        const now = new Date();
        const weekStart = localWeekStart(now);
        const [response, sessionsResponse, goalResponse] = await Promise.all([
          fetch(`/api/activities?weekStart=${weekStart}`, { cache: "no-store" }),
          fetch("/api/sessions", { cache: "no-store" }),
          fetch("/api/goals", { cache: "no-store" }),
        ]);
        if (response.status === 401 || sessionsResponse.status === 401 || goalResponse.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) throw new Error("We couldn’t load your progress.");
        const result: {
          member: Member;
          activities: Activity[];
          summary: ActivitySummary;
          weeklyCounts: WeeklyCount[];
          hasMore: boolean;
        } = await response.json();
        setMember(result.member);
        setActivities(result.activities);
        setActivitySummary(result.summary);
        setWeeklyCounts(result.weeklyCounts);
        setHasMoreActivities(result.hasMore);
        if (!sessionsResponse.ok) throw new Error("We couldn’t load upcoming sessions.");
        const sessionResult: { sessions: ClubSession[] } = await sessionsResponse.json();
        setSessions(sessionResult.sessions);
        if (!goalResponse.ok) throw new Error("We couldn’t load your weekly goal.");
        const goalResult: { weeklyActivityGoal: number; currentDate: string } = await goalResponse.json();
        setWeeklyActivityGoal(goalResult.weeklyActivityGoal);
        setWeeklyGoalDraft(goalResult.weeklyActivityGoal);
        setToday(now);
        setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
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

      setActivities((current) => [result.activity!, ...current].slice(0, 50));
      setActivitySummary((current) => ({
        activityCount: current.activityCount + 1,
        attendedCount: current.attendedCount + (result.activity!.attended ? 1 : 0),
        totalMinutes: current.totalMinutes + result.activity!.durationMinutes,
        totalDistance: current.totalDistance + (result.activity!.distanceKm ?? 0),
      }));
      if (result.activity.attended) {
        const weekStart = localWeekStart(new Date(`${result.activity.activityDate}T00:00:00`));
        setWeeklyCounts((current) => {
          const found = current.find((week) => week.weekStart === weekStart);
          return found
            ? current.map((week) => week.weekStart === weekStart ? { ...week, count: week.count + 1 } : week)
            : [...current, { weekStart, count: 1 }];
        });
      }
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
    const activity = activities.find((item) => item.id === activityId);
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
      if (activity) {
        setActivitySummary((current) => ({
          activityCount: Math.max(0, current.activityCount - 1),
          attendedCount: Math.max(0, current.attendedCount - (activity.attended ? 1 : 0)),
          totalMinutes: Math.max(0, current.totalMinutes - activity.durationMinutes),
          totalDistance: Math.max(0, current.totalDistance - (activity.distanceKm ?? 0)),
        }));
        if (activity.attended) {
          const weekStart = localWeekStart(new Date(`${activity.activityDate}T00:00:00`));
          setWeeklyCounts((current) => current.map((week) => week.weekStart === weekStart
            ? { ...week, count: Math.max(0, week.count - 1) }
            : week));
        }
      }
    } catch {
      setError("We couldn’t reach the server. Check your connection and try again.");
    }
  }

  async function loadOlderActivities() {
    const oldestActivity = activities[activities.length - 1];
    if (!oldestActivity || !hasMoreActivities) return;

    setIsLoadingMoreActivities(true);
    setError("");
    try {
      const weekStart = localWeekStart(today ?? new Date());
      const params = new URLSearchParams({
        beforeDate: oldestActivity.activityDate,
        beforeId: String(oldestActivity.id),
        weekStart,
      });
      const response = await fetch(`/api/activities?${params}`, { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const result: { activities?: Activity[]; hasMore?: boolean; error?: string } = await response.json();
      if (!response.ok || !result.activities) throw new Error(result.error ?? "We couldn’t load older activities.");
      setActivities((current) => [...current, ...result.activities!]);
      setHasMoreActivities(result.hasMore ?? false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn’t load older activities.");
    } finally {
      setIsLoadingMoreActivities(false);
    }
  }

  async function changeReservation(session: ClubSession) {
    setSessionActionId(session.id);
    setSessionError("");
    setSessionMessage("");

    try {
      const response = session.isBooked || session.isWaitlisted
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

  async function saveWeeklyGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingGoal(true);
    setGoalError("");
    setGoalMessage("");
    try {
      const response = await fetch("/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeklyActivityGoal: weeklyGoalDraft }),
      });
      const result: { weeklyActivityGoal?: number; error?: string } = await response.json();
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok || result.weeklyActivityGoal === undefined) {
        setGoalError(result.error ?? "We couldn’t save your weekly goal.");
        return;
      }
      setWeeklyActivityGoal(result.weeklyActivityGoal);
      setGoalMessage("Weekly goal updated.");
    } catch {
      setGoalError("We couldn’t reach the server. Try again.");
    } finally {
      setIsSavingGoal(false);
    }
  }

  const currentWeekStart = today ? new Date(today.getTime()) : new Date(0);
  currentWeekStart.setHours(0, 0, 0, 0);
  currentWeekStart.setDate(currentWeekStart.getDate() - ((currentWeekStart.getDay() + 6) % 7));
  const weeklyBuckets = Array.from({ length: 7 }, (_, index) => {
    const start = new Date(currentWeekStart);
    start.setDate(currentWeekStart.getDate() - (6 - index) * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    const count = weeklyCounts.find((week) => week.weekStart === localDateKey(start))?.count ?? 0;
    return { start, count };
  });
  const currentWeekCount = weeklyBuckets[weeklyBuckets.length - 1].count;
  const weeklyChartMax = Math.max(weeklyActivityGoal, ...weeklyBuckets.map((week) => week.count), 1);

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
        <div className="progress-stat"><span>ACTIVITIES</span><strong>{isLoading ? "—" : activitySummary.activityCount}</strong></div>
        <div className="progress-stat"><span>ATTENDED</span><strong>{isLoading ? "—" : activitySummary.attendedCount}</strong></div>
        <div className="progress-stat"><span>TIME MOVING</span><strong>{isLoading ? "—" : `${Math.floor(activitySummary.totalMinutes / 60)}h ${activitySummary.totalMinutes % 60}m`}</strong></div>
        <div className="progress-stat"><span>DISTANCE</span><strong>{isLoading ? "—" : `${activitySummary.totalDistance.toFixed(1)} km`}</strong></div>
      </section>

      <section className="weekly-goal" aria-labelledby="weekly-goal-title">
        <div className="weekly-goal-heading">
          <div>
            <p className="eyebrow">A LITTLE, OFTEN</p>
            <h2 id="weekly-goal-title">Weekly consistency</h2>
            <p className="weekly-goal-current">This week: {currentWeekCount} of {weeklyActivityGoal} activities</p>
          </div>
          <form className="weekly-goal-form" onSubmit={saveWeeklyGoal}>
            <label className="form-field">
              <span>ACTIVITIES PER WEEK</span>
              <select onChange={(event) => setWeeklyGoalDraft(Number(event.target.value))} value={weeklyGoalDraft}>
                {Array.from({ length: 14 }, (_, index) => index + 1).map((count) => (
                  <option key={count} value={count}>{count} {count === 1 ? "activity" : "activities"}</option>
                ))}
              </select>
            </label>
            <button className="button button-dark" disabled={isSavingGoal || isLoading} type="submit">
              {isSavingGoal ? "Saving..." : "Save goal"}
            </button>
          </form>
        </div>
        <progress className="weekly-goal-progress" max={weeklyActivityGoal} value={Math.min(currentWeekCount, weeklyActivityGoal)}>
          {currentWeekCount} of {weeklyActivityGoal}
        </progress>
        <ol className="weekly-chart" aria-label="Attended activities per week for the past seven weeks">
          {weeklyBuckets.map((week) => (
            <li key={week.start.toISOString()}>
              <span className="weekly-chart-count">{week.count}</span>
              <div className="weekly-chart-track">
                <span style={{ height: `${Math.max(4, (week.count / weeklyChartMax) * 100)}%` }} />
              </div>
              <span className="weekly-chart-label">{week.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            </li>
          ))}
        </ol>
        {(goalMessage || goalError) && (
          <p aria-live="polite" className={`form-feedback${goalError ? " form-feedback-error" : " form-feedback-success"}`} role={goalError ? "alert" : "status"}>
            {goalError || goalMessage}
          </p>
        )}
      </section>

      <section className="member-sessions" aria-labelledby="member-sessions-title">
        <div className="member-sessions-heading">
          <div>
            <p className="eyebrow">MOVE WITH MESH</p>
            <h2 id="member-sessions-title">Upcoming sessions</h2>
          </div>
          <p>Find a spot that works for you.</p>
        </div>
        <div className="session-tools">
          <label className="session-filter">
            <span>ACTIVITY</span>
            <select onChange={(event) => setSessionActivityFilter(event.target.value)} value={sessionActivityFilter}>
              <option value="all">All activities</option>
              <option value="run-club">Run club</option>
              <option value="strength">Strength</option>
              <option value="recovery">Recovery</option>
            </select>
          </label>
          <label className="session-filter session-location-filter">
            <span>LOCATION</span>
            <input onChange={(event) => setSessionLocationFilter(event.target.value)} placeholder="Search locations" value={sessionLocationFilter} />
          </label>
          <div className="session-view-switch" aria-label="Session view">
            <button aria-pressed={sessionView === "list"} onClick={() => setSessionView("list")} type="button">List</button>
            <button aria-pressed={sessionView === "calendar"} onClick={() => setSessionView("calendar")} type="button">Calendar</button>
          </div>
        </div>
        {isLoading ? (
          <p className="activity-empty">Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <p className="activity-empty">There are no upcoming sessions right now. Check back soon.</p>
        ) : visibleSessions.length === 0 ? (
          <p className="activity-empty">No sessions match these filters.</p>
        ) : sessionView === "calendar" ? (
          <div className="session-calendar">
            <div className="session-calendar-heading">
              <button aria-label="Previous month" onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))} type="button">←</button>
              <h3>{calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h3>
              <button aria-label="Next month" onClick={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))} type="button">→</button>
            </div>
            <div className="session-calendar-scroll">
              <div className="session-calendar-grid">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <span className="session-calendar-weekday" key={day}>{day}</span>
                ))}
                {calendarDays.map((day) => {
                  const key = localDateKey(day);
                  const daySessions = sessionsByDate.get(key) ?? [];
                  return (
                    <div className={`session-calendar-day${day.getMonth() === calendarMonth.getMonth() ? "" : " session-calendar-day-outside"}`} key={key}>
                      <span className="session-calendar-date">{day.getDate()}</span>
                      {daySessions.map((session) => (
                        <span className="session-calendar-event" key={session.id} title={`${session.title} · ${session.location}`}>
                          {new Date(session.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} {session.title}
                        </span>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <ul className="member-session-list">
            {visibleSessions.map((session) => (
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
                    <span>{session.isWaitlisted ? "Waitlisted" : `${session.spotsLeft} ${session.spotsLeft === 1 ? "spot" : "spots"} left`}</span>
                  </div>
                </div>
                <button
                  className={session.isBooked || session.isWaitlisted ? "session-reserve session-reserve-booked" : "session-reserve"}
                  disabled={sessionActionId === session.id}
                  onClick={() => void changeReservation(session)}
                  type="button"
                >
                  {sessionActionId === session.id ? "Updating..." : session.isBooked ? "Cancel spot" : session.isWaitlisted ? "Leave waitlist" : session.spotsLeft === 0 ? "Join waitlist" : "Reserve spot"}
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
          {hasMoreActivities && (
            <button className="activity-load-more" disabled={isLoadingMoreActivities} onClick={() => void loadOlderActivities()} type="button">
              {isLoadingMoreActivities ? "Loading..." : "Load older activities"}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}