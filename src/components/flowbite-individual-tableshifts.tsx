"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Toaster, toast } from "sonner";
import { daysInMonth, formatNumber, monthOptions } from "@/lib/tableshifts";
import {
  COUNTRY_OPTIONS,
  SPECIAL_EVENT_REASONS,
  type IndividualColumnWidths,
  type IndividualEntry,
  type IndividualHoliday,
  type IndividualRow,
  type IndividualTableData,
  createIndividualTable,
  defaultIndividualRow,
  downloadIndividualTemplate,
  exportIndividualXlsx,
  individualEntryCode,
  individualNormalHours,
  individualRowHasContent,
  individualRowsFromMatrix,
  individualTooltipText,
  individualTotals,
  isIndividualWorkDay,
  migrateIndividualTable,
  parseEmployeeWorkbook
} from "@/lib/individual-tableshifts";

type Props = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

type ThemeMode = "light" | "dark" | "auto";
type LayoutMode = "desktop" | "mobile";

export function FlowbiteIndividualTableShiftsApp({ supabaseUrl, supabaseAnonKey }: Props) {
  const supabase = React.useMemo<SupabaseClient | null>(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient(supabaseUrl, supabaseAnonKey);
  }, [supabaseUrl, supabaseAnonKey]);

  const [theme, setTheme] = React.useState<ThemeMode>("auto");
  const [systemTheme, setSystemTheme] = React.useState<"light" | "dark">("light");
  const [layoutMode, setLayoutMode] = React.useState<LayoutMode>("desktop");
  const [table, setTable] = React.useState<IndividualTableData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");
  const resolvedTheme = theme === "auto" ? systemTheme : theme;

  React.useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const syncLayout = () => setLayoutMode(query.matches ? "mobile" : "desktop");
    syncLayout();
    query.addEventListener("change", syncLayout);
    return () => query.removeEventListener("change", syncLayout);
  }, []);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => setSystemTheme(query.matches ? "dark" : "light");
    syncTheme();
    query.addEventListener("change", syncTheme);
    return () => query.removeEventListener("change", syncTheme);
  }, []);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tableId = params.get("table");
    if (tableId && supabase) void loadTable(tableId);
    else setLoading(false);
  }, [supabase]);

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [resolvedTheme]);

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
    <div className={resolvedTheme === "dark" ? "dark" : ""}>
      <Toaster position="top-center" richColors closeButton />
      {table ? (
        <IndividualTableWorkspace
          table={table}
          onSave={(next) => void saveTable(next)}
          onBack={backToLogin}
          theme={theme}
          setTheme={setTheme}
          layoutMode={layoutMode}
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
                onClick={() => setTheme(nextThemeMode(theme))}
              >
                {themeLabel(theme)}
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
  layoutMode
}: {
  table: IndividualTableData;
  onSave: (table: IndividualTableData) => void;
  onBack: () => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  layoutMode: LayoutMode;
}) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const days = daysInMonth(table.month);
  const stats = individualHeaderStats(table);
  const [holidayCountry, setHolidayCountry] = React.useState("RO");
  const [holidayYear, setHolidayYear] = React.useState(String(new Date().getFullYear()));
  const [detailColumnsOpen, setDetailColumnsOpen] = React.useState(false);
  const [totalColumnsOpen, setTotalColumnsOpen] = React.useState(false);
  const [employeesOpen, setEmployeesOpen] = React.useState(false);
  const employeesButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const employeeDirectory = React.useMemo(() => mergeEmployeeRows([...(table.employeePool || []), ...table.rows]), [table.employeePool, table.rows]);

  function updateTable(patch: Partial<IndividualTableData>) {
    onSave({ ...table, ...patch });
  }

  function updateRow(rowId: string, patch: Partial<IndividualRow>) {
    const rows = table.rows.map((row) => row.id === rowId ? { ...row, ...patch } : row);
    onSave({ ...table, rows });
  }

  function updateColumnWidths(columnWidths: IndividualColumnWidths) {
    onSave({ ...table, columnWidths: { ...(table.columnWidths || {}), ...columnWidths } });
  }

  function removeRow(rowId: string) {
    const entries = { ...table.entries };
    delete entries[rowId];
    onSave({ ...table, rows: table.rows.filter((row) => row.id !== rowId), entries });
    toast.success("Employee row removed.");
  }

  function addBlankRow() {
    onSave({ ...table, rows: [...table.rows, defaultIndividualRow()] });
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
        const rows = parseEmployeeWorkbook(reader.result as ArrayBuffer);
        const nextRows = individualRowsFromMatrix(rows);
        if (nextRows.length) {
          const employeePool = mergeEmployeeRows([...(table.employeePool || []), ...nextRows]);
          onSave({ ...table, employeePool });
          setEmployeesOpen(true);
          toast.success(`${nextRows.length} employees added to the list.`);
        } else {
          toast.warning("No employees found in that file.");
        }
      } catch {
        toast.error("Could not import that employee file.");
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function toggleEmployee(employee: IndividualRow, selected: boolean) {
    const activeRow = findActiveEmployeeRow(table.rows, employee);
    if (selected) {
      if (activeRow) return;
      const rows = table.rows.filter((row) => individualRowHasContent(row) || rowHasRecordedData(row.id, table));
      onSave({
        ...table,
        employeePool: mergeEmployeeRows([...(table.employeePool || []), employee]),
        rows: [...rows, employee]
      });
      return;
    }
    if (!activeRow) return;
    if (rowHasRecordedData(activeRow.id, table) && !window.confirm(`${activeRow.name || "This employee"} has recorded table data. Remove the employee and delete those entries?`)) return;
    const entries = { ...table.entries };
    delete entries[activeRow.id];
    onSave({
      ...table,
      employeePool: mergeEmployeeRows([...(table.employeePool || []), activeRow]),
      rows: table.rows.filter((row) => row.id !== activeRow.id),
      entries
    });
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
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-black tracking-tight">Individual TableShifts</h1>
                <span className="inline-flex h-6 items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {layoutMode === "desktop" ? "Desktop View" : "Mobile View"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={secondaryButtonClass()} onClick={copyLink}>Copy Link</button>
              <button type="button" className={secondaryButtonClass()} onClick={() => setTheme(nextThemeMode(theme))}>
                {themeLabel(theme)}
              </button>
              <button type="button" className={primaryDarkButtonClass()} onClick={onBack}>
                Login
              </button>
            </div>
          </div>
        </header>

        <section className="border-b border-slate-200 bg-white px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900 lg:px-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 shadow-sm shadow-slate-200/30 dark:border-slate-800 dark:bg-slate-950/55 dark:shadow-black/10">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-end gap-2.5">
                <CompactField label="Month" className="w-[152px]">
                  <select className={centeredSelectClass()} value={table.month} onChange={(event) => updateTable({ month: event.target.value })}>
                    {monthOptions(table.month).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </CompactField>
                <CompactField label="Shift" className="w-[74px]">
                  <select className={centeredSelectClass()} value={individualNormalHours(table)} onChange={(event) => updateTable({ normalHours: Number(event.target.value) })}>
                    {Array.from({ length: 24 }, (_, index) => index + 1).map((hour) => (
                      <option key={hour} value={hour}>{hour}h</option>
                    ))}
                  </select>
                </CompactField>
                <div className="hidden h-8 w-px bg-slate-200 dark:bg-slate-800 sm:block" />
                <div className="hidden h-8 items-center rounded-md bg-slate-100 px-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 dark:bg-slate-800 dark:text-slate-300 sm:flex">
                  Holidays
                </div>
                <CompactField label="Country" className="w-[158px]">
                  <select className={centeredSelectClass()} value={holidayCountry} onChange={(event) => setHolidayCountry(event.target.value)}>
                    {COUNTRY_OPTIONS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                  </select>
                </CompactField>
                <CompactField label="Year" className="w-[76px]">
                  <input className={inputClass("text-center")} value={holidayYear} inputMode="numeric" onChange={(event) => setHolidayYear(event.target.value.replace(/\D/g, "").slice(0, 4))} />
                </CompactField>
                <button type="button" className={secondaryButtonClass("h-8 px-4")} onClick={addPublicHolidays}>Load</button>
              </div>
              <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900 xl:flex-nowrap">
                <Metric label="People" value={String(stats.people)} />
                <Metric label="Worked" value={`${formatNumber(stats.worked)}h`} />
                <Metric label="Norm" value={`${formatNumber(stats.norm)}h`} />
                <Metric label="Diff" value={`${stats.diff > 0 ? "+" : ""}${formatNumber(stats.diff)}h`} tone={stats.diff < 0 ? "bad" : "good"} />
                <Metric label="OT" value={`${formatNumber(stats.ot)}h`} />
                <Metric label="CO" value={`${stats.co}d`} />
                <Metric label="CM" value={`${stats.cm}d`} />
                <Metric label="SE" value={`${stats.se}d`} />
                <Metric label="AB" value={`${stats.ab}d`} tone={stats.ab ? "bad" : "neutral"} />
                <Metric label="Holidays" value={`${stats.holidays}`} />
              </div>
            </div>
          </div>
          <DailyBarStrip days={stats.daily} />
          <div className="mt-2 flex flex-wrap justify-start gap-2">
            <button type="button" className={primaryButtonClass("w-full sm:w-auto")} onClick={addBlankRow}>
              Add Row
            </button>
            <button type="button" ref={employeesButtonRef} className={primaryButtonClass("w-full sm:w-auto")} onClick={() => setEmployeesOpen((open) => !open)}>
              Add Employees
            </button>
            <button
              type="button"
              className={secondaryButtonClass("w-full sm:w-auto")}
              onClick={() => {
                exportIndividualXlsx(table);
                toast.success("XLSX exported.");
              }}
            >
              Export
            </button>
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={(event) => importEmployeeFile(event.target.files?.[0] || null)}
            />
          </div>
          {employeesOpen ? (
            <EmployeeDropdown
              anchorRef={employeesButtonRef}
              employees={employeeDirectory}
              activeRows={table.rows}
              onClose={() => setEmployeesOpen(false)}
              onImport={() => fileInputRef.current?.click()}
              onTemplate={downloadIndividualTemplate}
              onToggleEmployee={toggleEmployee}
            />
          ) : null}
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
              detailColumnsOpen={detailColumnsOpen}
              onToggleDetailColumns={() => setDetailColumnsOpen((open) => !open)}
              totalColumnsOpen={totalColumnsOpen}
              onToggleTotalColumns={() => setTotalColumnsOpen((open) => !open)}
              onColumnWidthsChange={updateColumnWidths}
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

function CompactField({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1 ${className}`}>
      <span className="text-center text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function ToolbarGroup({
  label,
  children,
  className = "",
  contentClassName = "grid-cols-2"
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-slate-950/60 ${className}`}>
      <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{label}</p>
      <div className={`grid items-end gap-2 [&>button]:w-full ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}

function EmployeeDropdown({
  anchorRef,
  employees,
  activeRows,
  onClose,
  onImport,
  onTemplate,
  onToggleEmployee
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  employees: IndividualRow[];
  activeRows: IndividualRow[];
  onClose: () => void;
  onImport: () => void;
  onTemplate: () => void;
  onToggleEmployee: (employee: IndividualRow, selected: boolean) => void;
}) {
  if (typeof document === "undefined") return null;
  const rect = anchorRef.current?.getBoundingClientRect();
  const width = Math.min(680, Math.max(320, window.innerWidth - 24));
  const left = rect ? Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)) : 12;
  const top = rect ? Math.min(rect.bottom + 8, window.innerHeight - 420) : 96;

  return createPortal(
    <>
      <button type="button" aria-label="Close employees menu" className="fixed inset-0 z-[89] cursor-default bg-transparent" onClick={onClose} />
      <div
        className="fixed z-[90] max-h-[min(520px,calc(100vh-7rem))] overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-950 shadow-2xl shadow-slate-950/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        style={{ left, top: Math.max(12, top), width }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Employees</p>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{employees.length} saved in this table</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className={secondaryButtonClass("h-8")} onClick={onImport}>Import</button>
            <button type="button" className={secondaryButtonClass("h-8")} onClick={onTemplate}>Template</button>
          </div>
        </div>
        <div className="max-h-[390px] overflow-auto">
          <table className="w-full min-w-[620px] border-collapse text-xs">
            <thead className="sticky top-0 bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="w-14 border-b border-slate-100 px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] dark:border-slate-800">Select</th>
                <th className="border-b border-slate-100 px-2 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] dark:border-slate-800">Employee</th>
                <th className="border-b border-slate-100 px-2 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] dark:border-slate-800">Department</th>
                <th className="border-b border-slate-100 px-2 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] dark:border-slate-800">ID</th>
                <th className="border-b border-slate-100 px-2 py-2 text-left text-[10px] font-black uppercase tracking-[0.12em] dark:border-slate-800">Position</th>
              </tr>
            </thead>
            <tbody>
              {employees.length ? employees.map((employee) => {
                const active = Boolean(findActiveEmployeeRow(activeRows, employee));
                return (
                  <tr key={`${employee.id}-${employeeMatchKey(employee)}`} className={active ? "bg-teal-50 dark:bg-teal-950/35" : "hover:bg-slate-50 dark:hover:bg-slate-800/70"}>
                    <td className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
                      <input
                        type="checkbox"
                        checked={active}
                        className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600 dark:border-slate-700 dark:bg-slate-950"
                        onChange={(event) => onToggleEmployee(employee, event.target.checked)}
                      />
                    </td>
                    <td className="border-b border-slate-100 px-2 py-2 font-black dark:border-slate-800">{employee.name || "Unnamed employee"}</td>
                    <td className="border-b border-slate-100 px-2 py-2 text-slate-600 dark:border-slate-800 dark:text-slate-300">{employee.department || "-"}</td>
                    <td className="border-b border-slate-100 px-2 py-2 text-slate-600 dark:border-slate-800 dark:text-slate-300">{employee.identificationNumber || "-"}</td>
                    <td className="border-b border-slate-100 px-2 py-2 text-slate-600 dark:border-slate-800 dark:text-slate-300">{employee.position || "-"}</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Import a template or type an employee in the table to build this list.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>,
    document.body
  );
}

function Kpi({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "bad" }) {
  return (
    <div className="flex min-h-11 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 text-center dark:border-slate-800 dark:bg-slate-950">
      <p className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-[13px] font-black leading-tight ${tone === "good" ? "text-teal-700 dark:text-teal-300" : tone === "bad" ? "text-rose-700 dark:text-rose-300" : ""}`}>{value}</p>
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "bad" }) {
  return (
    <div className="min-w-[54px] px-1.5 text-center">
      <p className="text-[8px] font-black uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-[15px] font-black leading-tight ${tone === "good" ? "text-teal-700 dark:text-teal-300" : tone === "bad" ? "text-rose-700 dark:text-rose-300" : "text-slate-950 dark:text-white"}`}>{value}</p>
    </div>
  );
}

function DailyBarStrip({ days }: { days: Array<{ day: number; worked: number; variance: number }> }) {
  const max = Math.max(1, ...days.map((day) => day.worked));
  return (
    <div className="mt-2 flex h-8 items-end gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-950">
      {days.map((day) => (
        <div
          key={day.day}
          title={`Day ${day.day}: ${formatNumber(day.worked)}h (${day.variance > 0 ? "+" : ""}${formatNumber(day.variance)}h)`}
          className={`min-h-1 flex-1 rounded-t-sm ${day.variance < 0 && day.worked > 0 ? "bg-rose-500" : day.variance > 0 ? "bg-teal-600" : "bg-slate-300 dark:bg-slate-700"}`}
          style={{ height: `${Math.max(5, (day.worked / max) * 22)}px` }}
        />
      ))}
    </div>
  );
}

type IndividualWidthKey = keyof Required<IndividualColumnWidths>;

const DEFAULT_INDIVIDUAL_COLUMN_WIDTHS: Record<IndividualWidthKey, number> = {
  employee: 224,
  company: 128,
  department: 128,
  identificationNumber: 120,
  position: 132
};

const INDIVIDUAL_COLUMN_LIMITS: Record<IndividualWidthKey, { min: number; max: number }> = {
  employee: { min: 160, max: 420 },
  company: { min: 96, max: 280 },
  department: { min: 96, max: 280 },
  identificationNumber: { min: 88, max: 260 },
  position: { min: 96, max: 300 }
};

const DAY_COLUMN_WIDTH = 38;

function resolvedIndividualColumnWidths(widths?: IndividualColumnWidths): Record<IndividualWidthKey, number> {
  return {
    employee: clampIndividualColumnWidth("employee", widths?.employee ?? DEFAULT_INDIVIDUAL_COLUMN_WIDTHS.employee),
    company: clampIndividualColumnWidth("company", widths?.company ?? DEFAULT_INDIVIDUAL_COLUMN_WIDTHS.company),
    department: clampIndividualColumnWidth("department", widths?.department ?? DEFAULT_INDIVIDUAL_COLUMN_WIDTHS.department),
    identificationNumber: clampIndividualColumnWidth("identificationNumber", widths?.identificationNumber ?? DEFAULT_INDIVIDUAL_COLUMN_WIDTHS.identificationNumber),
    position: clampIndividualColumnWidth("position", widths?.position ?? DEFAULT_INDIVIDUAL_COLUMN_WIDTHS.position)
  };
}

function clampIndividualColumnWidth(key: IndividualWidthKey, width: number) {
  const limits = INDIVIDUAL_COLUMN_LIMITS[key];
  return Math.max(limits.min, Math.min(limits.max, Math.round(width)));
}

function DesktopIndividualTable({
  table,
  onUpdateRow,
  onRemoveRow,
  onSetEntry,
  onFillRow,
  onClearRow,
  detailColumnsOpen,
  onToggleDetailColumns,
  totalColumnsOpen,
  onToggleTotalColumns,
  onColumnWidthsChange
}: {
  table: IndividualTableData;
  onUpdateRow: (rowId: string, patch: Partial<IndividualRow>) => void;
  onRemoveRow: (rowId: string) => void;
  onSetEntry: (rowId: string, iso: string, entry: IndividualEntry | null) => void;
  onFillRow: (row: IndividualRow) => void;
  onClearRow: (row: IndividualRow) => void;
  detailColumnsOpen: boolean;
  onToggleDetailColumns: () => void;
  totalColumnsOpen: boolean;
  onToggleTotalColumns: () => void;
  onColumnWidthsChange: (widths: IndividualColumnWidths) => void;
}) {
  const days = daysInMonth(table.month);
  const holidaysByDate = new Map(table.holidays.map((holiday) => [holiday.date, holiday]));
  const committedWidths = React.useMemo(() => resolvedIndividualColumnWidths(table.columnWidths), [table.columnWidths]);
  const [draftWidths, setDraftWidths] = React.useState(committedWidths);
  React.useEffect(() => setDraftWidths(committedWidths), [committedWidths]);
  const tableMinWidth = draftWidths.employee
    + 64
    + (detailColumnsOpen ? draftWidths.company + draftWidths.department + draftWidths.identificationNumber + draftWidths.position : 0)
    + days.length * DAY_COLUMN_WIDTH
    + 64
    + (totalColumnsOpen ? 7 * 64 : 64)
    + 160;

  function resizeColumn(key: IndividualWidthKey, width: number) {
    const nextWidth = clampIndividualColumnWidth(key, width);
    setDraftWidths((current) => ({ ...current, [key]: nextWidth }));
  }

  function commitColumnWidth(key: IndividualWidthKey, width: number) {
    onColumnWidthsChange({ [key]: clampIndividualColumnWidth(key, width) });
  }

  return (
    <div className="h-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
      <div className="h-full overflow-auto">
        <table className="w-full table-fixed border-collapse text-xs" style={{ minWidth: `${tableMinWidth}px` }}>
          <colgroup>
            <col style={{ width: `${draftWidths.employee}px` }} />
            <col className="w-16" />
            {detailColumnsOpen ? (
              <>
                <col style={{ width: `${draftWidths.company}px` }} />
                <col style={{ width: `${draftWidths.department}px` }} />
                <col style={{ width: `${draftWidths.identificationNumber}px` }} />
                <col style={{ width: `${draftWidths.position}px` }} />
              </>
            ) : null}
            {days.map((day) => <col key={day.iso} style={{ width: `${DAY_COLUMN_WIDTH}px` }} />)}
            <col className="w-16" />
            <col className="w-16" />
            {totalColumnsOpen ? (
              <>
                <col className="w-16" />
                <col className="w-16" />
                <col className="w-16" />
                <col className="w-16" />
                <col className="w-16" />
                <col className="w-16" />
                <col className="w-16" />
              </>
            ) : null}
            <col className="w-40" />
          </colgroup>
          <thead className="sticky top-0 z-30 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <tr>
              <ResizableHeader
                label="Employee"
                widthKey="employee"
                width={draftWidths.employee}
                sticky
                onResize={resizeColumn}
                onCommit={commitColumnWidth}
              />
              <th className="border-b border-r border-slate-200 px-1 py-2 text-center dark:border-slate-700">
                <button type="button" className={compactToggleClass()} onClick={onToggleDetailColumns}>{detailColumnsOpen ? "Less" : "More"}</button>
              </th>
              {detailColumnsOpen ? (
                <>
                  <ResizableHeader label="Company" widthKey="company" width={draftWidths.company} onResize={resizeColumn} onCommit={commitColumnWidth} />
                  <ResizableHeader label="Department" widthKey="department" width={draftWidths.department} onResize={resizeColumn} onCommit={commitColumnWidth} />
                  <ResizableHeader label="ID" widthKey="identificationNumber" width={draftWidths.identificationNumber} onResize={resizeColumn} onCommit={commitColumnWidth} />
                  <ResizableHeader label="Position" widthKey="position" width={draftWidths.position} onResize={resizeColumn} onCommit={commitColumnWidth} />
                </>
              ) : null}
              {days.map((day) => {
                const headerTone = holidaysByDate.has(day.iso) ? "holiday" : day.weekdayIndex === 0 || day.weekdayIndex === 6 ? "weekend" : "workday";
                return (
                  <th key={day.iso} className={`border-b border-r px-0.5 py-1 text-center ${dayHeaderClass(headerTone)}`} style={{ width: `${DAY_COLUMN_WIDTH}px` }}>
                    <span className="block text-sm font-black text-current">{day.day}</span>
                    <span className="text-[9px] font-bold uppercase text-current/70">{day.weekday.slice(0, 3)}</span>
                  </th>
                );
              })}
              <th className="border-b border-r border-slate-200 px-2 py-2 text-center text-[10px] font-black uppercase tracking-[0.12em] dark:border-slate-700">Worked</th>
              <th className="border-b border-r border-slate-200 px-1 py-2 text-center dark:border-slate-700">
                <button type="button" className={compactToggleClass()} onClick={onToggleTotalColumns}>{totalColumnsOpen ? "Less" : "More"}</button>
              </th>
              {totalColumnsOpen ? ["Norm", "Diff", "OT", "CO", "CM", "SE", "AB"].map((label) => (
                <th key={label} className="border-b border-r border-slate-200 px-2 py-2 text-center text-[10px] font-black uppercase tracking-[0.12em] dark:border-slate-700">{label}</th>
              )) : null}
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
                  <td className="border-r border-slate-100 px-1 py-1 text-center dark:border-slate-800">
                    <button type="button" className={tinyActionClass("text-slate-500 dark:text-slate-300")} onClick={onToggleDetailColumns}>{detailColumnsOpen ? "Less" : "..."}</button>
                  </td>
                  {detailColumnsOpen ? (
                    <>
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
                    </>
                  ) : null}
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
                  <td className="border-r border-slate-100 px-1 py-1 text-center dark:border-slate-800">
                    <button type="button" className={tinyActionClass("text-slate-500 dark:text-slate-300")} onClick={onToggleTotalColumns}>{totalColumnsOpen ? "Less" : "..."}</button>
                  </td>
                  {totalColumnsOpen ? (
                    <>
                      <TotalCell>{formatNumber(totals.norm)}h</TotalCell>
                      <TotalCell tone={totals.diff < 0 ? "bad" : "good"}>{totals.diff > 0 ? "+" : ""}{formatNumber(totals.diff)}h</TotalCell>
                      <TotalCell>{formatNumber(totals.ot)}h</TotalCell>
                      <TotalCell>{totals.co}d</TotalCell>
                      <TotalCell>{totals.cm}d</TotalCell>
                      <TotalCell>{totals.se}d</TotalCell>
                      <TotalCell>{totals.ab}d</TotalCell>
                    </>
                  ) : null}
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

function ResizableHeader({
  label,
  widthKey,
  width,
  sticky = false,
  onResize,
  onCommit
}: {
  label: string;
  widthKey: IndividualWidthKey;
  width: number;
  sticky?: boolean;
  onResize: (key: IndividualWidthKey, width: number) => void;
  onCommit: (key: IndividualWidthKey, width: number) => void;
}) {
  function startResize(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = width;
    let nextWidth = width;

    function handleMove(moveEvent: PointerEvent) {
      nextWidth = clampIndividualColumnWidth(widthKey, startWidth + moveEvent.clientX - startX);
      onResize(widthKey, nextWidth);
    }

    function handleUp() {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      onCommit(widthKey, nextWidth);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp, { once: true });
  }

  return (
    <th
      className={`${sticky ? "sticky left-0 z-40 bg-slate-100 dark:bg-slate-800" : ""} relative border-b border-r border-slate-200 px-3 py-2 text-left text-[11px] font-black uppercase tracking-[0.12em] dark:border-slate-700`}
      style={{ width: `${width}px` }}
    >
      <span className="block truncate pr-2">{label}</span>
      <button
        type="button"
        aria-label={`Resize ${label} column`}
        className="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none border-r border-transparent hover:border-teal-500 focus:border-teal-600 focus:outline-none"
        onPointerDown={startResize}
      />
    </th>
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
  const [openRowId, setOpenRowId] = React.useState(table.rows[0]?.id || "");
  React.useEffect(() => {
    if (!table.rows.length) {
      setOpenRowId("");
      return;
    }
    if (!table.rows.some((row) => row.id === openRowId)) setOpenRowId(table.rows[0].id);
  }, [openRowId, table.rows]);

  return (
    <div className="grid gap-2">
      {table.rows.map((row, index) => {
        const totals = individualTotals(row, table);
        const expanded = row.id === openRowId;
        return (
          <article key={row.id} className={`overflow-hidden rounded-xl border bg-white shadow-lg shadow-slate-200/60 transition dark:bg-slate-900 dark:shadow-black/20 ${expanded ? "border-teal-200 dark:border-teal-800" : "border-slate-200 dark:border-slate-800"}`}>
            <button
              type="button"
              className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition ${expanded ? "bg-teal-50/70 dark:bg-teal-950/30" : "bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/70"}`}
              onClick={() => setOpenRowId(row.id)}
              aria-expanded={expanded}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px] font-black text-slate-500 dark:bg-slate-800 dark:text-slate-300">{index + 1}</span>
                  <span className="truncate text-sm font-black text-slate-950 dark:text-white">{row.name || "Employee name"}</span>
                </div>
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {[row.department, row.position].filter(Boolean).join(" / ") || row.company || row.identificationNumber || "No details yet"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs font-black text-slate-500 dark:text-slate-300">{formatNumber(totals.worked)}h</span>
                <span className={`text-lg leading-none text-slate-400 transition ${expanded ? "rotate-180" : ""}`}>⌄</span>
              </div>
            </button>
            {expanded ? (
              <div className="p-3">
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
                  <button type="button" className={secondaryButtonClass("h-9")} onClick={() => onFillRow(row)}>Fill Row</button>
                  <button type="button" className={secondaryButtonClass("h-9")} onClick={() => onClearRow(row)}>Clear Row</button>
                  <button type="button" className={secondaryButtonClass("h-9 text-rose-700 dark:text-rose-300")} onClick={() => onRemoveRow(row.id)}>Delete</button>
                </div>
              </div>
            ) : null}
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
  const [menuPosition, setMenuPosition] = React.useState<{ x: number; y: number } | null>(null);
  const normalHours = individualNormalHours(table);
  const workDay = isIndividualWorkDay(day, new Map(table.holidays.map((item) => [item.date, item])));
  const type = entry?.type || (holiday ? "holiday" : workDay ? "empty" : "weekend");
  function openMenu(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setMenuPosition({ x: event.clientX, y: event.clientY });
  }
  return (
    <div className="relative">
      <button
        type="button"
        title={individualTooltipText(entry, holiday, workDay, normalHours)}
        className={`h-14 w-full rounded-lg border border-slate-200 text-center text-[11px] font-black dark:border-slate-800 ${individualCellClass(type)}`}
        onClick={() => {
          if (!entry && workDay) onSetEntry(row.id, day.iso, { type: "normal", hours: normalHours });
          else setMenuPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        }}
        onContextMenu={openMenu}
      >
        <span className="block text-[10px] text-current/70">{day.day}</span>
        <span>{entry ? (["normal", "overtime"].includes(entry.type) ? `${formatNumber(entry.hours)}h` : individualEntryCode(entry.type)) : holiday ? "H" : workDay ? "+" : "-"}</span>
      </button>
      {menuPosition ? (
        <CellActionPopover
          x={menuPosition.x}
          y={menuPosition.y}
          onClose={() => setMenuPosition(null)}
          onApply={(type, reason) => {
            setMenuPosition(null);
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
  const [menuPosition, setMenuPosition] = React.useState<{ x: number; y: number } | null>(null);
  const normalHours = individualNormalHours(table);
  const workDay = isIndividualWorkDay(day, new Map(table.holidays.map((item) => [item.date, item])));
  const numeric = !entry || ["normal", "overtime"].includes(entry.type);
  const value = numeric && entry ? String(formatNumber(entry.hours)) : "";
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);

  function openMenu(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setMenuPosition({ x: event.clientX, y: event.clientY });
  }

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
    <td
      className={`relative h-10 border-r border-slate-100 p-0 text-center dark:border-slate-800 ${individualCellClass(type)}`}
      onContextMenu={openMenu}
    >
      <div title={individualTooltipText(entry, holiday, workDay, normalHours)} className="grid h-10 place-items-center">
        {!entry && workDay ? (
          <button
            type="button"
            className="grid h-full w-full place-items-center text-base font-black text-teal-700 transition hover:bg-teal-100/70 dark:text-teal-300 dark:hover:bg-teal-900/40"
            onClick={() => onSetEntry(row.id, day.iso, { type: "normal", hours: normalHours })}
          >
            +
          </button>
        ) : !entry ? (
          <button
            type="button"
            className="grid h-full w-full place-items-center text-[11px] font-black text-current/60 transition hover:bg-slate-100/60 dark:hover:bg-slate-800/60"
            onClick={openMenu}
          >
            {holiday ? "H" : "-"}
          </button>
        ) : numeric ? (
          <div className="flex h-8 items-center justify-center gap-px">
            <input
              className="h-8 min-w-[1ch] bg-transparent p-0 text-center text-[13px] font-black outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              style={{ width: `${Math.max(1, draft.length || 1)}ch` }}
              value={draft}
              placeholder={holiday ? "H" : ""}
              inputMode="numeric"
              onFocus={(event) => event.currentTarget.select()}
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
                openMenu(event);
              }}
            />
            <span className="pointer-events-none text-[10px] font-medium text-current/45">h</span>
          </div>
        ) : (
          <button
            type="button"
            className="h-full w-full text-[11px] font-black"
            onClick={openMenu}
            onContextMenu={openMenu}
          >
            {individualEntryCode(entry?.type || "holiday")}
          </button>
        )}
      </div>
      {menuPosition ? (
        <CellActionPopover
          x={menuPosition.x}
          y={menuPosition.y}
          onClose={() => setMenuPosition(null)}
          onApply={(type, reason) => {
            setMenuPosition(null);
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
  x,
  y,
  onClose,
  onApply
}: {
  x: number;
  y: number;
  onClose: () => void;
  onApply: (type: string, reason?: string) => void;
}) {
  const left = typeof window === "undefined" ? x : Math.max(8, Math.min(x, window.innerWidth - 196));
  const top = typeof window === "undefined" ? y : Math.max(8, Math.min(y, window.innerHeight - 340));
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <button type="button" aria-label="Close cell menu" className="fixed inset-0 z-[99] cursor-default bg-transparent" onClick={onClose} />
      <div
        className="fixed z-[100] w-44 rounded-lg border border-slate-200 bg-white p-1 text-left shadow-2xl shadow-slate-950/20 dark:border-slate-700 dark:bg-slate-900"
        style={{ left, top }}
        onClick={(event) => event.stopPropagation()}
      >
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
    </>,
    document.body
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
  const rowsWithChartInput = table.rows.filter((row) => individualRowHasContent(row) || days.some((day) => table.entries[row.id]?.[day.iso]));
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
    holidays: table.holidays.filter((holiday) => holiday.date.startsWith(`${table.month}-`)).length,
    daily: days
      .filter((day) => isIndividualWorkDay(day, holidaysByDate))
      .map((day) => {
        const worked = rowsWithChartInput.reduce((sum, row) => {
          const entry = table.entries[row.id]?.[day.iso];
          return sum + (entry && ["normal", "overtime"].includes(entry.type) ? Number(entry.hours || 0) : 0);
        }, 0);
        const norm = rowsWithChartInput.length * normal;
        return { day: day.day, worked, variance: worked - norm };
      })
  };
}

function employeeMatchKey(row: IndividualRow) {
  const id = row.identificationNumber.trim().toLowerCase();
  if (id) return `id:${id}`;
  return [
    row.name,
    row.company,
    row.department,
    row.position
  ].map((item) => item.trim().toLowerCase()).join("|") || `row:${row.id}`;
}

function mergeEmployeeRows(rows: IndividualRow[]) {
  const merged: IndividualRow[] = [];
  rows.filter(individualRowHasContent).forEach((row) => {
    const key = employeeMatchKey(row);
    const existingIndex = merged.findIndex((item) => item.id === row.id || employeeMatchKey(item) === key);
    if (existingIndex >= 0) merged[existingIndex] = { ...merged[existingIndex], ...row };
    else merged.push(row);
  });
  return merged;
}

function findActiveEmployeeRow(rows: IndividualRow[], employee: IndividualRow) {
  const key = employeeMatchKey(employee);
  return rows.find((row) => row.id === employee.id || employeeMatchKey(row) === key);
}

function rowHasRecordedData(rowId: string, table: IndividualTableData) {
  return Object.keys(table.entries[rowId] || {}).length > 0;
}

function nextThemeMode(theme: ThemeMode): ThemeMode {
  if (theme === "light") return "dark";
  if (theme === "dark") return "auto";
  return "light";
}

function themeLabel(theme: ThemeMode) {
  if (theme === "auto") return "Auto";
  return theme === "dark" ? "Dark" : "Light";
}

function inputClass(extra = "") {
  return `h-8 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 dark:border-slate-700 dark:bg-slate-950 dark:text-white ${extra}`;
}

function selectClass(extra = "") {
  return inputClass(`appearance-none ${extra}`);
}

function centeredSelectClass(extra = "") {
  return selectClass(`text-center [text-align-last:center] ${extra}`);
}

function primaryButtonClass(extra = "") {
  return `inline-flex h-8 items-center justify-center rounded-lg border border-teal-700 bg-teal-700 px-3 text-xs font-black text-white shadow-sm shadow-teal-700/15 transition hover:border-teal-800 hover:bg-teal-800 dark:border-teal-500 dark:bg-teal-500 dark:text-slate-950 dark:hover:bg-teal-400 ${extra}`;
}

function primaryDarkButtonClass(extra = "") {
  return `inline-flex h-9 items-center justify-center rounded-lg border border-slate-950 bg-slate-950 px-3 text-xs font-black text-white transition hover:bg-slate-800 dark:border-white dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200 ${extra}`;
}

function secondaryButtonClass(extra = "") {
  return `inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 ${extra}`;
}

function tableInputClass(extra = "") {
  return `h-8 w-full rounded-md bg-transparent px-2 text-xs font-semibold text-slate-950 outline-none placeholder:text-slate-400 focus:bg-white focus:ring-1 focus:ring-teal-600 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-slate-950 ${extra}`;
}

function tinyActionClass(extra = "") {
  return `rounded-md px-1.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] hover:bg-slate-100 dark:hover:bg-slate-800 ${extra}`;
}

function compactToggleClass(extra = "") {
  return `inline-flex h-7 items-center justify-center rounded-md border border-slate-200 bg-white px-2 text-[10px] font-black uppercase tracking-[0.08em] text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 ${extra}`;
}

function menuItemClass(extra = "") {
  return `block w-full rounded-md px-2 py-1.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 ${extra}`;
}

function dayHeaderClass(tone: "workday" | "weekend" | "holiday") {
  if (tone === "holiday") return "border-yellow-200 bg-yellow-100/80 text-yellow-900 dark:border-yellow-900/70 dark:bg-yellow-950/45 dark:text-yellow-100";
  if (tone === "weekend") return "border-sky-200 bg-sky-100/80 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-100";
  return "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
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
