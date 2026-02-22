# Cloud-Synced Task Tracker Plan (Supabase, Multi-Device, Multi-User)

## Summary
Convert `task-tracker` from localStorage-only auth/data to Supabase-backed auth + database so you and your friend can log in from any device and see synced tasks.  
Keep current UI/UX as much as possible, keep admin controls, keep JSON backup tools, and add one-time migration from old localStorage data (replace cloud data strategy).

## Scope
- In scope:
1. Fix current runtime bug in `task-tracker/app.js` task completion flow.
2. Replace hardcoded client auth (`USERS`) with Supabase Auth.
3. Move task storage from `localStorage.tasks_*` to Supabase `tasks` table.
4. Keep private user data + admin cross-user visibility/edit.
5. Add legacy migration flow from localStorage to cloud.
6. Keep export/import tools (now cloud-aware).
7. Update docs (`task-tracker/README.md`, `SUMMARY.md`) with setup/run steps.

- Out of scope:
1. Building secure “create user from master UI” backend endpoint.
2. Realtime collaborative editing/websockets.
3. Notifications/reminders.

## Architecture Decisions (Locked)
1. Backend: Supabase free tier.
2. Login method: app email + app password (Supabase Auth credentials, not personal email password).
3. User creation: manual in Supabase dashboard.
4. Visibility model: private users + admin can view/edit all users.
5. Migration conflict strategy: local legacy data replaces cloud data for migrated user(s).
6. Backup tools: remain in app.

## Data Model and Policies

### Tables
1. `profiles`
- `id uuid primary key` (matches `auth.users.id`)
- `username text unique not null` (e.g., `pradeep`, `sankar`, `master`)
- `display_name text not null`
- `role text not null check (role in ('user','admin'))`
- `created_at timestamptz default now()`

2. `tasks`
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references profiles(id) on delete cascade`
- `name text not null`
- `type text not null check (type in ('daily','weekly'))`
- `description text default ''`
- `target integer null`
- `completions jsonb not null default '{}'::jsonb`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### RLS (Row Level Security)
1. Enable RLS on `profiles` and `tasks`.
2. `profiles` policies:
- User can read own profile.
- Admin can read all profiles.
3. `tasks` policies:
- User can CRUD own tasks (`auth.uid() = user_id`).
- Admin can CRUD all tasks (via `exists` check on caller role in `profiles`).

## Frontend Changes by File

1. `task-tracker/index.html`
- Change login input from `username` to `email`.
- Keep password input.
- Update helper text to app-account guidance.

2. `task-tracker/dashboard.html`
- Keep existing layout.
- Keep admin “View User” controls but populate from `profiles` query instead of hardcoded options.
- Add migration CTA/banner when legacy local data exists.

3. `task-tracker/app.js`
- Remove hardcoded `USERS`.
- Add Supabase client init (`@supabase/supabase-js` CDN script + config constants).
- Replace login logic with `supabase.auth.signInWithPassword`.
- Replace session checks with `supabase.auth.getUser`/`getSession`.
- Load current profile (`username`, `role`) after auth.
- Replace `getTasks/saveTasks` localStorage persistence with Supabase queries.
- Keep in-memory rendering shape compatible with existing UI.
- Fix `toggleTaskCompletion` bug:
  - replace invalid `Stats();` with `renderStats();`
  - call `renderSummary();` correctly
  - persist before/after render in a single consistent order.
- Keep export/import:
  - export from cloud tasks.
  - import writes to cloud (replace user data after confirmation).
- Admin user switch:
  - query target user profile IDs and fetch their tasks.

4. `task-tracker/styles.css`
- Minimal style adjustments for new migration banner/status messages only.

5. `task-tracker/README.md`
- Add Supabase setup:
  - create project
  - create auth users
  - set `profiles` rows and role values
  - run SQL schema + RLS policies
  - put `SUPABASE_URL` and `SUPABASE_ANON_KEY` in frontend config.
- Add known limitations and security notes.

6. `SUMMARY.md`
- Update architecture section to cloud-sync + Supabase auth/db.

## Public Interfaces / Contracts

### Frontend task object (internal)
```js
{
  id: string,            // uuid from Supabase
  user_id: string,       // uuid
  name: string,
  type: 'daily'|'weekly',
  description: string,
  target: number|null,
  completions: { [yyyy_mm_dd]: true },
  created_at: string,
  updated_at: string
}
```

### Auth/session contract
- Session source of truth: Supabase Auth, not localStorage credentials.
- LocalStorage retained only for non-sensitive flags and legacy migration detection.

### SQL setup contract
- Implementer provides one SQL script containing:
1. table creation
2. indexes
3. RLS enablement
4. policies
5. helper trigger for `updated_at`

## Migration Plan
1. Detect legacy keys (`tasks_pradeep`, `tasks_sankar`) on dashboard load.
2. If current user has matching legacy key, show “Migrate My Legacy Data” button.
3. For admin, show “Migrate Legacy Data for All Known Users”.
4. On migrate:
- parse legacy tasks
- map to cloud rows
- delete existing cloud tasks for target user(s)
- insert migrated tasks
- mark migration complete flag locally to avoid repeat prompts.

## Testing and Acceptance Criteria

### Functional
1. User login:
- valid app email/password logs in
- invalid credentials show clear error.
2. Cross-device sync:
- create/edit/delete task on mobile
- same account on laptop reflects latest data after reload.
3. Isolation:
- `pradeep` cannot read/edit `sankar` tasks.
4. Admin:
- admin can switch users and CRUD both users’ tasks.
5. Daily/weekly completion:
- toggles persist and render correctly in Day/Week views.
6. Migration:
- legacy import replaces cloud data for selected user(s).
7. Backup:
- export downloads JSON from cloud data.
- import replaces cloud tasks after confirmation.

### Regression
1. Existing modal add/edit/delete workflows still work.
2. Existing stats/summary calculations remain correct.
3. Logout clears session and redirects properly.
4. Responsive layout still usable on phone width.

## Assumptions and Defaults
1. GitHub Pages remains frontend host.
2. Supabase anon key is stored client-side (expected for browser apps).
3. Account creation happens in Supabase dashboard, not in-app.
4. App uses dedicated app credentials; no personal email password sharing required.
5. Username concept stays as profile metadata/display, while login uses email.
6. Existing `styles-old.css` remains untouched unless explicitly requested for cleanup.
