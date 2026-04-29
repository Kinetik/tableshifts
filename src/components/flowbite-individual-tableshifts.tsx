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
  return (
    <main className="min-h-screen bg-white p-6 text-slate-950 dark:bg-slate-950 dark:text-white">
      <button type="button" onClick={onBack}>Back</button>
      <button type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>Theme</button>
      <button type="button" onClick={() => setLayoutMode(layoutMode === "desktop" ? "mobile" : "desktop")}>{layoutMode}</button>
      <h1>Individual TableShifts</h1>
      <p>{table.id}</p>
      <p>{daysInMonth(table.month).length} days in {table.month}</p>
      <p>{formatNumber(individualNormalHours(table))}h shifts</p>
      <p>{COUNTRY_OPTIONS[0][1]} holidays available later</p>
      <p>{SPECIAL_EVENT_REASONS.length} special event reasons</p>
      <button type="button" onClick={() => onSave({ ...table, rows: [...table.rows, defaultIndividualRow()] })}>Add row</button>
      <button type="button" onClick={downloadIndividualTemplate}>Template</button>
      <button type="button" onClick={() => exportIndividualCsv(table)}>Export</button>
    </main>
  );
}
