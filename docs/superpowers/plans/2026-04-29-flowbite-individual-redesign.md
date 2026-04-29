# Flowbite Individual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `development` branch root UI with a Premium Calm login screen where only the Individual TableShifts path is active, then rebuild Individual TableShifts with a compact Flowbite-inspired Top Command Bar.

**Architecture:** Keep Supabase schema and RPCs unchanged. Split reusable Individual TableShifts types/helpers into `src/lib/individual-tableshifts.ts`, build the new client UI in `src/components/flowbite-individual-tableshifts.tsx`, and update `src/app/page.tsx` to render the new experience. The old redesign component remains in the repo as a backup/reference but is no longer the root UI.

**Tech Stack:** Next.js App Router, React client components, Supabase JS, Tailwind CSS, XLSX, Flowbite-inspired Tailwind component patterns, existing Vercel deployment flow.

---

## File Structure

- Create `src/lib/individual-tableshifts.ts`
  - Owns individual table data types, table creation/migration, totals, CSV/XLSX helpers, public holiday helpers, and import parsing.
- Create `src/components/flowbite-individual-tableshifts.tsx`
  - Owns Premium Calm login shell, inactive admin/login UI, live Individual TableShifts creation/loading/saving, Top Command Bar table UI, mobile mode, dark mode, share link copy, toasts, and popovers.
- Modify `src/app/page.tsx`
  - Render the new `FlowbiteIndividualTableShiftsApp` instead of `TableShiftsRedesign`.
- Modify `src/app/globals.css`
  - Add only global utilities needed by the new UI, such as dark-mode base handling and stable scrollbars if necessary.
- Leave `src/components/tableshifts-redesign.tsx` unchanged as a reference for later admin rebuilds.
- Do not modify `supabase/schema.sql`.

## Task 1: Extract Individual TableShifts Logic

**Files:**
- Create: `src/lib/individual-tableshifts.ts`
- Reference only: `src/components/tableshifts-redesign.tsx`

- [ ] **Step 1: Create shared types and constants**

Create `src/lib/individual-tableshifts.ts` with these exports:

```ts
import * as XLSX from "xlsx";
import { currentMonth, daysInMonth, formatNumber } from "@/lib/tableshifts";

export type IndividualEntry = {
  type: string;
  hours: number;
  reason?: string;
};

export type IndividualRow = {
  id: string;
  name: string;
  company: string;
  department: string;
  identificationNumber: string;
  position: string;
};

export type IndividualHoliday = {
  date: string;
  name: string;
  countryCode?: string;
};

export type IndividualTableData = {
  id: string;
  month: string;
  normalHours: number;
  rows: IndividualRow[];
  entries: Record<string, Record<string, IndividualEntry>>;
  holidays: IndividualHoliday[];
};

export const SPECIAL_EVENT_REASONS = [
  "Family death",
  "Child birth",
  "Marriage",
  "Blood donation",
  "Moving house",
  "Jury duty",
  "Civic duty",
  "Other special event"
];

export const COUNTRY_OPTIONS = [
  ["RO", "Romania"],
  ["AT", "Austria"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["GB", "United Kingdom"],
  ["HU", "Hungary"],
  ["IT", "Italy"],
  ["PL", "Poland"],
  ["US", "United States"]
] as const;
```

- [ ] **Step 2: Add creation and migration helpers**

Append:

```ts
export function makeIndividualId(prefix = "table") {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${random}`;
}

export function defaultIndividualRow(): IndividualRow {
  return {
    id: makeIndividualId("row"),
    name: "",
    company: "",
    department: "",
    identificationNumber: "",
    position: ""
  };
}

export function createIndividualTable(id = makeIndividualId()): IndividualTableData {
  return {
    id,
    month: currentMonth(),
    normalHours: 8,
    rows: [defaultIndividualRow()],
    entries: {},
    holidays: []
  };
}

export function sanitizeIndividualNormalHours(value: unknown) {
  const hours = Number(value);
  if (!Number.isFinite(hours)) return 8;
  return Math.max(1, Math.min(24, Math.round(hours)));
}

