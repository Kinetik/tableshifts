# TableShifts Supabase Structure

TableShifts uses one Supabase project and one shared Postgres database.

Each Admin Account owns one isolated environment in `admin_environments`. Business data is scoped by `environment_id`, so future sections can be added as new tables without creating a separate physical database per Admin Account.

## Core Tables

- `admin_environments`: one tenant/workspace per Admin Account
- `profiles`: authenticated users and roles
- `companies`: companies inside an Admin environment
- `departments`: department setup, shift hours, and normal work days
- `payroll_company_access`: which companies Payroll Admin users may manage
- `timesheet_entries`: day-level timesheet rows
- `leave_requests`: CO, CM, and Special Event requests
- `national_holidays`: scoped holiday setup
- `documents`: metadata for files stored in Supabase Storage
- `audit_logs`: company, department, user, and future setup/change logs
- `individual_tables`: public-link Individual TableShifts JSON snapshots with 90-day expiry

## Storage Buckets

- `company-logos`
- `leave-documents`

Files should be stored under a first path segment matching the Admin environment id:

```text
<environment_id>/<company_id>/<file>
<environment_id>/<leave_request_id>/<file>
```

The storage policies use that first folder to keep files isolated per Admin environment.

## Future Sections

Add future app areas as new environment-scoped tables, for example:

- `payroll_exports`
- `shift_templates`
- `notifications`
- `employee_documents`
- `contract_records`
- `approval_rules`

Every new business table should include `environment_id`, relevant foreign keys, indexes, and RLS policies before the UI writes to it.

## Individual TableShifts

Individual TableShifts are stored outside Admin environments because they are public-link, no-login table instances. RLS blocks direct table access; the app reads and writes only through `get_individual_table` and `save_individual_table`.

The `expires_at` column is fixed when the table is first created. Later saves update `table_data` but preserve the original expiry, so editing a shared table does not extend its 90-day shelf life.
