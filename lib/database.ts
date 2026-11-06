import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const globalForDatabase = globalThis as typeof globalThis & {
  meshSportsDatabase?: Database.Database;
};

export function getDatabase(): Database.Database {
  if (!globalForDatabase.meshSportsDatabase) {
    const databasePath =
      process.env.MESH_DB_PATH ?? join(process.cwd(), "data", "mesh-sports.sqlite");

    mkdirSync(dirname(databasePath), { recursive: true });

    const database = new Database(databasePath);
    database.pragma("journal_mode = WAL");
    database.pragma("foreign_keys = ON");
    database.exec(`
      CREATE TABLE IF NOT EXISTS join_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
        email TEXT NOT NULL CHECK (length(email) <= 254),
        phone TEXT CHECK (phone IS NULL OR length(phone) <= 40),
        program TEXT NOT NULL CHECK (
          program IN ('run-club', 'strength', 'recovery', 'not-sure')
        ),
        status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_join_requests_email
        ON join_requests (email);
      CREATE INDEX IF NOT EXISTS idx_join_requests_created_at
        ON join_requests (created_at);

      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 100),
        email TEXT NOT NULL UNIQUE CHECK (length(email) <= 254),
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS member_sessions (
        token_hash TEXT PRIMARY KEY,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_member_sessions_member
        ON member_sessions (member_id);

      CREATE TABLE IF NOT EXISTS member_identities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        provider TEXT NOT NULL CHECK (provider IN ('google')),
        provider_subject TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (provider, provider_subject),
        UNIQUE (member_id, provider)
      );

      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        activity_type TEXT NOT NULL CHECK (
          activity_type IN ('run-club', 'strength', 'recovery', 'other')
        ),
        activity_date TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 1440),
        distance_km REAL CHECK (distance_km IS NULL OR distance_km BETWEEN 0 AND 1000),
        attended INTEGER NOT NULL DEFAULT 1 CHECK (attended IN (0, 1)),
        notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_activities_member_date
        ON activities (member_id, activity_date DESC, id DESC);

      CREATE TABLE IF NOT EXISTS club_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity_type TEXT NOT NULL CHECK (activity_type IN ('run-club', 'strength', 'recovery')),
        title TEXT NOT NULL CHECK (length(title) BETWEEN 2 AND 120),
        starts_at TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 720),
        location TEXT NOT NULL CHECK (length(location) BETWEEN 2 AND 160),
        capacity INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 100),
        description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 600),
        is_cancelled INTEGER NOT NULL DEFAULT 0 CHECK (is_cancelled IN (0, 1)),
        created_by INTEGER NOT NULL REFERENCES members(id),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_club_sessions_start
        ON club_sessions (starts_at, is_cancelled);

      CREATE TABLE IF NOT EXISTS session_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES club_sessions(id) ON DELETE CASCADE,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled')),
        booked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        attended INTEGER CHECK (attended IS NULL OR attended IN (0, 1)),
        UNIQUE (session_id, member_id)
      );
      CREATE INDEX IF NOT EXISTS idx_session_bookings_member_status
        ON session_bookings (member_id, status, session_id);
      CREATE TABLE IF NOT EXISTS session_waitlist (
        session_id INTEGER NOT NULL REFERENCES club_sessions(id) ON DELETE CASCADE,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (session_id, member_id)
      );
      CREATE INDEX IF NOT EXISTS idx_session_waitlist_order
        ON session_waitlist (session_id, created_at, member_id);
      CREATE TABLE IF NOT EXISTS member_goals (
        member_id INTEGER PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
        weekly_activity_goal INTEGER NOT NULL DEFAULT 3 CHECK (weekly_activity_goal BETWEEN 1 AND 14),
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const joinRequestColumns = database.prepare("PRAGMA table_info(join_requests)").all() as Array<{ name: string }>;
    if (!joinRequestColumns.some((column) => column.name === "status")) {
      database.exec("ALTER TABLE join_requests ADD COLUMN status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed'))");
    }
    const bookingColumns = database.prepare("PRAGMA table_info(session_bookings)").all() as Array<{ name: string }>;
    if (!bookingColumns.some((column) => column.name === "attended")) {
      database.exec("ALTER TABLE session_bookings ADD COLUMN attended INTEGER CHECK (attended IS NULL OR attended IN (0, 1))");
    }

    globalForDatabase.meshSportsDatabase = database;
  }

  return globalForDatabase.meshSportsDatabase;
}