export function migrateIndividualTable(raw: unknown, id: string): IndividualTableData | null {
  if (!raw) return null;
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof value !== "object" || value === null) return null;
  const data = value as Partial<IndividualTableData>;
  return {
    id: data.id || id,
    month: data.month || currentMonth(),
    normalHours: sanitizeIndividualNormalHours(data.normalHours),
    rows: Array.isArray(data.rows) && data.rows.length ? data.rows.map((row) => ({
      id: row.id || makeIndividualId("row"),
      name: row.name || "",
      company: row.company || "",
      department: row.department || "",
      identificationNumber: row.identificationNumber || "",
      position: row.position || ""
    })) : [defaultIndividualRow()],
    entries: data.entries && typeof data.entries === "object" ? data.entries : {},
    holidays: Array.isArray(data.holidays) ? data.holidays.map((holiday) => ({
      date: holiday.date || "",
      name: holiday.name || "Public holiday",
      countryCode: holiday.countryCode
    })).filter((holiday) => holiday.date) : []
  };
}
```

- [ ] **Step 3: Add totals and display helpers**

Append:

```ts
export function individualNormalHours(table: Pick<IndividualTableData, "normalHours">) {
  return sanitizeIndividualNormalHours(table.normalHours);
}

export function isIndividualWorkDay(day: ReturnType<typeof daysInMonth>[number], holidaysByDate: Map<string, IndividualHoliday>) {
  return day.weekdayIndex !== 0 && day.weekdayIndex !== 6 && !holidaysByDate.has(day.iso);
}

export function individualTotals(row: IndividualRow, table: IndividualTableData) {
  const holidays = new Map(table.holidays.map((holiday) => [holiday.date, holiday]));
  const normal = individualNormalHours(table);
  const totals = daysInMonth(table.month).reduce((acc, day) => {
    const entry = table.entries[row.id]?.[day.iso];
    if (isIndividualWorkDay(day, holidays)) acc.norm += normal;
    if (!entry) return acc;
    const hours = Number(entry.hours || 0);
    if (entry.type === "normal") acc.worked += hours;
    if (entry.type === "overtime") {
      acc.worked += hours;
      acc.ot += Math.max(0, hours - normal);
    }
    if (entry.type === "vacation") acc.co += 1;
    if (entry.type === "medical") acc.cm += 1;
    if (entry.type === "special_event") acc.se += 1;
    if (entry.type === "absence") acc.ab += 1;
    return acc;
  }, { worked: 0, norm: 0, diff: 0, ot: 0, co: 0, cm: 0, se: 0, ab: 0 });
  totals.diff = totals.worked - totals.norm;
  return totals;
}

export function individualEntryCode(type: string) {
  if (type === "vacation") return "CO";
  if (type === "medical") return "CM";
  if (type === "special_event") return "SE";
  if (type === "absence") return "AB";
  if (type === "holiday") return "H";
  if (type === "overtime") return "OT";
  return "N";
}

export function individualTooltipText(entry: IndividualEntry | undefined, holiday: IndividualHoliday | undefined, workDay: boolean, normalHoursValue = 8) {
  if (entry?.type === "normal") return `Normal shift: ${formatNumber(entry.hours)}h`;
  if (entry?.type === "overtime") return `Overtime: ${formatNumber(Math.max(0, Number(entry.hours || 0) - normalHoursValue))}h over normal shift of ${formatNumber(normalHoursValue)}h`;
  if (entry?.type === "vacation") return "Vacation day (CO)";
  if (entry?.type === "medical") return "Medical leave day (CM)";
  if (entry?.type === "special_event") return entry.reason ? `Special event: ${entry.reason}` : "Special event";
  if (entry?.type === "absence") return "Absence";
  if (holiday) return `Holiday: ${holiday.name}`;
  return workDay ? "Expected working day" : "Non-working day";
}
```

- [ ] **Step 4: Add import/export helpers**

Append:

```ts
export function downloadIndividualTemplate() {
  downloadXlsx("tableshifts-import-template.xlsx", "Employees", [
    ["Employee", "Company", "Department", "Identification Number", "Position"],
    ["", "", "", "", ""]
  ]);
}

