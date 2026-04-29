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
