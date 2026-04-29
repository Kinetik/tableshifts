# TableShifts Flowbite Individual Redesign Design

## Purpose

Rebuild the `development` branch interface from a clean slate while preserving the existing Supabase model and deployment flow. The first usable slice is Individual TableShifts only. Admin login and account creation appear as polished but inactive UI until those areas are rebuilt later.

## Product Scope

In scope for this slice:

- Premium Calm focused SaaS login screen.
- Visible but inactive admin login, admin creation, and workspace affordances.
- One active action from the login screen: create/open a new Individual TableShift.
- New Individual TableShifts interface with a compact Top Command Bar layout.
- Existing database-linked individual table persistence through `individual_tables`, `get_individual_table`, and `save_individual_table`.
- Light/dark mode control and desktop/mobile table mode control.
- Share link copy UI.
- Import/export and core spreadsheet-style editing already expected by Individual TableShifts.

Out of scope for this slice:

- Rebuilding Admin Account creation.
- Rebuilding authenticated company workspaces.
- Rebuilding management, leave requests, charts, settings, or payroll admin flows.
- Changing the Supabase schema.
- Merging this work into `main` before the Vercel `development` deployment is reviewed.

## Visual Direction

Use a Premium Calm SaaS direction: restrained, trustworthy, compact, and modern. The app should feel like a polished 2026 productivity tool, not a heavy HR dashboard. The interface should reduce bulk from the current redesign by using smaller typography, tighter controls, less card padding, and stronger table-first hierarchy.

The palette should be neutral with a controlled teal accent. Dark mode should feel intentional, not inverted as an afterthought. Visual impact should come from clarity, spacing discipline, interaction polish, and well-placed status color rather than large decorative sections.

## Login Screen

The root screen presents a focused SaaS login composition:

- Left side: TableShifts brand, concise value statement, and a compact visual preview of the monthly table.
- Right side: login panel with email/password fields, sign-in button, and admin/create-account affordances.
- Admin/login actions are visibly disabled or produce a simple "coming next" state.
- The active primary product path is a button such as "Create Individual TableShift".

Clicking the Individual TableShifts action creates a new table id, saves a default table to Supabase through the existing RPC, and opens the individual table view.

## Individual TableShifts Layout

Use the Top Command Bar layout. The table is the main object on screen. Controls sit above it in a compact toolbar instead of a side panel.

Expected command bar controls:

- Month selector.
- Normal shift hours input.
- Add employee row.
- Import employees.
- Export.
- Share link / copy link.
- Desktop/mobile table mode toggle.
- Light/dark mode toggle.
- Compact overflow menu for secondary actions.

The table should use Flowbite/DataTables visual language for headers, density, hover states, responsive behavior, borders, and table chrome. The editable spreadsheet behavior remains custom where needed because Individual TableShifts is not just a static sortable data table.

Expected table behavior:

- Editable employee fields.
- Editable day cells.
- Special event / absence / vacation / medical / overtime status choices.
- Public holiday display.
- Totals and compact KPIs.
- Supabase persistence for linked shared tables.
- Shareable link loading for existing tables.

## Mobile Mode

Mobile should not simply squeeze the desktop spreadsheet until it becomes unusable. Provide a desktop/mobile mode switch and allow automatic responsive behavior.

The mobile layout can use a more vertical row-focused view: employee cards or grouped rows, horizontally scrollable days when useful, and compact action menus. The goal is to preserve editing confidence on small screens while keeping the desktop table powerful.

## Flowbite Inputs

Use Flowbite broadly as the design vocabulary, including:

- Table header and application table patterns from Flowbite Blocks.
- Toasts for save, share, import, export, and error feedback.
- Floating labels for compact login and metadata forms.
- Select components for month and mode controls.
- Popovers for contextual cell actions and compact help.
- Clipboard component patterns for share link copy.
- Footer only if it can stay quiet and useful on the login screen.
- Speed dial only if it improves mobile table actions without hiding essentials.
- Small charts only if they clarify table state, such as worked hours, variance, or absence mix.
- Flowbite icons as the preferred icon style for this redesign.

Avoid turning the app into a component showcase. Components should make TableShifts simpler, denser, clearer, or more satisfying.

## Data Flow

The first slice keeps the current Supabase structure:

- `individual_tables.share_token` identifies a shared table.
- `get_individual_table(token_value text)` loads table JSON.
- `save_individual_table(token_value text, data_value jsonb)` creates or updates table JSON.

The UI should preserve the current migration/defaulting behavior so old individual tables continue to open if their JSON shape is missing newer fields.

## Error Handling

Use concise Flowbite-style toasts/alerts:

- Missing Supabase config: show a blocking configuration message.
- Create table failure: keep user on login and explain retry.
- Save failure: show non-destructive error toast and keep local edits visible.
- Import failure: explain expected file/template shape.
- Copy link success/failure: use clipboard feedback.

## Verification

Primary verification will be through Vercel `development` deployments, not local dev server. Before pushing, run any available static checks if the machine supports them. If local npm remains unavailable, rely on Vercel build feedback and inspect the deployed preview.

Acceptance criteria:

- Root screen shows the Premium Calm login.
- Login/admin/create-account controls are inactive/dummy.
- Individual TableShifts button creates a new database-linked table.
- Existing shared individual table links still load.
- Individual table edits persist through Supabase.
- Desktop table is compact and readable.
- Mobile mode is usable and intentionally designed.
- Light/dark mode works visibly.
- Share link copy works with clear feedback.
