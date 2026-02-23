# Task Tracker (Supabase Cloud Sync)

Premium-looking daily/weekly task tracker with Supabase Auth + Postgres sync.

## What this app supports

- Day / Week task views
- Task CRUD (add/edit/delete)
- Daily and weekly completion tracking
- Admin user switching (`View User` dropdown)
- Cloud import/export backup tools
- Legacy localStorage migration banner + one-click migration
- Responsive UI (glass + gradient styling)

---

## Prerequisites

- A Supabase project
- Browser access to Supabase SQL Editor and Authentication dashboard
- GitHub Pages (or any static hosting)

---

## Setup order (exact sequence)

1. **Create Supabase project**
   - Supabase Dashboard → **New project**.

2. **Create Auth users (email/password)**
   - Dashboard → **Authentication** → **Users** → **Add user**.
   - Create at least:
     - one regular user (example: `pradeep@app.local`)
     - one regular user (example: `sankar@app.local`)
     - one admin user (example: `master@app.local`)

3. **Run schema + RLS SQL**
   - Dashboard → **SQL Editor** → **New query**.
   - Paste and run: `task-tracker/supabase/schema.sql`.

4. **Insert profile rows mapped to Auth user IDs**
   - Dashboard → **Table Editor** → `auth.users` and copy each user `id`.
   - Insert rows into `public.profiles` with matching `id` values:
     - `username`: short handle used by app (example: `pradeep`)
     - `display_name`: label for UI (example: `Pradeep`)
     - `role`: `user` or `admin`

   Example SQL (replace UUIDs):
   ```sql
   insert into public.profiles (id, username, display_name, role)
   values
     ('00000000-0000-0000-0000-000000000001', 'pradeep', 'Pradeep', 'user'),
     ('00000000-0000-0000-0000-000000000002', 'sankar', 'Sankar', 'user'),
     ('00000000-0000-0000-0000-000000000003', 'master', 'Master', 'admin')
   on conflict (id) do update
   set username = excluded.username,
       display_name = excluded.display_name,
       role = excluded.role;
   ```

5. **Get project API keys**
   - Dashboard → **Project Settings** → **API**.
   - Copy:
     - Project URL
     - anon public key

6. **Configure frontend globals**
   - Before `task-tracker/app.js` runs, define:
   ```html
   <script>
     window.TASK_TRACKER_SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
     window.TASK_TRACKER_SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
   </script>
   ```
   - Keep this script in `task-tracker/index.html` and `task-tracker/dashboard.html` (or shared include) before loading `app.js`.

7. **Open app and sign in**
   - Visit `/task-tracker/`
   - Sign in using Auth email/password from step 2.

---

## Run / validation flow

1. Sign in as regular user and verify only own tasks are visible.
2. Add/edit/delete tasks, then refresh page to confirm cloud persistence.
3. Sign in as admin and switch users using **View User**.
4. Use export/import to validate backup path.
5. If old browser keys exist (`tasks_<username>`), test migration banner action.

---

## Local developer checks

- Syntax check:
  ```bash
  node --check task-tracker/app.js
  ```

---

## Notes

- This is a static frontend; the anon key is expected client-side.
- RLS policies in `schema.sql` are what enforce data isolation.
- Admin is determined by `profiles.role = 'admin'`.