export function exportIndividualCsv(table: IndividualTableData) {
  const days = daysInMonth(table.month);
  const rows = [
    ["Employee", "Company", "Department", "Identification Number", "Position", ...days.map((day) => day.iso), "Worked", "Norm", "Diff", "OT", "CO", "CM", "SE", "AB"]
  ];
  table.rows.forEach((row) => {
    const totals = individualTotals(row, table);
    rows.push([
      row.name,
      row.company,
      row.department,
      row.identificationNumber,
      row.position,
      ...days.map((day) => {
        const entry = table.entries[row.id]?.[day.iso];
        if (!entry) return "";
        if (["normal", "overtime"].includes(entry.type)) return String(entry.hours || "");
        return individualEntryCode(entry.type);
      }),
      String(totals.worked),
      String(totals.norm),
      String(totals.worked - totals.norm),
      String(totals.ot),
      String(totals.co),
      String(totals.cm),
      String(totals.se),
      String(totals.ab)
    ]);
  });
  downloadCsv(`individual-tableshifts-${table.month}.csv`, rows);
}

export function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadXlsx(filename: string, sheetName: string, rows: Array<Array<string | number>>) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const blob = new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseEmployeeWorkbook(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils
    .sheet_to_json<Array<string | number | boolean | null>>(sheet, { header: 1, defval: "" })
    .map((row) => row.map((cell) => String(cell ?? "")));
}

export function individualRowsFromMatrix(rows: string[][]) {
  const [header = [], ...body] = rows;
  const normalized = header.map((cell) => cell.trim().toLowerCase());
  const columnIndex = (name: string) => normalized.indexOf(name.toLowerCase());
  const employeeIndex = columnIndex("employee");
  const companyIndex = columnIndex("company");
  const departmentIndex = columnIndex("department");
  const idIndex = columnIndex("identification number");
  const positionIndex = columnIndex("position");

  return body
    .map((row) => ({
      id: makeIndividualId("row"),
      name: row[employeeIndex] || "",
      company: companyIndex >= 0 ? row[companyIndex] || "" : "",
      department: departmentIndex >= 0 ? row[departmentIndex] || "" : "",
      identificationNumber: idIndex >= 0 ? row[idIndex] || "" : "",
      position: positionIndex >= 0 ? row[positionIndex] || ""
    }))
    .filter((row) => row.name.trim());
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((items) => items.some((item) => item.trim()));
}
```

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add src/lib/individual-tableshifts.ts
git commit -m "Extract individual TableShifts helpers"
```

Expected: commit succeeds with only the helper file.

## Task 2: Build the New Root Client Shell

**Files:**
- Create: `src/components/flowbite-individual-tableshifts.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create the client component skeleton**

Create `src/components/flowbite-individual-tableshifts.tsx`:

```tsx
"use client";

import * as React from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Toaster, toast } from "sonner";
import { daysInMonth, formatNumber, monthOptions } from "@/lib/tableshifts";
import {
  COUNTRY_OPTIONS,
  SPECIAL_EVENT_REASONS,
  type IndividualEntry,
  type IndividualHoliday,
  type IndividualRow,
  type IndividualTableData,
  createIndividualTable,
  defaultIndividualRow,
  downloadIndividualTemplate,
  exportIndividualCsv,
  individualEntryCode,
  individualNormalHours,
  individualRowsFromMatrix,
  individualTooltipText,
  individualTotals,
  isIndividualWorkDay,
  migrateIndividualTable,
  parseCsv,
  parseEmployeeWorkbook
} from "@/lib/individual-tableshifts";

type Props = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

type ThemeMode = "light" | "dark";
type LayoutMode = "desktop" | "mobile";

