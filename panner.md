# Task Tracker Implementation Plan

## Goal
Build a simple multi-user task tracker with premium UI/UX and cloud sync so users can log in from any device and see the same tasks.

## Product Scope
- Pages: `task-tracker/index.html` (login), `task-tracker/dashboard.html` (main app)
- Keep workflow simple: login, add/edit/delete tasks, day/week completion, stats, summary, export/import
- Data model: daily + weekly goals

## Architecture
- Frontend: HTML/CSS/Vanilla JS on GitHub Pages
- Auth + Database: Supabase
- Sync: All task CRUD via Supabase tables
- Roles:
  - `user`: own tasks only
  - `admin`: can view/edit all users via switcher

## Supabase Setup (Required)
1. Create project in Supabase
2. Create auth users (app-specific email/password)
3. Create `profiles` table and `tasks` table
4. Add RLS policies for user/admin behavior
5. Set frontend config:
   - `window.TASK_TRACKER_SUPABASE_URL`
   - `window.TASK_TRACKER_SUPABASE_ANON_KEY`

## UI Direction
- Glass + gradient
- Teal/amber/slate palette
- Fonts: Sora + Manrope
- Moderate purposeful motion
- Responsive first

## Implementation Checklist
- [x] Replace login page with app-email auth UI and richer visual layout
- [x] Replace dashboard shell with premium layout (KPI row, controls panel, summary rail)
- [x] Build tokenized design system in CSS
- [x] Add toast and skeleton UI contracts
- [x] Fix task completion runtime bug path
- [x] Migrate app logic to Supabase auth + cloud task CRUD
- [x] Add legacy localStorage to cloud migration helper flow
- [x] Keep export/import features with cloud data
- [ ] Add SQL schema + RLS script file in repo
- [ ] Update `task-tracker/README.md` with exact Supabase setup/run docs
- [ ] Update `SUMMARY.md` to reflect cloud architecture and new UX
- [ ] Manual browser validation on mobile + desktop

## Notes For Next Session
- Validate all role flows using real Supabase data
- Add SQL migration script to reduce setup friction
- Tighten minor UI spacing after live data test if needed
