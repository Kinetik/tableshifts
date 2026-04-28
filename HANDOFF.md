# TableShifts Handoff

Use this file when moving the project to a new computer or a fresh Codex thread.

## Current Shape

- Production domain: `https://tableshifts.com`
- Vercel project: `tableshifts`
- GitHub repository: `https://github.com/Kinetik/tableshifts`
- Stable production branch: `main`
- Working branch used for the redesign: `development`
- Runtime: Next.js, React, Tailwind CSS, shadcn/Radix-style components
- Database/auth/storage: Supabase

The old vanilla app is preserved in `legacy-app/`. The active app is the Next.js implementation under `src/`.

## New Mac Setup

1. Install GitHub Desktop, Node.js, and VS Code or Cursor.
2. Clone `https://github.com/Kinetik/tableshifts` into:

   ```bash
   /Users/valentinivan/Documents/GitHub/tableshifts
   ```

3. Open the repo folder and install dependencies:

   ```bash
   npm install
   ```

4. Copy or recreate `.env.local` from Vercel/Supabase settings. Required values:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   SUPABASE_DB_URL=...
   ```

5. Run locally:

   ```bash
   npm run dev
   ```

6. Open:

   ```text
   http://localhost:3000
   ```

## Vercel / Git Workflow

- `main` deploys to production: `tableshifts.com`
- `development` deploys to a Vercel preview/development URL.
- Normal flow:
  1. Work on `development`.
  2. Push to origin.
  3. Test the Vercel preview URL.
  4. Open a PR from `development` into `main`.
  5. Merge only when the preview is good.

If GitHub Desktop asks for a commit summary, use a short clear title like:

```text
Refine individual tables and login polish
```

## Important Files

- `src/app/page.tsx`: app entry point
- `src/components/tableshifts-redesign.tsx`: main UI and most business interaction logic
- `src/lib/tableshifts.ts`: shared app helpers/types
- `src/components/ui/`: local shadcn/Radix-style UI primitives
- `src/app/globals.css`: global styling
- `supabase/schema.sql`: database schema, RLS policies, storage buckets
- `supabase/README.md`: Supabase tenant/data model notes
- `api/*.js`: service-role API routes for privileged Supabase operations
- `legacy-app/`: previous vanilla app kept as fallback/reference

## Supabase Model

TableShifts uses one Supabase project and one shared Postgres database.

Each Admin Account owns an isolated environment in `admin_environments`. Business data is scoped by `environment_id`, not by separate physical databases. This means deleting an Admin Account should delete its environment-scoped companies, departments, users, timesheets, leave requests, documents, holidays, and logs through the app cleanup logic.

Core tables:

- `admin_environments`
- `profiles`
- `companies`
- `departments`
- `payroll_company_access`
- `timesheet_entries`
- `leave_requests`
- `national_holidays`
- `documents`
- `audit_logs`
- `individual_tables`

Storage buckets:

- `company-logos`
- `leave-documents`

## Current Feature State

Implemented:

- Supabase-backed login and Admin Account environment creation
- Company/environment scoping
- Management sidebar workflow
- Company creation from sidebar
- Company/departments management
- Employee/team leader/department manager creation
- Timesheet grid with keyboard editing and right-click status menu
- Overtime inferred from hours above shift norm
- Fill/Clear row actions
- Leave requests and generated leave request document preview/download
- Charts page with workload stack, KPIs, radial summaries, variance signals, department balance, and exception ranking
- Individual TableShifts with shareable links, Supabase storage, public holidays, XLSX employee import/template, export CSV, KPIs, daily bar strip, frozen employee column, totals expansion, and right-click menu

Recent polish before this handoff:

- Individual TableShifts normal-hours input renamed to `Shifts`
- Individual top controls tightened
- Individual right-click menu and Special Event submenu narrowed
- Apple/Google auth buttons removed for now
- Login headline changed to: `Track work hours in a clean, familiar table as simple as a spreadsheet.`

## Known Decisions

- Apple and Google login are intentionally not enabled yet, even though Supabase supports them.
- Individual TableShifts is separate from company environments and can be edited by anyone with the generated link.
- The production app should stay stable on `main`; redesign work should continue on `development` or a new branch.
- Avoid changing production directly without testing on Vercel preview first.

## Suggested Next Work

Near-term:

- Test production after the latest merge.
- On the new Mac, confirm local build with `npm run build`.
- Create a fresh branch from `development` for the next batch.
- Revisit any remaining visual polish in Individual TableShifts after seeing it on the MacBook Pro screen.

Future product ideas already discussed:

- Add Apple/Google auth later through Supabase providers.
- Improve leave document/file storage flows.
- Add more management-side editing flows and validations.
- Continue the shadcn-style visual refinement where forms still feel too large or cramped.
- Add future Supabase tables as environment-scoped tables, following `supabase/README.md`.

## Useful Commands

```bash
npm install
npm run dev
npm run build
npm run db:apply
git status
git branch
git pull
git push
```

## Good Restart Prompt For Codex

```text
We are continuing TableShifts from this repository:
/Users/valentinivan/Documents/GitHub/tableshifts

Read HANDOFF.md and supabase/README.md first. The active app is the Next.js/shadcn redesign in src/components/tableshifts-redesign.tsx. Production is main/tableshifts.com, and development work should happen on development or a new branch. Please inspect the current branch and worktree before making changes.
```
