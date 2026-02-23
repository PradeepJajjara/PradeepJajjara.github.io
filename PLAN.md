# Rich UI/UX Upgrade Plan (Simple App, Premium Feel)

## Summary
Keep the app flow simple (Login + Dashboard + Task Modal), but redesign the visual system to feel premium and modern while we implement Supabase sync/auth from the previous plan.  
Chosen defaults: **Glass + gradient style**, **moderate purposeful motion**, **teal/amber/slate palette**.

## Design Direction (Locked)
1. Visual language:
- Soft layered gradients in background.
- Glassmorphism cards with strong depth hierarchy.
- Accent colors: teal (primary), amber (progress/highlight), slate (base).

2. Typography:
- Replace default stack with expressive but readable pair:
  - Headings: `Sora`
  - Body/UI: `Manrope`
- Stronger scale: hero/dashboard title, section labels, compact metadata.

3. Layout:
- Keep only a few pages:
  - `index.html` (auth)
  - `dashboard.html` (all task operations)
- Add clearer panel structure:
  - Top bar
  - KPI strip
  - View controls
  - Task grid
  - Summary rail

## Implementation Work (Decision-Complete)

1. `task-tracker/styles.css` full design-system refactor
- Introduce tokenized CSS variables:
  - `--bg-1`, `--bg-2`, `--surface-glass`, `--text-strong`, `--accent-teal`, `--accent-amber`, `--danger`, radius/spacing/shadow tokens.
- Replace purple-leaning gradients with teal/slate/amber theme.
- Add reusable surface classes for cards, chips, buttons, inputs.
- Improve mobile-first spacing and breakpoints.

2. `task-tracker/index.html` UX polish
- Upgrade login card with richer hierarchy and cleaner help text.
- Add subtle illustration/shape background layers via CSS only.
- Keep form simple: email + password + clear error state.

3. `task-tracker/dashboard.html` visual structure improvements
- Convert stats into visually distinct KPI cards.
- Refine admin user switch as styled control panel.
- Improve task cards with clearer type badge, progress zone, action cluster.
- Keep existing feature set unchanged (no new workflow complexity).

4. `task-tracker/app.js` UX behavior polish
- Fix current completion bug in `toggleTaskCompletion`.
- Add lightweight UI state feedback:
  - loading skeleton when fetching tasks
  - success/error toasts for save/import/export/auth actions
  - empty-state illustration text treatment
- Preserve current Day/Week interactions.

5. Motion system (moderate, purposeful)
- Page entrance fade/slide.
- Staggered card reveal for stats/tasks.
- Checkbox completion pop + progress bar smooth fill.
- Modal open/close easing.
- Respect `prefers-reduced-motion` for accessibility.

6. Accessibility/readability pass
- Improve color contrast for text and controls.
- Clear focus-visible styles on all interactive elements.
- Minimum tap target sizing for mobile controls.

## Public Interfaces / Contract Changes
1. CSS contract:
- New global design tokens in `:root`.
- New utility classes for surfaces/states (`.glass-card`, `.status-pill`, `.toast`, `.skeleton`).

2. DOM contract (small additions):
- Add containers for toast stack and loading skeletons in `dashboard.html`.
- Keep existing IDs used by JS to avoid regressions.

3. JS interface:
- Add UI helper functions (`showToast`, `setLoadingState`) without changing task data shape.

## Test Cases and Scenarios
1. Visual consistency:
- Login/dashboard render correctly on mobile and desktop.
- All cards/buttons/inputs follow tokenized style.

2. Interaction:
- Add/edit/delete task still works.
- Day/Week toggle still works.
- Completion toggle updates stats/summary without runtime error.

3. Motion/accessibility:
- Animations run smoothly on normal settings.
- Reduced-motion mode removes non-essential animation.
- Keyboard focus indicators visible across controls.

4. Role-specific UI:
- User account sees own data only.
- Admin can switch users with polished controls.

5. Data + UX feedback:
- Save/import/export/auth actions show success/error feedback.
- Empty and loading states are visually clear.

## Assumptions and Defaults
1. Keep app structure simple (no extra pages beyond login/dashboard).
2. Keep feature scope stable; this is a UX upgrade, not product expansion.
3. Use CSS + vanilla JS only (no framework migration).
4. Use chosen defaults since you delegated design direction:
- Glass + gradient
- Teal/amber/slate theme
- Moderate purposeful motion