export function FlowbiteIndividualTableShiftsApp({ supabaseUrl, supabaseAnonKey }: Props) {
  const supabase = React.useMemo<SupabaseClient | null>(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient(supabaseUrl, supabaseAnonKey);
  }, [supabaseUrl, supabaseAnonKey]);

  const [theme, setTheme] = React.useState<ThemeMode>("light");
  const [layoutMode, setLayoutMode] = React.useState<LayoutMode>("desktop");
  const [table, setTable] = React.useState<IndividualTableData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tableId = params.get("table");
    if (tableId && supabase) void loadTable(tableId);
  }, [supabase]);

  async function saveTable(next: IndividualTableData) {
    setTable(next);
    if (!supabase) {
      toast.error("Supabase configuration is missing.");
      return;
    }
    const { error } = await supabase.rpc("save_individual_table", {
      token_value: next.id,
      data_value: next
    });
    if (error) toast.error(error.message || "Could not save the table.");
  }

  async function loadTable(id: string) {
    if (!supabase) {
      setMessage("Supabase configuration is missing for this deployment.");
      return;
    }
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase.rpc("get_individual_table", { token_value: id });
    setLoading(false);
    if (error) {
      setMessage(error.message || "Could not load this Individual TableShift.");
      return;
    }
    const migrated = migrateIndividualTable(data, id);
    if (!migrated) {
      setMessage("This Individual TableShift link could not be opened.");
      return;
    }
    setTable(migrated);
  }

  async function createNewTable() {
    if (!supabase) {
      toast.error("Supabase configuration is missing.");
      return;
    }
    setLoading(true);
    const next = createIndividualTable();
    const { error } = await supabase.rpc("save_individual_table", {
      token_value: next.id,
      data_value: next
    });
    setLoading(false);
    if (error) {
      toast.error(error.message || "Could not create an Individual TableShift.");
      return;
    }
    window.history.pushState({}, "", `/?table=${encodeURIComponent(next.id)}`);
    setTable(next);
    toast.success("Individual TableShift created.");
  }

  function backToLogin() {
    window.history.pushState({}, "", "/");
    setTable(null);
    setMessage("");
  }

  return (
    <div className={theme === "dark" ? "dark" : ""}>
      <Toaster position="top-center" richColors closeButton />
      {table ? (
        <IndividualTableWorkspace
          table={table}
          onSave={(next) => void saveTable(next)}
          onBack={backToLogin}
          theme={theme}
          setTheme={setTheme}
          layoutMode={layoutMode}
          setLayoutMode={setLayoutMode}
        />
      ) : (
        <PremiumCalmLogin
          loading={loading}
          message={message}
          onCreateIndividual={() => void createNewTable()}
          theme={theme}
          setTheme={setTheme}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add a temporary minimal login and workspace stub**

Append minimal components that compile:

```tsx
function PremiumCalmLogin({
  loading,
  message,
  onCreateIndividual,
  theme,
  setTheme
}: {
  loading: boolean;
  message: string;
  onCreateIndividual: () => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}) {
  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950 dark:bg-slate-950 dark:text-white">
      <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>Toggle theme</button>
      <h1>TableShifts</h1>
      <p>Track work hours in a clean, familiar table as simple as a spreadsheet.</p>
      <button type="button" disabled={loading} onClick={onCreateIndividual}>
        {loading ? "Creating..." : "Create Individual TableShift"}
      </button>
      {message ? <p>{message}</p> : null}
    </main>
  );
}

function IndividualTableWorkspace({
  table,
  onSave,
  onBack,
  theme,
  setTheme,
  layoutMode,
  setLayoutMode
}: {
  table: IndividualTableData;
  onSave: (table: IndividualTableData) => void;
  onBack: () => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
}) {
  return (
    <main className="min-h-screen bg-white p-6 text-slate-950 dark:bg-slate-950 dark:text-white">
      <button type="button" onClick={onBack}>Back</button>
      <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>Theme</button>
      <button type="button" onClick={() => setLayoutMode(layoutMode === "desktop" ? "mobile" : "desktop")}>{layoutMode}</button>
      <h1>Individual TableShifts</h1>
      <p>{table.id}</p>
      <button type="button" onClick={() => onSave({ ...table, rows: [...table.rows, defaultIndividualRow()] })}>Add row</button>
    </main>
  );
}
```

- [ ] **Step 3: Switch the root page**

Replace `src/app/page.tsx` with:

```tsx
import { FlowbiteIndividualTableShiftsApp } from "@/components/flowbite-individual-tableshifts";

export default function Home() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.tableshifts_dbSUPABASE_URL ||
    "";
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.tableshifts_dbSUPABASE_ANON_KEY ||
    process.env.tableshifts_dbSUPABASE_PUBLISHABLE_KEY ||
    "";

  return <FlowbiteIndividualTableShiftsApp supabaseUrl={supabaseUrl} supabaseAnonKey={supabaseAnonKey} />;
}
```

- [ ] **Step 4: Commit Task 2**

Run:

```bash
git add src/components/flowbite-individual-tableshifts.tsx src/app/page.tsx
git commit -m "Start Flowbite individual app shell"
```

Expected: commit succeeds with the new root shell.

## Task 3: Build Premium Calm Login

**Files:**
- Modify: `src/components/flowbite-individual-tableshifts.tsx`

- [ ] **Step 1: Replace the login stub with the Premium Calm UI**

Implement `PremiumCalmLogin` as a full-screen responsive layout:

```tsx
function PremiumCalmLogin({
  loading,
  message,
  onCreateIndividual,
  theme,
  setTheme
}: {
  loading: boolean;
  message: string;
  onCreateIndividual: () => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 dark:bg-slate-950 dark:text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/70 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30 lg:grid-cols-[1.08fr_.92fr]">
        <section className="relative flex min-h-[520px] flex-col justify-between overflow-hidden bg-slate-950 p-7 text-white sm:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_15%,rgba(20,184,166,.28),transparent_34%),linear-gradient(135deg,#111827,#0f766e)]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-teal-100">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              TableShifts
            </div>
            <h1 className="mt-12 max-w-xl text-4xl font-black leading-[0.98] tracking-tight sm:text-5xl">
              Work hours, without the heavy HR feeling.
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-teal-50/80">
              A clean monthly table for shifts, overtime, holidays, leave codes, and shareable individual timesheets.
            </p>
          </div>
          <div className="relative rounded-2xl border border-white/15 bg-white/10 p-4 shadow-2xl shadow-black/20 backdrop-blur">
            <MiniTablePreview />
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-sm">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Workspace access</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">Sign in</h2>
              </div>
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? "Light" : "Dark"}
              </button>
            </div>

            <div className="space-y-4">
              <FloatingInput label="Email" type="email" disabled />
              <FloatingInput label="Password" type="password" disabled />
              <button type="button" disabled className="w-full rounded-lg bg-slate-300 px-5 py-2.5 text-sm font-bold text-white dark:bg-slate-700">
                Sign in coming next
              </button>
              <button type="button" disabled className="w-full rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-400 dark:border-slate-700 dark:text-slate-500">
                Create Admin Account later
              </button>
            </div>

            <div className="my-7 flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Available now</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={onCreateIndividual}
              className="inline-flex w-full items-center justify-center rounded-lg bg-teal-700 px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-700/20 transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Creating Individual TableShift..." : "Create Individual TableShift"}
            </button>
            {message ? <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">{message}</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Add login helper components**

Append:

```tsx
function FloatingInput({ label, type, disabled = false }: { label: string; type: string; disabled?: boolean }) {
  return (
    <div className="relative">
      <input
        type={type}
        disabled={disabled}
        placeholder=" "
        className="peer block w-full rounded-lg border border-slate-300 bg-transparent px-3 pb-2.5 pt-4 text-sm text-slate-900 outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:text-white dark:disabled:bg-slate-800"
      />
      <label className="absolute start-2 top-2 z-10 origin-[0] -translate-y-4 scale-75 bg-white px-2 text-sm font-semibold text-slate-500 duration-150 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:top-2 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:text-teal-700 dark:bg-slate-900 dark:text-slate-400">
        {label}
      </label>
    </div>
  );
}

function MiniTablePreview() {
  const days = ["1", "2", "3", "4", "5", "6"];
  const rows = [
    ["Maria I.", "ok", "ok", "ot", "ok", "cm", "off"],
    ["Andrei P.", "ok", "ok", "ok", "ok", "co", "off"],
    ["Elena R.", "ok", "se", "ok", "ok", "ok", "off"]
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-white/15 bg-slate-950/35 text-[11px]">
      <div className="grid grid-cols-[92px_repeat(6,minmax(28px,1fr))] border-b border-white/10 bg-white/10">
        <div className="px-2 py-2 font-bold text-teal-50/80">Employee</div>
        {days.map((day) => <div key={day} className="px-1 py-2 text-center font-black text-teal-50">{day}</div>)}
      </div>
      {rows.map((row) => (
        <div key={row[0]} className="grid grid-cols-[92px_repeat(6,minmax(28px,1fr))] border-b border-white/10 last:border-b-0">
          <div className="truncate px-2 py-2 font-bold text-white/85">{row[0]}</div>
          {row.slice(1).map((state, index) => (
            <div key={`${row[0]}-${index}`} className="p-1">
              <div className={cellPreviewClass(state)}>{state === "ok" ? "8" : state.toUpperCase()}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function cellPreviewClass(state: string) {
  const base = "grid h-6 place-items-center rounded-md text-[10px] font-black";
  if (state === "ok") return `${base} bg-emerald-400/90 text-emerald-950`;
  if (state === "ot") return `${base} bg-amber-300 text-amber-950`;
  if (state === "cm") return `${base} bg-rose-300 text-rose-950`;
  if (state === "co") return `${base} bg-teal-200 text-teal-950`;
  if (state === "se") return `${base} bg-slate-200 text-slate-950`;
  return `${base} bg-white/10 text-white/45`;
}
```

- [ ] **Step 3: Commit Task 3**

Run:

```bash
git add src/components/flowbite-individual-tableshifts.tsx
git commit -m "Build Premium Calm login screen"
```

Expected: commit succeeds.

## Task 4: Build Desktop Top Command Bar Table

**Files:**
- Modify: `src/components/flowbite-individual-tableshifts.tsx`

- [ ] **Step 1: Replace workspace stub with desktop shell**

Implement `IndividualTableWorkspace` as a full-screen table app with header, top command bar, table area, and footer status. It must call `onSave` for every mutation and keep the table as the dominant surface.

- [ ] **Step 2: Add command bar actions**

Implement handlers for:

```ts
function updateTable(patch: Partial<IndividualTableData>) {
  onSave({ ...table, ...patch });
}

function updateRow(rowId: string, patch: Partial<IndividualRow>) {
  onSave({ ...table, rows: table.rows.map((row) => row.id === rowId ? { ...row, ...patch } : row) });
}

function setEntry(rowId: string, iso: string, entry: IndividualEntry | null) {
  const entries = { ...table.entries, [rowId]: { ...(table.entries[rowId] || {}) } };
  if (entry) entries[rowId][iso] = entry;
  else delete entries[rowId][iso];
  onSave({ ...table, entries });
}

async function copyLink() {
  await navigator.clipboard.writeText(window.location.href);
  toast.success("Share link copied.");
}
```

- [ ] **Step 3: Add desktop table component**

Create `DesktopIndividualTable` inside the same file. It renders:

- Sticky employee column.
- Day columns from `daysInMonth(table.month)`.
- Totals columns.
- Editable employee metadata.
- Editable numeric day cells.
- Compact status color classes.

- [ ] **Step 4: Add cell action popover**

Create a contextual popover/menu for day cells with these actions:

- Normal shift.
- Vacation CO.
- Medical CM.
- Absence.
- Special Event submenu/reason choices.
- Clear.

Use a compact absolute-positioned panel or Flowbite-style popover markup. No Radix/shadcn dependency is required for the new component.

- [ ] **Step 5: Add import/export**

Wire file input to:

```ts
function importEmployeeFile(file: File | null) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const isExcel = /\.(xlsx|xls)$/i.test(file.name);
      const rows = isExcel
        ? parseEmployeeWorkbook(reader.result as ArrayBuffer)
        : parseCsv(String(reader.result || ""));
      const nextRows = individualRowsFromMatrix(rows);
      if (nextRows.length) {
        onSave({ ...table, rows: [...table.rows, ...nextRows] });
        toast.success(`${nextRows.length} employees imported.`);
      } else {
        toast.warning("No employees found in that file.");
      }
    } catch {
      toast.error("Could not import that employee file.");
    }
  };
  if (/\.(xlsx|xls)$/i.test(file.name)) reader.readAsArrayBuffer(file);
  else reader.readAsText(file);
}
```

- [ ] **Step 6: Commit Task 4**

Run:

```bash
git add src/components/flowbite-individual-tableshifts.tsx
git commit -m "Build compact individual table workspace"
```

Expected: commit succeeds.

## Task 5: Add Mobile Mode, Dark Polish, and Feedback

**Files:**
- Modify: `src/components/flowbite-individual-tableshifts.tsx`
- Modify if needed: `src/app/globals.css`

- [ ] **Step 1: Add mobile table mode**

Create `MobileIndividualTable` that shows each employee as a compact panel with:

- Employee name and totals.
- Horizontal day strip or grouped day buttons.
- Tap/click day editing using the same `setEntry` behavior.
- Row actions for fill/clear/remove.

- [ ] **Step 2: Add compact KPIs and small chart strip**

Add a slim KPI band above the table:

- People.
- Worked hours.
- Norm hours.
- Difference.
- OT / CO / CM / SE / AB counts.

Add a small daily bar strip using divs, not a chart dependency. Use it only if it stays compact.

- [ ] **Step 3: Polish dark mode**

Ensure all major surfaces have `dark:` classes:

- Login shell.
- Command bar.
- Table header and cells.
- Popovers.
- Toasts already handled by Sonner.

- [ ] **Step 4: Add clear disabled states**

Make login/admin dummy controls obviously inactive but premium. On click, optional dummy controls can call `toast.message("Workspace login is coming next.")`.

- [ ] **Step 5: Commit Task 5**

Run:

```bash
git add src/components/flowbite-individual-tableshifts.tsx src/app/globals.css
git commit -m "Polish individual mobile and dark modes"
```

Expected: commit succeeds.

## Task 6: Verify, Clean, and Push for Vercel

**Files:**
- Review all touched files.

- [ ] **Step 1: Remove accidental local generated changes**

If `next-env.d.ts` or `package-lock.json` still contain only local generated noise from the earlier failed dev-server attempt, restore them before final push. Do not restore user-authored changes.

- [ ] **Step 2: Check status**

Run:

```bash
git status --short --branch
```

Expected: only intentional changes remain, or the branch is clean after commits.

- [ ] **Step 3: Run available local validation**

Try:

```bash
npm run build
```

Expected on this Mac right now: command may fail because `npm` is not installed. If it fails with `npm: command not found`, record that Vercel will be the build validator.

- [ ] **Step 4: Push development**

Run:

```bash
git push origin development
```

Expected: Vercel starts a new development deployment.

- [ ] **Step 5: Review Vercel preview**

Open:

```text
https://tableshifts-git-development-valentinivan-8664s-projects.vercel.app
```

Acceptance checks:

- Premium Calm login is visible.
- Login/admin/create-account UI is inactive.
- Individual TableShifts button creates a database-linked table.
- URL contains the table token.
- Refreshing the URL reloads the same table.
- Editing cells persists.
- Copy link copies the current URL.
- Desktop and mobile modes both work.
- Light/dark mode visibly changes the app.
