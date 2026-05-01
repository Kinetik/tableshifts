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
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const syncLayout = () => setLayoutMode(query.matches ? "mobile" : "desktop");
    syncLayout();
    query.addEventListener("change", syncLayout);
    return () => query.removeEventListener("change", syncLayout);
  }, []);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tableId = params.get("table");
    if (tableId && supabase) void loadTable(tableId);
    else setLoading(false);
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
      setLoading(false);
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
              <button
                type="button"
                disabled
                onClick={() => toast.message("Workspace login is coming next.")}
                className="w-full rounded-lg bg-slate-300 px-5 py-2.5 text-sm font-bold text-white dark:bg-slate-700"
              >
                Sign in coming next
              </button>
              <button
                type="button"
                disabled
                onClick={() => toast.message("Admin account creation is coming next.")}
                className="w-full rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-400 dark:border-slate-700 dark:text-slate-500"
              >
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
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const days = daysInMonth(table.month);
  const stats = individualHeaderStats(table);
  const [holidayCountry, setHolidayCountry] = React.useState("RO");
  const [holidayYear, setHolidayYear] = React.useState(String(new Date().getFullYear()));

  function updateTable(patch: Partial<IndividualTableData>) {
    onSave({ ...table, ...patch });
  }

  function updateRow(rowId: string, patch: Partial<IndividualRow>) {
    onSave({ ...table, rows: table.rows.map((row) => row.id === rowId ? { ...row, ...patch } : row) });
  }

  function removeRow(rowId: string) {
    const entries = { ...table.entries };
    delete entries[rowId];
    onSave({ ...table, rows: table.rows.filter((row) => row.id !== rowId), entries });
    toast.success("Employee row removed.");
  }

  function setEntry(rowId: string, iso: string, entry: IndividualEntry | null) {
    const entries = { ...table.entries, [rowId]: { ...(table.entries[rowId] || {}) } };
    if (entry) entries[rowId][iso] = entry;
    else delete entries[rowId][iso];
    onSave({ ...table, entries });
  }

  function fillRow(row: IndividualRow) {
    const holidaysByDate = new Map(table.holidays.map((holiday) => [holiday.date, holiday]));
    const normal = individualNormalHours(table);
    const rowEntries = { ...(table.entries[row.id] || {}) };
    days.forEach((day) => {
      if (isIndividualWorkDay(day, holidaysByDate) && !rowEntries[day.iso]) rowEntries[day.iso] = { type: "normal", hours: normal };
    });
    onSave({ ...table, entries: { ...table.entries, [row.id]: rowEntries } });
    toast.success(`${row.name || "Row"} filled.`);
  }

  function clearRow(row: IndividualRow) {
    const rowEntries = { ...(table.entries[row.id] || {}) };
    days.forEach((day) => delete rowEntries[day.iso]);
    onSave({ ...table, entries: { ...table.entries, [row.id]: rowEntries } });
    toast.success(`${row.name || "Row"} cleared.`);
  }

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
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Share link copied.");
    } catch {
      toast.error("Could not copy the share link.");
    }
  }

  async function addPublicHolidays() {
    try {
      const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${holidayYear}/${holidayCountry}`);
      if (!response.ok) throw new Error("Could not load public holidays.");
      const data = await response.json();
      const loaded: IndividualHoliday[] = (Array.isArray(data) ? data : []).map((item) => ({
        date: item.date,
        name: item.localName || item.name || "Public holiday",
        countryCode: holidayCountry
      }));
      const merged = new Map(table.holidays.map((holiday) => [`${holiday.date}:${holiday.name}`, holiday]));
      loaded.forEach((holiday) => merged.set(`${holiday.date}:${holiday.name}`, holiday));
      onSave({ ...table, holidays: Array.from(merged.values()).toSorted((a, b) => a.date.localeCompare(b.date)) });
      toast.success(`${loaded.length} public holidays loaded.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load public holidays.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-teal-700 dark:text-teal-300">
                <span className="h-2 w-2 rounded-full bg-teal-600 dark:bg-teal-300" />
                TableShifts
              </div>
              <h1 className="mt-1 truncate text-2xl font-black tracking-tight">Individual TableShifts</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={toolButtonClass()} onClick={copyLink}>Copy Link</button>
              <button type="button" className={toolButtonClass()} onClick={() => setLayoutMode(layoutMode === "desktop" ? "mobile" : "desktop")}>
                {layoutMode === "desktop" ? "Desktop" : "Mobile"}
              </button>
              <button type="button" className={toolButtonClass()} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                {theme === "dark" ? "Light" : "Dark"}
              </button>
              <button type="button" className={toolButtonClass("border-transparent bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950")} onClick={onBack}>
                Login
              </button>
            </div>
          </div>
        </header>

        <section className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 lg:px-6">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[180px_92px_130px_82px_auto_auto_auto_auto_auto_auto] lg:items-end">
              <Field label="Month">
                <select className={selectClass()} value={table.month} onChange={(event) => updateTable({ month: event.target.value })}>
                  {monthOptions(table.month).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              <Field label="Shifts">
                <input
                  className={inputClass("text-center")}
                  inputMode="numeric"
                  min={1}
                  max={24}
                  type="number"
                  value={individualNormalHours(table)}
                  onChange={(event) => updateTable({ normalHours: Math.max(1, Math.min(24, Number(event.target.value) || 8)) })}
                />
              </Field>
              <Field label="Holiday Country">
                <select className={selectClass()} value={holidayCountry} onChange={(event) => setHolidayCountry(event.target.value)}>
                  {COUNTRY_OPTIONS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
              </Field>
              <Field label="Year">
                <input className={inputClass("text-center")} value={holidayYear} inputMode="numeric" onChange={(event) => setHolidayYear(event.target.value.replace(/\D/g, "").slice(0, 4))} />
              </Field>
              <button type="button" className={commandButtonClass("bg-teal-700 text-white hover:bg-teal-800")} onClick={() => onSave({ ...table, rows: [...table.rows, defaultIndividualRow()] })}>
                Add Row
              </button>
              <button type="button" className={commandButtonClass()} onClick={addPublicHolidays}>Holidays</button>
              <button type="button" className={commandButtonClass()} onClick={() => fileInputRef.current?.click()}>Import</button>
              <button type="button" className={commandButtonClass()} onClick={downloadIndividualTemplate}>Template</button>
              <button
                type="button"
                className={commandButtonClass()}
                onClick={() => {
                  exportIndividualCsv(table);
                  toast.success("CSV exported.");
                }}
              >
                Export
              </button>
              <button type="button" className={commandButtonClass()} onClick={copyLink}>Share</button>
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                onChange={(event) => importEmployeeFile(event.target.files?.[0] || null)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 xl:w-[540px]">
              <Kpi label="People" value={String(stats.people)} />
              <Kpi label="Worked" value={`${formatNumber(stats.worked)}h`} />
              <Kpi label="Norm" value={`${formatNumber(stats.norm)}h`} />
              <Kpi label="Diff" value={`${stats.diff > 0 ? "+" : ""}${formatNumber(stats.diff)}h`} tone={stats.diff < 0 ? "bad" : "good"} />
              <Kpi label="OT" value={`${formatNumber(stats.ot)}h`} />
              <Kpi label="CO" value={`${stats.co}d`} />
              <Kpi label="CM" value={`${stats.cm}d`} />
              <Kpi label="SE" value={`${stats.se}d`} />
              <Kpi label="AB" value={`${stats.ab}d`} tone={stats.ab ? "bad" : "neutral"} />
              <Kpi label="Holidays" value={`${table.holidays.length}`} />
            </div>
          </div>
          <DailyBarStrip days={stats.daily} />
          <div className="mt-3 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
            {typeof window === "undefined" ? table.id : window.location.href}
          </div>
        </section>

        <section className="min-h-0 flex-1 p-3 lg:p-4">
          {layoutMode === "mobile" ? (
            <MobileIndividualTable
              table={table}
              onUpdateRow={updateRow}
              onRemoveRow={removeRow}
              onSetEntry={setEntry}
              onFillRow={fillRow}
              onClearRow={clearRow}
            />
          ) : (
            <DesktopIndividualTable
              table={table}
              onUpdateRow={updateRow}
              onRemoveRow={removeRow}
              onSetEntry={setEntry}
              onFillRow={fillRow}
              onClearRow={clearRow}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function Kpi({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-sm font-black ${tone === "good" ? "text-teal-700 dark:text-teal-300" : tone === "bad" ? "text-rose-700 dark:text-rose-300" : ""}`}>{value}</p>
    </div>
  );
}

function DailyBarStrip({ days }: { days: Array<{ day: number; worked: number; variance: number }> }) {
  const max = Math.max(1, ...days.map((day) => day.worked));
  return (
    <div className="mt-3 flex h-10 items-end gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-950">
      {days.map((day) => (
        <div
          key={day.day}
          title={`Day ${day.day}: ${formatNumber(day.worked)}h (${day.variance > 0 ? "+" : ""}${formatNumber(day.variance)}h)`}
          className={`min-h-1 flex-1 rounded-t-sm ${day.variance < 0 && day.worked > 0 ? "bg-rose-500" : day.variance > 0 ? "bg-teal-600" : "bg-slate-300 dark:bg-slate-700"}`}
          style={{ height: `${Math.max(6, (day.worked / max) * 30)}px` }}
        />
      ))}
    </div>
  );
}

function DesktopIndividualTable({
  table,
  onUpdateRow,
  onRemoveRow,
  onSetEntry,
  onFillRow,
  onClearRow
}: {
  table: IndividualTableData;
  onUpdateRow: (rowId: string, patch: Partial<IndividualRow>) => void;
  onRemoveRow: (rowId: string) => void;
  onSetEntry: (rowId: string, iso: string, entry: IndividualEntry | null) => void;
  onFillRow: (row: IndividualRow) => void;
  onClearRow: (row: IndividualRow) => void;
}) {
  const days = daysInMonth(table.month);
  const holidaysByDate = new Map(table.holidays.map((holiday) => [holiday.date, holiday]));

  return (
    <div className="h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
      <div className="h-full overflow-auto">
        <table className="w-full min-w-[1440px] table-fixed border-collapse text-xs">
          <colgroup>
            <col className="w-56" />
            <col className="w-32" />
            <col className="w-32" />
            <col className="w-32" />
            <col className="w-32" />
            {days.map((day) => <col key={day.iso} className="w-11" />)}
            <col className="w-16" />
            <col className="w-16" />
            <col className="w-16" />
            <col className="w-16" />
            <col className="w-16" />
            <col className="w-16" />
            <col className="w-16" />
            <col className="w-16" />
            <col className="w-40" />
          </colgroup>
          <thead className="sticky top-0 z-30 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <th className="sticky left-0 z-40 w-56 border-b border-r border-slate-200 bg-slate-100 px-3 py-2 text-left text-[11px] font-black uppercase tracking-[0.12em] dark:border-slate-700 dark:bg-slate-800">Employee</th>
              <th className="border-b border-r border-slate-200 px-2 py-2 text-left text-[11px] font-black uppercase tracking-[0.12em] dark:border-slate-700">Company</th>
              <th className="border-b border-r border-slate-200 px-2 py-2 text-left text-[11px] font-black uppercase tracking-[0.12em] dark:border-slate-700">Department</th>
              <th className="border-b border-r border-slate-200 px-2 py-2 text-left text-[11px] font-black uppercase tracking-[0.12em] dark:border-slate-700">ID</th>
              <th className="border-b border-r border-slate-200 px-2 py-2 text-left text-[11px] font-black uppercase tracking-[0.12em] dark:border-slate-700">Position</th>
              {days.map((day) => (
                <th key={day.iso} className="w-11 border-b border-r border-slate-200 px-1 py-1 text-center dark:border-slate-700">
                  <span className="block text-sm font-black text-slate-950 dark:text-white">{day.day}</span>
                  <span className="text-[9px] font-bold uppercase">{day.weekday.slice(0, 3)}</span>
                </th>
              ))}
              {["Worked", "Norm", "Diff", "OT", "CO", "CM", "SE", "AB"].map((label) => (
                <th key={label} className="border-b border-r border-slate-200 px-2 py-2 text-center text-[10px] font-black uppercase tracking-[0.12em] dark:border-slate-700">{label}</th>
              ))}
              <th className="sticky right-0 z-40 border-b border-l border-r border-slate-200 bg-slate-100 px-2 py-2 text-center text-[10px] font-black uppercase tracking-[0.12em] dark:border-slate-700 dark:bg-slate-800">Actions</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => {
              const totals = individualTotals(row, table);
              return (
                <tr key={row.id} className="group border-b border-slate-100 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/50">
                  <td className="sticky left-0 z-20 border-r border-slate-200 bg-white px-2 py-1 shadow-[12px_0_18px_-18px_rgba(15,23,42,.7)] group-hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:group-hover:bg-slate-800">
                    <input
                      className={tableInputClass("font-black")}
                      value={row.name}
                      placeholder="Employee name"
                      onChange={(event) => onUpdateRow(row.id, { name: event.target.value })}
                    />
                  </td>
                  <td className="border-r border-slate-100 px-1 py-1 dark:border-slate-800">
                    <input className={tableInputClass()} value={row.company} placeholder="Company" onChange={(event) => onUpdateRow(row.id, { company: event.target.value })} />
                  </td>
                  <td className="border-r border-slate-100 px-1 py-1 dark:border-slate-800">
                    <input className={tableInputClass()} value={row.department} placeholder="Department" onChange={(event) => onUpdateRow(row.id, { department: event.target.value })} />
                  </td>
                  <td className="border-r border-slate-100 px-1 py-1 dark:border-slate-800">
                    <input className={tableInputClass()} value={row.identificationNumber} placeholder="ID" onChange={(event) => onUpdateRow(row.id, { identificationNumber: event.target.value })} />
                  </td>
                  <td className="border-r border-slate-100 px-1 py-1 dark:border-slate-800">
                    <input className={tableInputClass()} value={row.position} placeholder="Position" onChange={(event) => onUpdateRow(row.id, { position: event.target.value })} />
                  </td>
                  {days.map((day) => (
                    <DayCell
                      key={day.iso}
                      day={day}
                      row={row}
                      table={table}
                      holiday={holidaysByDate.get(day.iso)}
                      entry={table.entries[row.id]?.[day.iso]}
                      onSetEntry={onSetEntry}
                    />
                  ))}
                  <TotalCell>{formatNumber(totals.worked)}h</TotalCell>
                  <TotalCell>{formatNumber(totals.norm)}h</TotalCell>
                  <TotalCell tone={totals.diff < 0 ? "bad" : "good"}>{totals.diff > 0 ? "+" : ""}{formatNumber(totals.diff)}h</TotalCell>
                  <TotalCell>{formatNumber(totals.ot)}h</TotalCell>
                  <TotalCell>{totals.co}d</TotalCell>
                  <TotalCell>{totals.cm}d</TotalCell>
                  <TotalCell>{totals.se}d</TotalCell>
                  <TotalCell>{totals.ab}d</TotalCell>
                  <td className="sticky right-0 z-10 border-l border-r border-slate-200 bg-white px-2 py-1 shadow-[-12px_0_18px_-18px_rgba(15,23,42,.7)] group-hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:group-hover:bg-slate-800">
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" className={tinyActionClass("text-teal-700 dark:text-teal-300")} onClick={() => onFillRow(row)}>Fill</button>
                      <button type="button" className={tinyActionClass("text-slate-600 dark:text-slate-300")} onClick={() => onClearRow(row)}>Clear</button>
                      <button type="button" className={tinyActionClass("text-rose-700 dark:text-rose-300")} onClick={() => onRemoveRow(row.id)}>Del</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MobileIndividualTable({
  table,
  onUpdateRow,
  onRemoveRow,
  onSetEntry,
  onFillRow,
  onClearRow
}: {
  table: IndividualTableData;
  onUpdateRow: (rowId: string, patch: Partial<IndividualRow>) => void;
  onRemoveRow: (rowId: string) => void;
  onSetEntry: (rowId: string, iso: string, entry: IndividualEntry | null) => void;
  onFillRow: (row: IndividualRow) => void;
  onClearRow: (row: IndividualRow) => void;
}) {
  const days = daysInMonth(table.month);
  const holidaysByDate = new Map(table.holidays.map((holiday) => [holiday.date, holiday]));
  return (
    <div className="grid gap-3">
      {table.rows.map((row) => {
        const totals = individualTotals(row, table);
        return (
          <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
              <input className={inputClass("font-black")} value={row.name} placeholder="Employee name" onChange={(event) => onUpdateRow(row.id, { name: event.target.value })} />
              <input className={inputClass()} value={row.company} placeholder="Company" onChange={(event) => onUpdateRow(row.id, { company: event.target.value })} />
              <input className={inputClass()} value={row.department} placeholder="Department" onChange={(event) => onUpdateRow(row.id, { department: event.target.value })} />
              <input className={inputClass()} value={row.identificationNumber} placeholder="ID" onChange={(event) => onUpdateRow(row.id, { identificationNumber: event.target.value })} />
              <input className={inputClass()} value={row.position} placeholder="Position" onChange={(event) => onUpdateRow(row.id, { position: event.target.value })} />
              <div className="grid grid-cols-4 gap-1">
                <Kpi label="Worked" value={`${formatNumber(totals.worked)}h`} />
                <Kpi label="Diff" value={`${totals.diff > 0 ? "+" : ""}${formatNumber(totals.diff)}h`} tone={totals.diff < 0 ? "bad" : "good"} />
                <Kpi label="CO" value={`${totals.co}d`} />
                <Kpi label="AB" value={`${totals.ab}d`} tone={totals.ab ? "bad" : "neutral"} />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1">
              {days.map((day) => (
                <MobileDayButton
                  key={day.iso}
                  day={day}
                  row={row}
                  table={table}
                  holiday={holidaysByDate.get(day.iso)}
                  entry={table.entries[row.id]?.[day.iso]}
                  onSetEntry={onSetEntry}
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={commandButtonClass()} onClick={() => onFillRow(row)}>Fill Row</button>
              <button type="button" className={commandButtonClass()} onClick={() => onClearRow(row)}>Clear Row</button>
              <button type="button" className={commandButtonClass("text-rose-700 dark:text-rose-300")} onClick={() => onRemoveRow(row.id)}>Delete</button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function MobileDayButton({
  day,
  row,
  table,
  holiday,
  entry,
  onSetEntry
}: {
  day: ReturnType<typeof daysInMonth>[number];
  row: IndividualRow;
  table: IndividualTableData;
  holiday?: IndividualHoliday;
  entry?: IndividualEntry;
  onSetEntry: (rowId: string, iso: string, entry: IndividualEntry | null) => void;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const normalHours = individualNormalHours(table);
  const workDay = isIndividualWorkDay(day, new Map(table.holidays.map((item) => [item.date, item])));
  const type = entry?.type || (holiday ? "holiday" : workDay ? "empty" : "weekend");
  return (
    <div className="relative">
      <button
        type="button"
        title={individualTooltipText(entry, holiday, workDay, normalHours)}
        className={`h-14 w-full rounded-lg border border-slate-200 text-center text-[11px] font-black dark:border-slate-800 ${individualCellClass(type)}`}
        onClick={() => {
          if (!entry && workDay) onSetEntry(row.id, day.iso, { type: "normal", hours: normalHours });
          else setMenuOpen(true);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          setMenuOpen(true);
        }}
      >
        <span className="block text-[10px] text-current/70">{day.day}</span>
        <span>{entry ? (["normal", "overtime"].includes(entry.type) ? `${formatNumber(entry.hours)}h` : individualEntryCode(entry.type)) : holiday ? "H" : workDay ? "+" : "-"}</span>
      </button>
      {menuOpen ? (
        <CellActionPopover
          onClose={() => setMenuOpen(false)}
          onApply={(type, reason) => {
            setMenuOpen(false);
            if (type === "clear") onSetEntry(row.id, day.iso, null);
            else if (type === "normal") onSetEntry(row.id, day.iso, { type: "normal", hours: normalHours });
            else onSetEntry(row.id, day.iso, { type, hours: 0, reason });
          }}
        />
      ) : null}
    </div>
  );
}

function DayCell({
  day,
  row,
  table,
  holiday,
  entry,
  onSetEntry
}: {
  day: ReturnType<typeof daysInMonth>[number];
  row: IndividualRow;
  table: IndividualTableData;
  holiday?: IndividualHoliday;
  entry?: IndividualEntry;
  onSetEntry: (rowId: string, iso: string, entry: IndividualEntry | null) => void;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const normalHours = individualNormalHours(table);
  const workDay = isIndividualWorkDay(day, new Map(table.holidays.map((item) => [item.date, item])));
  const numeric = !entry || ["normal", "overtime"].includes(entry.type);
  const value = numeric && entry ? String(formatNumber(entry.hours)) : "";
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);

  function commit(nextValue = draft) {
    const trimmed = nextValue.trim();
    if (!trimmed) {
      onSetEntry(row.id, day.iso, null);
      return;
    }
    const hours = Math.min(24, Number(trimmed.replace(/[^\d.]/g, "")));
    if (!Number.isFinite(hours) || hours <= 0) return;
    onSetEntry(row.id, day.iso, { type: hours > normalHours ? "overtime" : "normal", hours });
  }

  const type = entry?.type || (holiday ? "holiday" : workDay ? "empty" : "weekend");
  return (
    <td className={`relative h-10 border-r border-slate-100 p-0 text-center dark:border-slate-800 ${individualCellClass(type)}`}>
      <button
        type="button"
        aria-label="Open cell actions"
        className="absolute right-0 top-0 z-10 h-3 w-3 rounded-bl bg-black/5 opacity-0 transition hover:bg-black/10 group-hover:opacity-100 dark:bg-white/10"
        onClick={() => setMenuOpen((open) => !open)}
      />
      <div title={individualTooltipText(entry, holiday, workDay, normalHours)} className="grid h-10 place-items-center">
        {numeric ? (
          <input
            className="h-8 w-9 bg-transparent text-center text-sm font-black outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
            value={draft}
            placeholder={holiday ? "H" : ""}
            inputMode="numeric"
            onChange={(event) => {
              const next = event.target.value.replace(/[^\d.]/g, "");
              setDraft(next ? String(Math.min(24, Number(next))) : "");
            }}
            onBlur={() => commit()}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                setDraft(value);
                event.currentTarget.blur();
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              setMenuOpen(true);
            }}
          />
        ) : (
          <button
            type="button"
            className="h-full w-full text-[11px] font-black"
            onClick={() => setMenuOpen(true)}
            onContextMenu={(event) => {
              event.preventDefault();
              setMenuOpen(true);
            }}
          >
            {individualEntryCode(entry?.type || "holiday")}
          </button>
        )}
      </div>
      {menuOpen ? (
        <CellActionPopover
          onClose={() => setMenuOpen(false)}
          onApply={(type, reason) => {
            setMenuOpen(false);
            if (type === "clear") onSetEntry(row.id, day.iso, null);
            else if (type === "normal") onSetEntry(row.id, day.iso, { type: "normal", hours: normalHours });
            else onSetEntry(row.id, day.iso, { type, hours: 0, reason });
          }}
        />
      ) : null}
    </td>
  );
}

function CellActionPopover({
  onClose,
  onApply
}: {
  onClose: () => void;
  onApply: (type: string, reason?: string) => void;
}) {
  return (
    <div className="absolute left-8 top-6 z-50 w-44 rounded-lg border border-slate-200 bg-white p-1 text-left shadow-2xl shadow-slate-950/20 dark:border-slate-700 dark:bg-slate-900">
      <button type="button" className={menuItemClass()} onClick={() => onApply("normal")}>Normal shift</button>
      <button type="button" className={menuItemClass()} onClick={() => onApply("vacation")}>Vacation CO</button>
      <button type="button" className={menuItemClass()} onClick={() => onApply("medical")}>Medical CM</button>
      <button type="button" className={menuItemClass()} onClick={() => onApply("absence")}>Absence</button>
      <details className="group">
        <summary className="cursor-pointer rounded-md px-2 py-1.5 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800">Special Event</summary>
        <div className="mt-1 grid gap-0.5 border-t border-slate-100 pt-1 dark:border-slate-800">
          {SPECIAL_EVENT_REASONS.map((reason) => (
            <button key={reason} type="button" className={menuItemClass("pl-4 text-[11px]")} onClick={() => onApply("special_event", reason)}>{reason}</button>
          ))}
        </div>
      </details>
      <button type="button" className={menuItemClass("text-rose-700 dark:text-rose-300")} onClick={() => onApply("clear")}>Clear</button>
      <button type="button" className={menuItemClass("text-slate-500")} onClick={onClose}>Close</button>
    </div>
  );
}

function TotalCell({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "bad" }) {
  return (
    <td className={`border-r border-slate-100 px-2 py-1 text-center text-xs font-black dark:border-slate-800 ${tone === "good" ? "text-teal-700 dark:text-teal-300" : tone === "bad" ? "text-rose-700 dark:text-rose-300" : ""}`}>
      {children}
    </td>
  );
}

function individualHeaderStats(table: IndividualTableData) {
  const days = daysInMonth(table.month);
  const holidaysByDate = new Map(table.holidays.map((holiday) => [holiday.date, holiday]));
  const normal = individualNormalHours(table);
  const totals = table.rows.reduce(
    (sum, row) => {
      const rowTotals = individualTotals(row, table);
      sum.worked += rowTotals.worked;
      sum.norm += rowTotals.norm;
      sum.ot += rowTotals.ot;
      sum.co += rowTotals.co;
      sum.cm += rowTotals.cm;
      sum.se += rowTotals.se;
      sum.ab += rowTotals.ab;
      return sum;
    },
    { worked: 0, norm: 0, ot: 0, co: 0, cm: 0, se: 0, ab: 0 }
  );
  return {
    people: table.rows.length,
    worked: totals.worked,
    norm: totals.norm,
    diff: totals.worked - totals.norm,
    ot: totals.ot,
    co: totals.co,
    cm: totals.cm,
    se: totals.se,
    ab: totals.ab,
    daily: days
      .filter((day) => isIndividualWorkDay(day, holidaysByDate))
      .map((day) => {
        const worked = table.rows.reduce((sum, row) => {
          const entry = table.entries[row.id]?.[day.iso];
          return sum + (entry && ["normal", "overtime"].includes(entry.type) ? Number(entry.hours || 0) : 0);
        }, 0);
        const norm = table.rows.length * normal;
        return { day: day.day, worked, variance: worked - norm };
      })
  };
}

function inputClass(extra = "") {
  return `h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 dark:border-slate-700 dark:bg-slate-950 dark:text-white ${extra}`;
}

function selectClass() {
  return inputClass("appearance-none");
}

function toolButtonClass(extra = "") {
  return `inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 ${extra}`;
}

function commandButtonClass(extra = "") {
  return `h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 ${extra}`;
}

function tableInputClass(extra = "") {
  return `h-8 w-full rounded-md bg-transparent px-2 text-xs font-semibold text-slate-950 outline-none placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-teal-600 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-slate-950 ${extra}`;
}

function tinyActionClass(extra = "") {
  return `rounded-md px-1.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] hover:bg-slate-100 dark:hover:bg-slate-800 ${extra}`;
}

function menuItemClass(extra = "") {
  return `block w-full rounded-md px-2 py-1.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 ${extra}`;
}

function individualCellClass(type: string) {
  if (type === "vacation") return "bg-emerald-100 text-emerald-950 dark:bg-emerald-900/55 dark:text-emerald-50";
  if (type === "medical") return "bg-rose-100 text-rose-950 dark:bg-rose-900/55 dark:text-rose-50";
  if (type === "overtime") return "bg-amber-100 text-amber-950 dark:bg-amber-900/55 dark:text-amber-50";
  if (type === "absence") return "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950";
  if (type === "special_event") return "bg-slate-200 text-slate-950 dark:bg-slate-700 dark:text-white";
  if (type === "holiday") return "bg-yellow-50 text-slate-500 dark:bg-yellow-950/40 dark:text-yellow-100";
  if (type === "weekend") return "bg-sky-50 text-slate-500 dark:bg-sky-950/30 dark:text-slate-400";
  return "bg-white text-slate-950 dark:bg-slate-900 dark:text-white";
}
