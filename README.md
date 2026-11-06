# Mesh Sports

Mesh Sports is a Next.js app with SQLite-backed member accounts, activity tracking,
and a session inquiry form.

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the app:

   ```bash
   npm run dev
   ```

   Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The SQLite database
   and `join_requests` table are created automatically when the first request
   is submitted.

By default, submissions are stored in `data/mesh-sports.sqlite`. To use another
database file, set `MESH_DB_PATH` in `.env.local`; `.env.example` shows the
optional setting. Keep the database file on persistent storage when deploying.

## Signup API

The `/join` page submits to `POST /api/join`. The endpoint validates the name,
email, optional phone number, and selected program, then inserts the request
into SQLite using a parameterized statement. The table definition is in
`database/schema.sql`.

## Members and staff

Members can create an account, browse upcoming sessions, reserve or cancel a
spot, and log completed activity from `/progress`. Staff can publish, edit, or
cancel sessions and manage join inquiries from `/staff`.

To enable staff access, add the email address of an existing member account to
`MESH_ADMIN_EMAILS` in `.env.local` as a comma-separated list, then restart the
app. Staff accounts are not created automatically. The staff desk is protected
by this allowlist; member APIs continue to require a signed-in session.

No session schedule is preloaded. Add real times, locations, capacities, and
details through the staff desk. Inquiry statuses are tracked in the app, but
the app does not send email notifications; staff follow up using the contact
details shown in each inquiry.

## Google sign-in

Google sign-in uses OpenID Connect. Create a Google OAuth web client and add the
client ID and secret to `.env.local` using `.env.example` as a template. Register
the following authorized redirect URI in Google Cloud:

```text
http://127.0.0.1:3000/api/auth/google/callback
```

Set `AUTH_BASE_URL` to the origin users visit. For production, use the HTTPS
origin for the deployed app and register its `/api/auth/google/callback` URL.
Restart the development server after changing environment values. Google
accounts must have a verified email; an existing member with that email is
not silently linked. Sign in to the existing account and use **Connect Google**
from the progress dashboard to link it safely.
