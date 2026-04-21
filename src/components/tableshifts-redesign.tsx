"use client";

import * as React from "react";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Download,
  Eraser,
  Eye,
  FileText,
  LayoutDashboard,
  LogOut,
  Paintbrush,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  X,
  UsersRound
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  ENTRY_LABELS,
  ROLES,
  type CompanyRow,
  type DepartmentRow,
  type EntryRow,
  type HolidayRow,
  type LeaveRequestRow,
  type PayrollAccessRow,
  type ProfileRow,
  type Workspace,
  accessibleCompanies,
  canApproveLeave,
  canCreateLeaveRequest,
  canEditEmployee,
  currentMonth,
  daysInMonth,
  departmentFor,
  entryFor,
  formatNumber,
  filteredEmployees,
  generatedLeaveDocumentHtml,
  holidayForEmployee,
  isExpectedWorkDay,
  monthOptions,
  monthRange,
  normalHours,
  totalsFor,
  visibleLeaveRequests
} from "@/lib/tableshifts";

type Props = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

const nav = [
  { value: "timesheet", label: "Timesheet", icon: LayoutDashboard },
  { value: "leave", label: "Leave Requests", icon: ClipboardCheck },
  { value: "charts", label: "Charts", icon: BarChart3 },
  { value: "companies", label: "Companies", icon: Building2, setupOnly: true },
  { value: "employees", label: "Employees", icon: UsersRound, setupOnly: true },
  { value: "admins", label: "Admins", icon: ShieldCheck, setupOnly: true },
  { value: "settings", label: "Settings", icon: Settings2, setupOnly: true }
];

export function TableShiftsRedesign({ supabaseUrl, supabaseAnonKey }: Props) {
  const supabase = React.useMemo<SupabaseClient | null>(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  }, [supabaseUrl, supabaseAnonKey]);

  const [authUser, setAuthUser] = React.useState<User | null>(null);
  const [workspace, setWorkspace] = React.useState<Workspace | null>(null);
  const [activeTab, setActiveTab] = React.useState("timesheet");
  const [activeCompanyId, setActiveCompanyId] = React.useState("");
  const [departmentFilter, setDepartmentFilter] = React.useState("all");
  const [teamFilter, setTeamFilter] = React.useState("all");
  const [month, setMonth] = React.useState(currentMonth());
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");
  const [editor, setEditor] = React.useState<{ employee: ProfileRow; iso: string } | null>(null);
  const [totalsExpanded, setTotalsExpanded] = React.useState(false);

  const loadWorkspace = React.useCallback(async (user: User) => {
    if (!supabase) return;
    setLoading(true);
    setMessage("");
    try {
      const profile = await waitForProfile(supabase, user.id);
      if (!profile?.environment_id) {
        setWorkspace(null);
        setMessage("This account exists, but no TableShifts profile/environment is attached yet.");
        return;
      }

      const environmentId = profile.environment_id;
      const range = monthRange(month);
      const [environmentResult, profilesResult, companiesResult, departmentsResult, accessResult, holidaysResult, entriesResult, leaveResult] = await Promise.all([
        supabase.from("admin_environments").select("owner_user_id").eq("id", environmentId).maybeSingle(),
        supabase.from("profiles").select("*").eq("environment_id", environmentId),
        supabase.from("companies").select("*").eq("environment_id", environmentId),
        supabase.from("departments").select("*").eq("environment_id", environmentId),
        supabase.from("payroll_company_access").select("payroll_user_id, company_id").eq("environment_id", environmentId),
        supabase.from("national_holidays").select("*").eq("environment_id", environmentId).gte("holiday_date", range.start).lte("holiday_date", range.end),
        supabase.from("timesheet_entries").select("*").eq("environment_id", environmentId).gte("work_date", range.start).lte("work_date", range.end),
        supabase.from("leave_requests").select("*").eq("environment_id", environmentId).order("created_at", { ascending: false })
      ]);

      const results = [environmentResult, profilesResult, companiesResult, departmentsResult, accessResult, holidaysResult, entriesResult, leaveResult];
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;

      const nextWorkspace: Workspace = {
        ownerId: environmentResult.data?.owner_user_id || profile.id,
        profile,
        profiles: (profilesResult.data || []) as ProfileRow[],
        companies: (companiesResult.data || []) as CompanyRow[],
        departments: (departmentsResult.data || []) as DepartmentRow[],
        access: (accessResult.data || []) as PayrollAccessRow[],
        holidays: (holidaysResult.data || []) as HolidayRow[],
        entries: (entriesResult.data || []) as EntryRow[],
        leaveRequests: (leaveResult.data || []) as LeaveRequestRow[]
      };
      const companies = accessibleCompanies(nextWorkspace);
      setWorkspace(nextWorkspace);
      setActiveCompanyId((current) => companies.find((company) => company.id === current)?.id || companies[0]?.id || "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load TableShifts data.");
    } finally {
      setLoading(false);
    }
  }, [month, supabase]);

  React.useEffect(() => {
    if (!supabase) {
      setLoading(false);
      setMessage("Supabase configuration is missing for this deployment.");
      return;
    }
    let ignore = false;
    supabase.auth.getSession().then(({ data }) => {
      if (ignore) return;
      const user = data.session?.user || null;
      setAuthUser(user);
      if (user) void loadWorkspace(user);
      else setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null;
      setAuthUser(user);
      if (user) void loadWorkspace(user);
      else {
        setWorkspace(null);
        setLoading(false);
      }
    });
    return () => {
      ignore = true;
      listener.subscription.unsubscribe();
    };
  }, [loadWorkspace, supabase]);

  React.useEffect(() => {
    if (authUser) void loadWorkspace(authUser);
  }, [authUser, loadWorkspace]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setMessage("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }
    setAuthUser(data.user);
    if (data.user) await loadWorkspace(data.user);
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAuthUser(null);
    setWorkspace(null);
    setPassword("");
  }

  if (!authUser || !workspace) {
    return (
      <main className="flex min-h-screen items-center justify-center p-5">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Tableshifts</p>
            <CardTitle className="text-4xl font-black">Sign in</CardTitle>
            <CardDescription>Use your real TableShifts account from Supabase.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={signIn}>
              <label className="grid gap-1 text-sm font-semibold">
                Email
                <input className="h-11 rounded-md border border-stone-200 px-3" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Password
                <input className="h-11 rounded-md border border-stone-200 px-3" value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
              </label>
              {message ? <p className="rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-900">{message}</p> : null}
              <Button type="submit" disabled={loading}>{loading ? "Loading..." : "Enter"}</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    );
  }

  const companies = accessibleCompanies(workspace);
  const activeCompany = companies.find((company) => company.id === activeCompanyId) || companies[0];
  const setupAllowed = ["admin_account", "payroll_admin"].includes(workspace.profile.role);
  const visibleNav = nav.filter((item) => !item.setupOnly || setupAllowed);
  const companyDepartments = workspace.departments.filter((department) => department.company_id === activeCompany?.id);
  const companyTeamLeaders = workspace.profiles.filter((profile) => (
    profile.role === "team_leader" &&
    profile.company_id === activeCompany?.id &&
    (departmentFilter === "all" || profile.department_id === departmentFilter || companyDepartments.find((department) => department.id === departmentFilter)?.team_leader_user_id === profile.id)
  ));
  const employees = activeCompany ? filteredEmployees(workspace, activeCompany.id, departmentFilter, teamFilter) : [];
  const scopeTotals = employees.reduce(
    (acc, employee) => {
      const totals = totalsFor(employee, month, workspace);
      acc.worked += totals.worked;
      acc.expected += totals.expected;
      acc.overtime += totals.overtime;
      acc.co += totals.vacationDays;
      acc.cm += totals.medicalDays;
      acc.se += totals.specialEventDays;
      acc.ab += totals.absenceDays;
      return acc;
    },
    { worked: 0, expected: 0, overtime: 0, co: 0, cm: 0, se: 0, ab: 0 }
  );
  const scopeDifference = scopeTotals.worked - scopeTotals.expected;

  return (
    <main className="min-h-screen p-4 text-stone-950 md:p-6">
      <div className="grid min-h-[calc(100vh-48px)] grid-cols-1 gap-4 lg:grid-cols-[250px_1fr]">
        <aside className="rounded-lg border border-emerald-900/10 bg-emerald-950 p-4 text-white shadow-xl shadow-emerald-950/10">
          <div className="flex items-center gap-3 border-b border-white/10 pb-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-sm font-black text-emerald-900">TS</div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Tableshifts</p>
              <p className="text-sm text-emerald-50">Development</p>
            </div>
          </div>
          <nav className="mt-5 grid gap-1">
            {visibleNav.map((item) => (
              <button
                key={item.value}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold text-emerald-50/80 transition-colors hover:bg-white/10 hover:text-white",
                  activeTab === item.value && "bg-white text-emerald-950 hover:bg-white"
                )}
                onClick={() => setActiveTab(item.value)}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="overflow-hidden rounded-lg border border-stone-200 bg-white/72 shadow-xl shadow-stone-950/5 backdrop-blur">
          <header className="flex flex-col gap-4 border-b border-stone-200 bg-white p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="success">Real Supabase data</Badge>
                <Badge variant="outline">Development branch</Badge>
              </div>
              <h1 className="text-3xl font-black tracking-normal text-stone-950 md:text-4xl">{tabLabel(activeTab)}</h1>
              <select
                className="mt-2 rounded-md border border-stone-200 bg-white px-2 py-1 text-sm font-semibold text-stone-700"
                value={activeCompany?.id || ""}
                onChange={(event) => {
                  setActiveCompanyId(event.target.value);
                  setDepartmentFilter("all");
                  setTeamFilter("all");
                }}
              >
                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-right text-sm">
                <strong className="block">{workspace.profile.full_name}</strong>
                <span className="text-stone-500">{workspace.profile.position || ROLES[workspace.profile.role]} - {workspace.profile.email}</span>
              </div>
              <Button variant="outline" onClick={signOut}><LogOut className="h-4 w-4" />Logout</Button>
            </div>
          </header>

          <div className="p-5">
              <div className="mb-5 flex flex-wrap items-center justify-end gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <select className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm font-semibold" value={month} onChange={(event) => setMonth(event.target.value)}>
                    {monthOptions(month).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <Button variant="outline" onClick={() => exportCsv(activeCompany?.name || "TableShifts", month, employees, workspace)}>
                    <Download className="h-4 w-4" /> Export CSV
                  </Button>
                </div>
              </div>

              {message ? <p className="mb-4 rounded-md bg-amber-50 p-3 text-sm font-semibold text-amber-900">{message}</p> : null}

              {activeTab === "timesheet" ? (
                <>
                <div className="mb-4 grid gap-3 rounded-lg border border-stone-200 bg-white p-3 lg:grid-cols-[1fr_1fr_auto]">
                  <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-stone-500">
                    Department
                    <select className="h-9 rounded-md border border-stone-200 bg-white px-2 text-sm font-semibold normal-case tracking-normal text-stone-900" value={departmentFilter} onChange={(event) => {
                      setDepartmentFilter(event.target.value);
                      setTeamFilter("all");
                    }}>
                      <option value="all">All departments</option>
                      {companyDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-stone-500">
                    Team Leader
                    <select className="h-9 rounded-md border border-stone-200 bg-white px-2 text-sm font-semibold normal-case tracking-normal text-stone-900" value={teamFilter} onChange={(event) => {
                      const leader = workspace.profiles.find((profile) => profile.id === event.target.value);
                      setTeamFilter(event.target.value);
                      if (leader?.department_id) setDepartmentFilter(leader.department_id);
                    }}>
                      <option value="all">All team leaders</option>
                      {companyTeamLeaders.map((leader) => <option key={leader.id} value={leader.id}>{leader.full_name}</option>)}
                    </select>
                  </label>
                  <div className="flex items-end">
                    <Button variant="outline" className="w-full lg:w-auto" onClick={() => {
                      setDepartmentFilter("all");
                      setTeamFilter("all");
                    }}>
                      <SlidersHorizontal className="h-4 w-4" /> Reset filters
                    </Button>
                  </div>
                </div>
                <TimesheetTable
                  month={month}
                  workspace={workspace}
                  employees={employees}
                  totalsExpanded={totalsExpanded}
                  onToggleTotals={() => setTotalsExpanded((value) => !value)}
                  onEdit={(employee, iso) => setEditor({ employee, iso })}
                  onFill={(employee) => void fillNormalTime(employee)}
                  onClear={(employee) => void clearEmployeeMonth(employee)}
                />
                </>
              ) : null}

              {activeTab === "leave" ? (
                <LeaveRequests
                  workspace={workspace}
                  activeCompany={activeCompany}
                  supabase={supabase}
                  onReload={() => authUser && loadWorkspace(authUser)}
                  onMessage={setMessage}
                />
              ) : null}

              {activeTab === "charts" ? (
                <Charts
                  workspace={workspace}
                  activeCompany={activeCompany}
                  employees={employees}
                  month={month}
                  people={employees.length}
                  worked={scopeTotals.worked}
                  expected={scopeTotals.expected}
                  overtime={scopeTotals.overtime}
                  co={scopeTotals.co}
                  cm={scopeTotals.cm}
                  se={scopeTotals.se}
                  ab={scopeTotals.ab}
                  difference={scopeDifference}
                />
              ) : null}

              {["companies", "employees", "admins", "settings"].includes(activeTab) ? (
                <Management
                  workspace={workspace}
                  activeTab={activeTab}
                  supabase={supabase}
                  onReload={() => authUser && loadWorkspace(authUser)}
                  onMessage={setMessage}
                />
              ) : null}
          </div>
        </section>
      </div>
      {editor ? (
        <EntryEditor
          editor={editor}
          workspace={workspace}
          month={month}
          supabase={supabase}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            if (authUser) void loadWorkspace(authUser);
          }}
          onMessage={setMessage}
        />
      ) : null}
    </main>
  );

  async function fillNormalTime(employee: ProfileRow) {
    const currentWorkspace = workspace;
    if (!supabase || !activeCompany || !currentWorkspace?.profile.environment_id) return;
    const normal = normalHours(employee, currentWorkspace);
    const rows = daysInMonth(month)
      .filter((day) => isExpectedWorkDay(employee, day.iso, day.weekdayIndex, currentWorkspace))
      .filter((day) => !entryFor(currentWorkspace.entries, employee.id, day.iso))
      .map((day) => ({
        environment_id: currentWorkspace.profile.environment_id,
        company_id: activeCompany.id,
        employee_user_id: employee.id,
        department_id: employee.department_id,
        work_date: day.iso,
        type: "normal",
        hours: normal,
        created_by: currentWorkspace.profile.id,
        updated_by: currentWorkspace.profile.id
      }));
    if (!rows.length) return;
    const { error } = await supabase.from("timesheet_entries").upsert(rows, { onConflict: "employee_user_id,work_date" });
    if (error) {
      setMessage(error.message);
      return;
    }
    if (authUser) await loadWorkspace(authUser);
  }

  async function clearEmployeeMonth(employee: ProfileRow) {
    if (!supabase) return;
    const confirmed = window.confirm(`Clear all entries for ${employee.full_name} in ${month}?`);
    if (!confirmed) return;
    const range = monthRange(month);
    const { error } = await supabase
      .from("timesheet_entries")
      .delete()
      .eq("employee_user_id", employee.id)
      .gte("work_date", range.start)
      .lte("work_date", range.end);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (authUser) await loadWorkspace(authUser);
  }
}

async function waitForProfile(supabase: SupabaseClient, userId: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (data) return data as ProfileRow;
    if (error && error.code !== "PGRST116") throw error;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return null;
}

function SummaryCard({ label, value, hint, accent }: { label: string; value: string; hint: string; accent?: "good" | "bad" }) {
  return (
    <Card>
      <CardHeader className="p-4">
        <CardDescription className="font-bold uppercase tracking-wide">{label}</CardDescription>
        <CardTitle className={cn("text-2xl", accent === "good" && "text-emerald-700", accent === "bad" && "text-rose-700")}>{value}</CardTitle>
        <p className="text-xs text-stone-500">{hint}</p>
      </CardHeader>
    </Card>
  );
}

function TimesheetTable({
  month,
  workspace,
  employees,
  totalsExpanded,
  onToggleTotals,
  onEdit,
  onFill,
  onClear
}: {
  month: string;
  workspace: Workspace;
  employees: ProfileRow[];
  totalsExpanded: boolean;
  onToggleTotals: () => void;
  onEdit: (employee: ProfileRow, iso: string) => void;
  onFill: (employee: ProfileRow) => void;
  onClear: (employee: ProfileRow) => void;
}) {
  const days = daysInMonth(month);
  const compactColumns = ["Worked", "More"];
  const expandedColumns = ["Worked", "Norm", "Diff", "OT", "CO", "CM", "SE", "AB", "CO Left", "More", "Fill", "Clear"];
  const totalsColumns = totalsExpanded ? expandedColumns : compactColumns;
  const fixedCompactWidth = 176 + totalsColumns.length * 68;
  const expandedMinWidth = 188 + days.length * 38 + totalsColumns.length * 74;
  return (
    <Card className="overflow-hidden">
      <div className={cn(totalsExpanded ? "overflow-x-auto" : "overflow-hidden")}>
        <table
          className={cn("w-full table-fixed border-collapse text-xs", totalsExpanded && "min-w-max")}
          style={totalsExpanded ? { minWidth: `${expandedMinWidth}px` } : undefined}
        >
          <colgroup>
            <col style={{ width: totalsExpanded ? "188px" : "176px" }} />
            {days.map((day) => (
              <col
                key={day.iso}
                style={totalsExpanded ? { width: "38px" } : { width: `calc((100% - ${fixedCompactWidth}px) / ${days.length})` }}
              />
            ))}
            {totalsColumns.map((label) => (
              <col key={label} style={{ width: totalsExpanded ? "74px" : "68px" }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className="sticky left-0 z-10 bg-stone-50 px-3 py-2 text-left font-black">Employee</th>
              {days.map((day) => (
                <th key={day.iso} className="border-l border-stone-200 px-0.5 py-1.5 text-center">
                  <span className="block text-sm font-black leading-tight">{day.day}</span>
                  <span className="text-[10px] font-bold leading-tight text-stone-500">{day.weekday.slice(0, 3)}</span>
                </th>
              ))}
              {totalsColumns.map((label) => (
                <th key={label} className="border-l border-stone-200 px-1 py-2 text-center font-black">
                  {label === "More" && totalsExpanded ? "Less" : label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.length ? employees.map((employee) => {
              const totals = totalsFor(employee, month, workspace);
              return (
                <tr key={employee.id} className="border-b border-stone-200 hover:bg-stone-50/60">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2">
                    <strong className="block truncate text-sm">{employee.full_name}</strong>
                    <span className="block truncate text-[11px] font-semibold text-stone-500">{employee.position || ROLES[employee.role]}</span>
                  </td>
                  {days.map((day) => <EntryCell key={day.iso} employee={employee} day={day} workspace={workspace} onEdit={onEdit} />)}
                  <td className="border-l border-stone-200 px-1 text-center font-black">{formatNumber(totals.worked)}h</td>
                  {totalsExpanded ? (
                    <>
                      <td className="border-l border-stone-200 px-1 text-center font-black">{formatNumber(totals.expected)}h</td>
                      <td className={cn("border-l border-stone-200 px-1 text-center font-black", totals.difference < 0 ? "text-rose-700" : "text-emerald-700")}>
                        {totals.difference > 0 ? "+" : ""}{formatNumber(totals.difference)}h
                      </td>
                      <td className="border-l border-stone-200 px-1 text-center font-black">{formatNumber(totals.overtime)}h</td>
                      <td className="border-l border-stone-200 px-1 text-center font-black">{totals.vacationDays}d</td>
                      <td className="border-l border-stone-200 px-1 text-center font-black">{totals.medicalDays}d</td>
                      <td className="border-l border-stone-200 px-1 text-center font-black">{totals.specialEventDays}d</td>
                      <td className="border-l border-stone-200 px-1 text-center font-black">{totals.absenceDays}d</td>
                      <td className="border-l border-stone-200 px-1 text-center font-black">{formatNumber(Math.max(0, Number(employee.co_available || 0) - totals.vacationDays))}d</td>
                    </>
                  ) : null}
                  <td className="border-l border-stone-200 px-1 text-center">
                    <Button size="sm" variant="secondary" onClick={onToggleTotals}>{totalsExpanded ? "Less" : "More"}</Button>
                  </td>
                  {totalsExpanded ? (
                    <>
                      <td className="border-l border-stone-200 px-2 text-center">
                        <Button size="sm" onClick={() => onFill(employee)} disabled={!canEditEmployee(workspace.profile, employee, workspace)}>Fill</Button>
                      </td>
                      <td className="border-l border-stone-200 px-2 text-center">
                        <Button size="sm" variant="outline" onClick={() => onClear(employee)} disabled={!canEditEmployee(workspace.profile, employee, workspace)}>Clear</Button>
                      </td>
                    </>
                  ) : null}
                </tr>
              );
            }) : (
              <tr>
                <td className="px-4 py-8 text-sm font-semibold text-stone-500" colSpan={days.length + 8}>No employees visible for this account and company.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function EntryCell({
  employee,
  day,
  workspace,
  onEdit
}: {
  employee: ProfileRow;
  day: ReturnType<typeof daysInMonth>[number];
  workspace: Workspace;
  onEdit: (employee: ProfileRow, iso: string) => void;
}) {
  const entry = entryFor(workspace.entries, employee.id, day.iso);
  const holiday = holidayForEmployee(employee, day.iso, workspace);
  const expected = isExpectedWorkDay(employee, day.iso, day.weekdayIndex, workspace);
  const normal = normalHours(employee, workspace);
  const code = entry ? ENTRY_LABELS[entry.type] || entry.type : holiday ? "H" : "";
  const detail = entry ? entryDetail(entry, normal) : "";
  const tooltip = entry ? entryTooltip(entry, normal) : holiday?.name || (expected ? "Expected working day" : "Non-working day");
  const editable = canEditEmployee(workspace.profile, employee, workspace);
  const company = workspace.companies.find((item) => item.id === employee.company_id);
  const customColor = entry?.type ? entryColor(company, entry.type) : null;
  return (
    <td
      title={tooltip}
      className={cn("border-l border-stone-200 p-0 text-center", cellClass(entry?.type, Boolean(holiday), expected, Boolean(customColor)))}
      style={customColor ? { backgroundColor: customColor } : undefined}
    >
      <button
        type="button"
        className={cn("min-h-10 w-full px-0.5 py-1.5 text-center leading-tight", editable ? "cursor-pointer hover:ring-2 hover:ring-inset hover:ring-emerald-500" : "cursor-default")}
        onClick={() => editable && onEdit(employee, day.iso)}
        disabled={!editable}
      >
      <span className="block text-[11px] font-black">{code}</span>
      <span className="text-[10px] text-stone-500">{detail}</span>
      </button>
    </td>
  );
}

function EntryEditor({
  editor,
  workspace,
  month,
  supabase,
  onClose,
  onSaved,
  onMessage
}: {
  editor: { employee: ProfileRow; iso: string };
  workspace: Workspace;
  month: string;
  supabase: SupabaseClient | null;
  onClose: () => void;
  onSaved: () => void;
  onMessage: (message: string) => void;
}) {
  const existing = entryFor(workspace.entries, editor.employee.id, editor.iso);
  const department = departmentFor(editor.employee, workspace);
  const normal = normalHours(editor.employee, workspace);
  const [type, setType] = React.useState(existing?.type || "normal");
  const [hours, setHours] = React.useState(String(existing?.hours ?? normal));
  const [file, setFile] = React.useState<File | null>(null);
  const [previewHtml, setPreviewHtml] = React.useState<string | null>(null);
  const extra = Math.max(0, Number(hours || 0) - normal);
  const leaveLike = ["vacation", "medical", "special_event"].includes(type);
  const linkedRequest = existing?.leave_request_id
    ? workspace.leaveRequests.find((request) => request.id === existing.leave_request_id)
    : null;
  const linkedDocument = linkedRequest?.generated_document_html || "";
  const attachmentPath = existing?.attachment_path || linkedRequest?.attachment_path || "";

  function quick(nextType: string) {
    setType(nextType);
    if (nextType === "normal" || nextType === "weekend") setHours(String(normal));
    if (nextType === "overtime") setHours(String(normal + 2));
    if (["vacation", "medical", "special_event", "absence"].includes(nextType)) setHours("0");
  }

  async function save() {
    if (!supabase || !workspace.profile.environment_id || !editor.employee.company_id) return;
    let nextHours = Number(hours || 0);
    if (!Number.isFinite(nextHours)) nextHours = 0;
    if (type === "overtime" && nextHours < normal) nextHours = normal;
    const entryId = existing?.id || crypto.randomUUID();
    let uploadedPath = existing?.attachment_path || null;
    try {
      uploadedPath = leaveLike && file
        ? await uploadLeaveDocument(supabase, workspace, entryId, file)
        : uploadedPath;
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not upload leave document.");
      return;
    }
    const { error } = await supabase.from("timesheet_entries").upsert({
      id: entryId,
      environment_id: workspace.profile.environment_id,
      company_id: editor.employee.company_id,
      employee_user_id: editor.employee.id,
      department_id: editor.employee.department_id,
      work_date: editor.iso,
      type,
      hours: nextHours,
      attachment_path: leaveLike ? uploadedPath : null,
      updated_by: workspace.profile.id,
      created_by: workspace.profile.id
    }, { onConflict: "employee_user_id,work_date" });
    if (error) {
      onMessage(error.message);
      return;
    }
    onSaved();
  }

  async function removeAttachment() {
    if (!supabase || !existing?.id || !existing.attachment_path) return;
    await supabase.storage.from("leave-documents").remove([existing.attachment_path]);
    const { error } = await supabase.from("timesheet_entries").update({ attachment_path: null }).eq("id", existing.id);
    if (error) {
      onMessage(error.message);
      return;
    }
    onSaved();
  }

  async function clear() {
    if (!supabase) return;
    const { error } = await supabase
      .from("timesheet_entries")
      .delete()
      .eq("employee_user_id", editor.employee.id)
      .eq("work_date", editor.iso);
    if (error) {
      onMessage(error.message);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="border-b border-stone-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>{editor.employee.full_name}</CardTitle>
              <CardDescription>{editor.iso} - {department?.name || "No department"} - normal shift {formatNumber(normal)}h</CardDescription>
            </div>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 pt-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["normal", "Normal"],
              ["overtime", "OT"],
              ["vacation", "CO"],
              ["medical", "CM"],
              ["special_event", "SE"],
              ["absence", "Absence"],
              ["weekend", "Weekend"]
            ].map(([value, label]) => (
              <Button key={value} variant={type === value ? "default" : "outline"} onClick={() => quick(value)}>{label}</Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm font-semibold">
              Type
              <select className="h-11 rounded-md border border-stone-200 bg-white px-3" value={type} onChange={(event) => quick(event.target.value)}>
                <option value="normal">Normal</option>
                <option value="overtime">Overtime</option>
                <option value="vacation">Vacation CO</option>
                <option value="medical">Medical CM</option>
                <option value="special_event">Special Event</option>
                <option value="absence">Absence</option>
                <option value="weekend">Weekend</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Total hours
              <input className="h-11 rounded-md border border-stone-200 px-3" value={hours} onChange={(event) => setHours(event.target.value)} type="number" min="0" max="24" step="0.25" />
            </label>
          </div>
          <p className="rounded-md bg-stone-50 p-3 text-sm font-semibold text-stone-600">
            {type === "overtime"
              ? `This records ${formatNumber(normal)}h normal time and ${formatNumber(extra)}h overtime.`
              : "Holiday entries stay controlled from setup; this popup records employee day activity."}
          </p>
          {leaveLike ? (
            <div className="grid gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3">
              <p className="text-xs font-black uppercase tracking-wide text-stone-500">Leave document</p>
              <input className="rounded-md border border-stone-200 bg-white p-2 text-sm font-semibold" type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
              <div className="flex flex-wrap gap-2">
                {attachmentPath ? <Button size="sm" variant="outline" onClick={() => void downloadStorageFile(supabase, "leave-documents", attachmentPath)}>Download attached file</Button> : null}
                {existing?.attachment_path ? <Button size="sm" variant="outline" onClick={() => void removeAttachment()}><X className="h-4 w-4" />Remove file</Button> : null}
                {linkedDocument ? <Button size="sm" variant="outline" onClick={() => setPreviewHtml(linkedDocument)}><FileText className="h-4 w-4" />Preview request</Button> : null}
                {linkedDocument ? <Button size="sm" variant="outline" onClick={() => downloadHtml(linkedDocument, `${editor.employee.full_name}-${editor.iso}-leave.html`)}>Download request</Button> : null}
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="outline" onClick={clear}><Eraser className="h-4 w-4" />Clear entry</Button>
            <Button onClick={save}><Paintbrush className="h-4 w-4" />Save entry</Button>
          </div>
        </CardContent>
      </Card>
      {previewHtml ? <DocumentPreview html={previewHtml} onClose={() => setPreviewHtml(null)} /> : null}
    </div>
  );
}

function entryDetail(entry: EntryRow, normal: number) {
  const hours = Number(entry.hours || 0);
  if (entry.type === "overtime") return `${formatNumber(normal)}h+${formatNumber(Math.max(0, hours - normal))}h`;
  if (["vacation", "medical", "special_event"].includes(entry.type)) return "day";
  if (entry.type === "absence") return "";
  return hours ? `${formatNumber(hours)}h` : "";
}

function entryTooltip(entry: EntryRow, normal: number) {
  const hours = Number(entry.hours || 0);
  if (entry.type === "overtime") return `Overtime of ${formatNumber(Math.max(0, hours - normal))}h over normal shift of ${formatNumber(normal)}h`;
  if (entry.type === "vacation") return "Vacation day";
  if (entry.type === "medical") return "Medical leave day";
  if (entry.type === "special_event") return "Special event day";
  if (entry.type === "absence") return "Absence";
  return `${entry.type} ${formatNumber(hours)}h`;
}

function cellClass(type: string | undefined, holiday: boolean, expected: boolean, hasCustomColor = false) {
  if (hasCustomColor) return "text-stone-950";
  if (type === "vacation") return "bg-emerald-100 text-emerald-900";
  if (type === "medical") return "bg-rose-100 text-rose-900";
  if (type === "absence") return "bg-stone-900 text-white";
  if (type === "overtime") return "bg-amber-100 text-amber-950";
  if (type === "special_event") return "bg-stone-200 text-stone-800";
  if (holiday) return "bg-yellow-50 text-yellow-900";
  if (!expected) return "bg-sky-50";
  return "bg-white";
}

function entryColor(company: CompanyRow | undefined, type: string) {
  const colors = company?.entry_colors;
  if (!colors || typeof colors !== "object") return null;
  const value = colors[type];
  return typeof value === "string" && value.trim() ? value : null;
}

function LeaveRequests({
  workspace,
  activeCompany,
  supabase,
  onReload,
  onMessage
}: {
  workspace: Workspace;
  activeCompany?: CompanyRow;
  supabase: SupabaseClient | null;
  onReload: () => void;
  onMessage: (message: string) => void;
}) {
  const [type, setType] = React.useState("vacation");
  const [startDate, setStartDate] = React.useState(currentMonth() + "-01");
  const [endDate, setEndDate] = React.useState(currentMonth() + "-01");
  const [notes, setNotes] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [previewHtml, setPreviewHtml] = React.useState<string | null>(null);
  const requests = visibleLeaveRequests(workspace, activeCompany?.id || "");
  const canCreate = canCreateLeaveRequest(workspace.profile);
  const visibleEmployeeIds = new Set(filteredEmployees(workspace, activeCompany?.id || "", "all", "all").map((employee) => employee.id));
  const recordedEntries = workspace.entries
    .filter((entry) => entry.company_id === activeCompany?.id && ["vacation", "medical", "special_event"].includes(entry.type) && !entry.leave_request_id && visibleEmployeeIds.has(entry.employee_user_id))
    .toSorted((a, b) => b.work_date.localeCompare(a.work_date));

  async function submitRequest() {
    if (!supabase || !workspace.profile.environment_id || !activeCompany || !canCreate) return;
    const requestId = crypto.randomUUID();
    const documentHtml = generatedLeaveDocumentHtml(
      { type, start_date: startDate, end_date: endDate, notes, status: "requested", decided_at: null },
      workspace.profile,
      activeCompany
    );
    let attachmentPath: string | null = null;
    try {
      attachmentPath = file ? await uploadLeaveDocument(supabase, workspace, requestId, file) : null;
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not upload leave document.");
      return;
    }
    const { error } = await supabase.from("leave_requests").insert({
      id: requestId,
      environment_id: workspace.profile.environment_id,
      company_id: activeCompany.id,
      employee_user_id: workspace.profile.id,
      type,
      start_date: startDate,
      end_date: endDate,
      notes: notes || null,
      status: "requested",
      attachment_path: attachmentPath,
      generated_document_html: documentHtml
    });
    if (error) {
      onMessage(error.message);
      return;
    }
    setNotes("");
    setFile(null);
    setPreviewHtml(null);
    onReload();
  }

  async function decide(request: LeaveRequestRow, status: "approved" | "rejected") {
    if (!supabase) return;
    const employee = workspace.profiles.find((profile) => profile.id === request.employee_user_id);
    if (!canApproveLeave(workspace.profile, employee, workspace)) return;
    const documentHtml = employee
      ? generatedLeaveDocumentHtml({ ...request, status, decided_at: new Date().toISOString() }, employee, activeCompany, workspace.profile)
      : request.generated_document_html;
    const { error } = await supabase
      .from("leave_requests")
      .update({
        status,
        decided_by: workspace.profile.id,
        decided_at: new Date().toISOString(),
        generated_document_html: documentHtml
      })
      .eq("id", request.id);
    if (error) {
      onMessage(error.message);
      return;
    }
    if (status === "approved" && employee && activeCompany && workspace.profile.environment_id) {
      const rows = datesBetween(request.start_date, request.end_date)
        .filter((day) => isExpectedWorkDay(employee, day.iso, day.weekdayIndex, workspace))
        .map((day) => ({
          environment_id: workspace.profile.environment_id,
          company_id: activeCompany.id,
          employee_user_id: employee.id,
          department_id: employee.department_id,
          work_date: day.iso,
          type: request.type,
          hours: 0,
          leave_request_id: request.id,
          attachment_path: request.attachment_path,
          created_by: workspace.profile.id,
          updated_by: workspace.profile.id
        }));
      if (rows.length) {
        const { error: entryError } = await supabase.from("timesheet_entries").upsert(rows, { onConflict: "employee_user_id,work_date" });
        if (entryError) {
          onMessage(entryError.message);
          return;
        }
      }
    }
    onReload();
  }

  return (
    <div className="grid gap-4">
      {canCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>New Leave Request</CardTitle>
            <CardDescription>Request CO, CM, or Special Event days. Generated documents can be previewed before submit.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-[170px_1fr_1fr_1.3fr_1.2fr_auto_auto]">
            <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-stone-500">
              Type
              <select className="h-10 rounded-md border border-stone-200 bg-white px-2 text-sm font-semibold normal-case tracking-normal text-stone-900" value={type} onChange={(event) => setType(event.target.value)}>
                <option value="vacation">Vacation CO</option>
                <option value="medical">Medical CM</option>
                <option value="special_event">Special Events</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-stone-500">
              Start
              <input className="h-10 rounded-md border border-stone-200 px-2 text-sm font-semibold normal-case tracking-normal text-stone-900" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-stone-500">
              End
              <input className="h-10 rounded-md border border-stone-200 px-2 text-sm font-semibold normal-case tracking-normal text-stone-900" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-stone-500">
              Notes
              <input className="h-10 rounded-md border border-stone-200 px-2 text-sm font-semibold normal-case tracking-normal text-stone-900" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional reason" />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-stone-500">
              Document
              <input className="h-10 rounded-md border border-stone-200 bg-white px-2 py-1 text-sm font-semibold normal-case tracking-normal text-stone-900" type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </label>
            <div className="flex items-end">
              <Button variant="outline" onClick={() => setPreviewHtml(generatedLeaveDocumentHtml({ type, start_date: startDate, end_date: endDate, notes, status: "requested", decided_at: null }, workspace.profile, activeCompany))}>
                <Eye className="h-4 w-4" /> Preview
              </Button>
            </div>
            <div className="flex items-end">
              <Button onClick={submitRequest}>Submit</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
          <CardDescription>One row per request, with approval and document actions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {requests.length ? requests.map((request) => {
            const employee = workspace.profiles.find((profile) => profile.id === request.employee_user_id);
            const canDecide = request.status === "requested" && canApproveLeave(workspace.profile, employee, workspace);
            const documentHtml = request.generated_document_html || (employee ? generatedLeaveDocumentHtml(request, employee, activeCompany) : "");
            return (
              <div key={request.id} className="grid gap-3 rounded-lg border border-stone-200 p-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                <div>
                  <strong>{employee?.full_name || "Employee"}</strong>
                  <p className="text-sm text-stone-500">{request.start_date} to {request.end_date} - {ENTRY_LABELS[request.type] || request.type}{request.notes ? ` - ${request.notes}` : ""}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={request.status === "approved" ? "success" : request.status === "requested" ? "warning" : "secondary"}>{request.status}</Badge>
                  {request.attachment_path ? <Button size="sm" variant="outline" onClick={() => void downloadStorageFile(supabase, "leave-documents", request.attachment_path || "")}><Download className="h-4 w-4" />File</Button> : null}
                  {documentHtml ? <Button size="sm" variant="outline" onClick={() => setPreviewHtml(documentHtml)}>Preview document</Button> : null}
                  {documentHtml ? <Button size="sm" variant="outline" onClick={() => downloadHtml(documentHtml, `${employee?.full_name || "leave"}-${request.start_date}.html`)}>Download</Button> : null}
                </div>
                {canDecide ? (
                  <div className="flex gap-2 lg:justify-end">
                    <Button size="sm" onClick={() => void decide(request, "approved")}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => void decide(request, "rejected")}>Deny</Button>
                  </div>
                ) : null}
              </div>
            );
          }) : null}
          {recordedEntries.map((entry) => {
            const employee = workspace.profiles.find((profile) => profile.id === entry.employee_user_id);
            return (
              <div key={entry.id} className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <strong>{employee?.full_name || "Employee"}</strong>
                  <p className="text-sm text-stone-500">{entry.work_date} - {ENTRY_LABELS[entry.type] || entry.type} recorded in Timesheet</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Badge variant="secondary">Recorded</Badge>
                  {entry.attachment_path ? <Button size="sm" variant="outline" onClick={() => void downloadStorageFile(supabase, "leave-documents", entry.attachment_path || "")}><Download className="h-4 w-4" />File</Button> : null}
                </div>
              </div>
            );
          })}
          {!requests.length && !recordedEntries.length ? <p className="text-sm font-semibold text-stone-500">No leave requests found.</p> : null}
        </CardContent>
      </Card>

      {previewHtml ? <DocumentPreview html={previewHtml} onClose={() => setPreviewHtml(null)} /> : null}
    </div>
  );
}

function Charts({
  workspace,
  activeCompany,
  employees,
  month,
  people,
  worked,
  expected,
  overtime,
  co,
  cm,
  se,
  ab,
  difference
}: {
  workspace: Workspace;
  activeCompany?: CompanyRow;
  employees: ProfileRow[];
  month: string;
  people: number;
  worked: number;
  expected: number;
  overtime: number;
  co: number;
  cm: number;
  se: number;
  ab: number;
  difference: number;
}) {
  const width = expected ? Math.min(100, Math.round((worked / expected) * 100)) : 0;
  const departmentRows = workspace.departments
    .filter((department) => department.company_id === activeCompany?.id)
    .map((department) => {
      const departmentEmployees = employees.filter((employee) => employee.department_id === department.id);
      const totals = departmentEmployees.reduce((acc, employee) => {
        const row = totalsFor(employee, month, workspace);
        acc.worked += row.worked;
        acc.expected += row.expected;
        acc.overtime += row.overtime;
        acc.leave += row.vacationDays + row.medicalDays + row.specialEventDays;
        acc.absence += row.absenceDays;
        return acc;
      }, { worked: 0, expected: 0, overtime: 0, leave: 0, absence: 0 });
      return { department, employees: departmentEmployees.length, ...totals };
    })
    .filter((row) => row.employees > 0);
  const maxDepartmentHours = Math.max(1, ...departmentRows.map((row) => Math.max(row.worked, row.expected)));
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-5">
        <SummaryCard label="People" value={String(people)} hint="visible scope" />
        <SummaryCard label="Worked" value={`${formatNumber(worked)}h`} hint="month total" />
        <SummaryCard label="Overtime" value={`${formatNumber(overtime)}h`} hint="recorded" />
        <SummaryCard label="Leave" value={`${co} CO / ${cm} CM`} hint={`${se} SE / ${ab} AB`} />
        <SummaryCard label="Diff" value={`${difference > 0 ? "+" : ""}${formatNumber(difference)}h`} hint="worked vs norm" accent={difference < 0 ? "bad" : "good"} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Scope fulfilment</CardTitle>
              <CardDescription>Worked hours against monthly norm.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-3 rounded-full bg-stone-100"><div className="h-3 rounded-full bg-emerald-700" style={{ width: `${width}%` }} /></div>
              <p className="mt-3 text-sm font-semibold">{formatNumber(worked)}h worked from {formatNumber(expected)}h expected</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Leave mix</CardTitle>
              <CardDescription>CO, CM and special events in the selected month.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {[["CO", co, "bg-emerald-500"], ["CM", cm, "bg-rose-400"], ["SE", se, "bg-stone-400"], ["AB", ab, "bg-stone-900"]].map(([label, value, color]) => (
                <div key={label as string} className="grid grid-cols-[40px_1fr_44px] items-center gap-3 text-sm font-semibold">
                  <span>{label}</span>
                  <div className="h-2 rounded-full bg-stone-100"><div className={cn("h-2 rounded-full", color as string)} style={{ width: `${Math.min(100, Number(value) * 12)}%` }} /></div>
                  <span>{value}d</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Departments</CardTitle>
            <CardDescription>Worked versus norm by department.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {departmentRows.length ? departmentRows.map((row) => (
              <div key={row.department.id} className="grid gap-1">
                <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                  <span>{row.department.name}</span>
                  <span className={cn(row.worked - row.expected < 0 ? "text-rose-700" : "text-emerald-700")}>{row.worked - row.expected > 0 ? "+" : ""}{formatNumber(row.worked - row.expected)}h</span>
                </div>
                <div className="grid gap-1">
                  <div className="h-2 rounded-full bg-stone-100">
                    <div className="h-2 rounded-full bg-emerald-700" style={{ width: `${Math.min(100, (row.worked / maxDepartmentHours) * 100)}%` }} />
                  </div>
                  <div className="h-2 rounded-full bg-stone-100">
                    <div className="h-2 rounded-full bg-stone-400" style={{ width: `${Math.min(100, (row.expected / maxDepartmentHours) * 100)}%` }} />
                  </div>
                </div>
                <p className="text-xs font-semibold text-stone-500">{row.employees} people - {formatNumber(row.worked)}h worked / {formatNumber(row.expected)}h norm - {formatNumber(row.overtime)}h OT - {row.leave} leave days - {row.absence} absences</p>
              </div>
            )) : <p className="text-sm font-semibold text-stone-500">No department data in this scope.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Management({
  workspace,
  activeTab,
  supabase,
  onReload,
  onMessage
}: {
  workspace: Workspace;
  activeTab: string;
  supabase: SupabaseClient | null;
  onReload: () => void;
  onMessage: (message: string) => void;
}) {
  if (activeTab === "companies") {
    return <CompanyDepartmentManagement workspace={workspace} supabase={supabase} onReload={onReload} onMessage={onMessage} />;
  }
  if (activeTab === "employees") {
    return <AccountManagement mode="employees" workspace={workspace} supabase={supabase} onReload={onReload} onMessage={onMessage} />;
  }
  if (activeTab === "admins") {
    return <AccountManagement mode="admins" workspace={workspace} supabase={supabase} onReload={onReload} onMessage={onMessage} />;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>National holidays, company colors, logos, and account danger areas will move here next.</CardDescription>
      </CardHeader>
    </Card>
  );
}

function CompanyDepartmentManagement({
  workspace,
  supabase,
  onReload,
  onMessage
}: {
  workspace: Workspace;
  supabase: SupabaseClient | null;
  onReload: () => void;
  onMessage: (message: string) => void;
}) {
  const [companyName, setCompanyName] = React.useState("");
  const [departmentCompanyId, setDepartmentCompanyId] = React.useState(workspace.companies[0]?.id || "");
  const [departmentName, setDepartmentName] = React.useState("");
  const [shiftHours, setShiftHours] = React.useState("8");
  const [managerId, setManagerId] = React.useState("");
  const [teamLeaderId, setTeamLeaderId] = React.useState("");
  const targetCompanyId = departmentCompanyId || workspace.companies[0]?.id || "";
  const companyManagers = workspace.profiles.filter((profile) => (
    ["department_manager", "company_manager"].includes(profile.role) &&
    (profile.company_id === targetCompanyId || profile.role === "company_manager")
  ));
  const teamLeaders = workspace.profiles.filter((profile) => (
    profile.role === "team_leader" &&
    profile.company_id === targetCompanyId
  ));

  async function createCompany() {
    if (!supabase || !workspace.profile.environment_id || !companyName.trim()) return;
    const { error } = await supabase.from("companies").insert({
      environment_id: workspace.profile.environment_id,
      name: companyName.trim(),
      created_by: workspace.profile.id
    });
    if (error) {
      onMessage(error.message);
      return;
    }
    setCompanyName("");
    onReload();
  }

  async function createDepartment() {
    if (!supabase || !workspace.profile.environment_id || !targetCompanyId || !departmentName.trim()) return;
    const { error } = await supabase.from("departments").insert({
      environment_id: workspace.profile.environment_id,
      company_id: targetCompanyId,
      name: departmentName.trim(),
      manager_user_id: managerId || null,
      team_leader_user_id: teamLeaderId || null,
      shift_hours: Number(shiftHours || 8),
      work_days: [1, 2, 3, 4, 5]
    });
    if (error) {
      onMessage(error.message);
      return;
    }
    setDepartmentName("");
    setManagerId("");
    setTeamLeaderId("");
    onReload();
  }

  async function deleteCompany(company: CompanyRow) {
    if (!supabase) return;
    const hasDepartments = workspace.departments.some((department) => department.company_id === company.id);
    const hasUsers = workspace.profiles.some((profile) => profile.company_id === company.id);
    if (hasDepartments || hasUsers) {
      onMessage(`Delete or move ${company.name}'s departments and users before deleting the company.`);
      return;
    }
    if (!window.confirm(`Delete company ${company.name}?`)) return;
    const { error } = await supabase.from("companies").delete().eq("id", company.id);
    if (error) {
      onMessage(error.message);
      return;
    }
    onReload();
  }

  async function deleteDepartment(department: DepartmentRow) {
    if (!supabase) return;
    const hasUsers = workspace.profiles.some((profile) => profile.department_id === department.id);
    if (hasUsers) {
      onMessage(`Move or delete employees from ${department.name} before deleting the department.`);
      return;
    }
    if (!window.confirm(`Delete department ${department.name}?`)) return;
    const { error } = await supabase.from("departments").delete().eq("id", department.id);
    if (error) {
      onMessage(error.message);
      return;
    }
    onReload();
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Create Company</CardTitle>
            <CardDescription>Companies belong to this admin environment.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <input className="h-10 flex-1 rounded-md border border-stone-200 px-3 text-sm font-semibold" value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Company name" />
            <Button onClick={createCompany}><Plus className="h-4 w-4" />Add</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create Department</CardTitle>
            <CardDescription>Set company, manager, team leader, and shift duration.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <div className="grid gap-2 md:grid-cols-2">
              <select className="h-10 rounded-md border border-stone-200 bg-white px-2 text-sm font-semibold" value={targetCompanyId} onChange={(event) => setDepartmentCompanyId(event.target.value)}>
                {workspace.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
              <input className="h-10 rounded-md border border-stone-200 px-3 text-sm font-semibold" value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} placeholder="Department name" />
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <input className="h-10 rounded-md border border-stone-200 px-3 text-sm font-semibold" value={shiftHours} onChange={(event) => setShiftHours(event.target.value)} type="number" min="1" max="24" step="0.25" />
              <select className="h-10 rounded-md border border-stone-200 bg-white px-2 text-sm font-semibold" value={managerId} onChange={(event) => setManagerId(event.target.value)}>
                <option value="">No manager</option>
                {companyManagers.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
              </select>
              <select className="h-10 rounded-md border border-stone-200 bg-white px-2 text-sm font-semibold" value={teamLeaderId} onChange={(event) => setTeamLeaderId(event.target.value)}>
                <option value="">No team leader</option>
                {teamLeaders.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
              </select>
            </div>
            <Button onClick={createDepartment}><Plus className="h-4 w-4" />Add Department</Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Hierarchy</CardTitle>
          <CardDescription>Delete is blocked while child departments or users still exist.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {workspace.companies.map((company) => {
            const departments = workspace.departments.filter((department) => department.company_id === company.id);
            const users = workspace.profiles.filter((profile) => profile.company_id === company.id);
            return (
              <div key={company.id} className="rounded-lg border border-stone-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <strong>{company.name}</strong>
                    <p className="text-sm text-stone-500">{departments.length} departments - {users.length} users</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => void deleteCompany(company)}><Trash2 className="h-4 w-4" />Delete</Button>
                </div>
                <div className="mt-3 grid gap-2">
                  {departments.length ? departments.map((department) => (
                    <div key={department.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-stone-50 p-2 text-sm">
                      <span><strong>{department.name}</strong> - {formatNumber(Number(department.shift_hours || 8))}h shift</span>
                      <Button size="sm" variant="outline" onClick={() => void deleteDepartment(department)}><Trash2 className="h-4 w-4" />Delete</Button>
                    </div>
                  )) : <p className="text-sm font-semibold text-stone-500">No departments yet.</p>}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function AccountManagement({
  mode,
  workspace,
  supabase,
  onReload,
  onMessage
}: {
  mode: "employees" | "admins";
  workspace: Workspace;
  supabase: SupabaseClient | null;
  onReload: () => void;
  onMessage: (message: string) => void;
}) {
  const roleOptions = mode === "employees"
    ? ["employee", "team_leader", "department_manager"]
    : workspace.profile.role === "admin_account"
      ? ["payroll_admin", "company_manager"]
      : ["company_manager"];
  const [editingId, setEditingId] = React.useState("");
  const [role, setRole] = React.useState(roleOptions[0]);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [companyId, setCompanyId] = React.useState(workspace.companies[0]?.id || "");
  const [departmentId, setDepartmentId] = React.useState("");
  const [position, setPosition] = React.useState("");
  const [identificationNumber, setIdentificationNumber] = React.useState("");
  const [startDate, setStartDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = React.useState("");
  const [coAvailable, setCoAvailable] = React.useState("0");
  const [reportsToId, setReportsToId] = React.useState("");
  const [teamLeaderId, setTeamLeaderId] = React.useState("");
  const [permittedCompanyIds, setPermittedCompanyIds] = React.useState<string[]>(companyId ? [companyId] : []);

  const departmentOptions = workspace.departments.filter((department) => department.company_id === companyId);
  const selectedDepartment = workspace.departments.find((department) => department.id === departmentId);
  const managers = workspace.profiles.filter((profile) => (
    ["department_manager", "company_manager"].includes(profile.role) &&
    (profile.company_id === companyId || companyIdsForProfile(profile, workspace).has(companyId))
  ));
  const teamLeaders = workspace.profiles.filter((profile) => (
    profile.role === "team_leader" &&
    profile.company_id === companyId &&
    (!departmentId || profile.department_id === departmentId)
  ));
  const accounts = workspace.profiles
    .filter((profile) => mode === "employees"
      ? !["admin_account", "payroll_admin", "company_manager"].includes(profile.role)
      : ["payroll_admin", "company_manager"].includes(profile.role))
    .toSorted((a, b) => a.full_name.localeCompare(b.full_name));

  React.useEffect(() => {
    if (!departmentId) return;
    if (selectedDepartment?.manager_user_id && !reportsToId) setReportsToId(selectedDepartment.manager_user_id);
    if (role === "employee" && !teamLeaderId) {
      const leadersInDepartment = workspace.profiles.filter((profile) => (
        profile.role === "team_leader" &&
        profile.company_id === companyId &&
        profile.department_id === departmentId
      ));
      if (selectedDepartment?.team_leader_user_id) setTeamLeaderId(selectedDepartment.team_leader_user_id);
      else if (leadersInDepartment.length === 1) setTeamLeaderId(leadersInDepartment[0].id);
    }
    if (role !== "employee") setTeamLeaderId("");
  }, [companyId, departmentId, reportsToId, role, selectedDepartment, teamLeaderId, workspace.profiles]);

  function resetForm() {
    setEditingId("");
    setRole(roleOptions[0]);
    setName("");
    setEmail("");
    setPassword("");
    setCompanyId(workspace.companies[0]?.id || "");
    setDepartmentId("");
    setPosition("");
    setIdentificationNumber("");
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate("");
    setCoAvailable("0");
    setReportsToId("");
    setTeamLeaderId("");
    setPermittedCompanyIds(workspace.companies[0]?.id ? [workspace.companies[0].id] : []);
  }

  function editAccount(profile: ProfileRow) {
    const access = workspace.access.filter((item) => item.payroll_user_id === profile.id).map((item) => item.company_id);
    setEditingId(profile.id);
    setRole(profile.role);
    setName(profile.full_name);
    setEmail(profile.email);
    setPassword("");
    setCompanyId(profile.company_id || access[0] || workspace.companies[0]?.id || "");
    setDepartmentId(profile.department_id || "");
    setPosition(profile.position || "");
    setIdentificationNumber(profile.identification_number || "");
    setStartDate(profile.start_date || new Date().toISOString().slice(0, 10));
    setEndDate(profile.end_date || "");
    setCoAvailable(String(profile.co_available || 0));
    setReportsToId(profile.reports_to_user_id || "");
    setTeamLeaderId(profile.team_leader_user_id || "");
    setPermittedCompanyIds(access.length ? access : profile.company_id ? [profile.company_id] : []);
  }

  async function saveAccount() {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      onMessage("Session expired. Please log in again.");
      return;
    }
    const adminRole = ["payroll_admin", "company_manager"].includes(role);
    const payload = {
      user: {
        id: editingId || undefined,
        name,
        email,
        role,
        identificationNumber: adminRole ? "" : identificationNumber,
        position: adminRole ? ROLES[role] : position,
        companyId: adminRole ? permittedCompanyIds[0] || companyId : companyId,
        departmentId: adminRole ? "" : departmentId,
        reportsToId: adminRole ? "" : reportsToId,
        teamLeaderId: role === "employee" ? teamLeaderId : "",
        startDate: adminRole ? "" : startDate,
        endDate: adminRole ? "" : endDate,
        coAvailable: adminRole ? 0 : Number(coAvailable || 0)
      },
      password,
      permittedCompanyIds: adminRole ? permittedCompanyIds : []
    };
    const response = await fetch("/api/upsert-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) {
      onMessage(body.error || "Could not save account.");
      return;
    }
    resetForm();
    onReload();
  }

  async function deleteAccount(profile: ProfileRow) {
    if (!supabase) return;
    if (!window.confirm(`Delete account ${profile.full_name}?`)) return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      onMessage("Session expired. Please log in again.");
      return;
    }
    const response = await fetch("/api/delete-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ userId: profile.id })
    });
    const body = await response.json();
    if (!response.ok) {
      onMessage(body.error || "Could not delete account.");
      return;
    }
    onReload();
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit" : "Create"} {mode === "employees" ? "Employee" : "Admin / Manager"}</CardTitle>
          <CardDescription>
            {mode === "employees"
              ? "Employees, Team Leaders, and Department Managers."
              : "Payroll Admins and Company Managers. Company access uses checkboxes."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-3">
            <select className="h-10 rounded-md border border-stone-200 bg-white px-2 text-sm font-semibold" value={role} onChange={(event) => setRole(event.target.value)}>
              {roleOptions.map((option) => <option key={option} value={option}>{ROLES[option]}</option>)}
            </select>
            <input className="h-10 rounded-md border border-stone-200 px-3 text-sm font-semibold" value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" />
            <input className="h-10 rounded-md border border-stone-200 px-3 text-sm font-semibold" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <input className="h-10 rounded-md border border-stone-200 px-3 text-sm font-semibold" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={editingId ? "New password optional" : "Temporary password"} type="password" />
            {mode === "employees" ? (
              <>
                <input className="h-10 rounded-md border border-stone-200 px-3 text-sm font-semibold" value={position} onChange={(event) => setPosition(event.target.value)} placeholder="Position" />
                <input className="h-10 rounded-md border border-stone-200 px-3 text-sm font-semibold" value={identificationNumber} onChange={(event) => setIdentificationNumber(event.target.value)} placeholder="Identification number" />
              </>
            ) : null}
          </div>

          {mode === "employees" ? (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <select className="h-10 rounded-md border border-stone-200 bg-white px-2 text-sm font-semibold" value={companyId} onChange={(event) => {
                  setCompanyId(event.target.value);
                  setDepartmentId("");
                  setReportsToId("");
                  setTeamLeaderId("");
                }}>
                  {workspace.companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                </select>
                <select className="h-10 rounded-md border border-stone-200 bg-white px-2 text-sm font-semibold" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                  <option value="">No department</option>
                  {departmentOptions.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
                <input className="h-10 rounded-md border border-stone-200 px-3 text-sm font-semibold" value={coAvailable} onChange={(event) => setCoAvailable(event.target.value)} placeholder="CO days" type="number" step="0.25" />
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <input className="h-10 rounded-md border border-stone-200 px-3 text-sm font-semibold" value={startDate} onChange={(event) => setStartDate(event.target.value)} type="date" />
                <input className="h-10 rounded-md border border-stone-200 px-3 text-sm font-semibold" value={endDate} onChange={(event) => setEndDate(event.target.value)} type="date" />
                <select className="h-10 rounded-md border border-stone-200 bg-white px-2 text-sm font-semibold" value={reportsToId} onChange={(event) => setReportsToId(event.target.value)}>
                  <option value="">Reports to none</option>
                  {managers.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
                </select>
                {role === "employee" ? (
                  <select className="h-10 rounded-md border border-stone-200 bg-white px-2 text-sm font-semibold" value={teamLeaderId} onChange={(event) => setTeamLeaderId(event.target.value)}>
                    <option value="">No team leader</option>
                    {teamLeaders.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
                  </select>
                ) : <div />}
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-stone-200 p-3">
              <p className="mb-2 text-xs font-black uppercase tracking-wide text-stone-500">Company Access</p>
              <div className="grid max-h-40 gap-2 overflow-auto md:grid-cols-2">
                {workspace.companies.map((company) => (
                  <label key={company.id} className="flex items-center gap-2 rounded-md bg-stone-50 p-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={permittedCompanyIds.includes(company.id)}
                      onChange={(event) => {
                        setPermittedCompanyIds((current) => event.target.checked
                          ? Array.from(new Set([...current, company.id]))
                          : current.filter((id) => id !== company.id));
                      }}
                    />
                    {company.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-2">
            <Button variant="outline" onClick={resetForm}>Reset</Button>
            <Button onClick={saveAccount}><Save className="h-4 w-4" />Save Account</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{mode === "employees" ? "Employees" : "Admins and Managers"}</CardTitle>
          <CardDescription>{accounts.length} accounts in this environment.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {accounts.map((profile) => {
            const access = workspace.access.filter((item) => item.payroll_user_id === profile.id).map((item) => workspace.companies.find((company) => company.id === item.company_id)?.name).filter(Boolean);
            return (
              <div key={profile.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 p-3">
                <div>
                  <strong>{profile.full_name}</strong>
                  <p className="text-sm text-stone-500">
                    {ROLES[profile.role]} - {mode === "admins" ? access.join(", ") || "No companies assigned" : profile.position || "No position"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => editAccount(profile)}>Edit</Button>
                  <Button size="sm" variant="outline" onClick={() => void deleteAccount(profile)}><Trash2 className="h-4 w-4" />Delete</Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function companyIdsForProfile(profile: ProfileRow, workspace: Workspace) {
  const ids = new Set<string>();
  if (profile.company_id) ids.add(profile.company_id);
  workspace.access.filter((item) => item.payroll_user_id === profile.id).forEach((item) => ids.add(item.company_id));
  return ids;
}

function EntityCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{items.length} records</CardDescription>
      </CardHeader>
      <CardContent className="grid max-h-96 gap-2 overflow-auto">
        {items.map((item) => <div key={item} className="rounded-md border border-stone-200 p-2 text-sm font-semibold">{item}</div>)}
      </CardContent>
    </Card>
  );
}

function DocumentPreview({ html, onClose }: { html: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 p-4">
      <Card className="h-[86vh] w-full max-w-4xl overflow-hidden">
        <CardHeader className="flex-row items-center justify-between border-b border-stone-200">
          <div>
            <CardTitle>Leave Request Document</CardTitle>
            <CardDescription>Preview of the generated request form.</CardDescription>
          </div>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </CardHeader>
        <CardContent className="h-[calc(86vh-104px)] p-0">
          <iframe className="h-full w-full bg-white" srcDoc={html} title="Leave request document preview" />
        </CardContent>
      </Card>
    </div>
  );
}

async function uploadLeaveDocument(supabase: SupabaseClient, workspace: Workspace, entityId: string, file: File) {
  if (!workspace.profile.environment_id) return null;
  const safeName = file.name.replace(/[^a-z0-9._-]+/gi, "-");
  const path = `${workspace.profile.environment_id}/${entityId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("leave-documents").upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

async function downloadStorageFile(supabase: SupabaseClient | null, bucket: string, path: string) {
  if (!supabase || !path) return;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) return;
  window.open(data.signedUrl, "_blank", "noopener,noreferrer");
}

function datesBetween(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const days: ReturnType<typeof daysInMonth> = [];
  for (const date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    days.push({
      day: date.getDate(),
      iso,
      weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
      weekdayIndex: date.getDay()
    });
  }
  return days;
}

function downloadHtml(html: string, filename: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/[^a-z0-9.-]+/gi, "-");
  link.click();
  URL.revokeObjectURL(url);
}

function exportCsv(companyName: string, month: string, employees: ProfileRow[], workspace: Workspace) {
  const days = daysInMonth(month);
  const rows = [
    ["Employee", "Position", ...days.map((day) => day.iso), "Worked", "Norm", "Diff", "OT", "CO", "CM", "SE", "AB", "CO Left"]
  ];
  employees.forEach((employee) => {
    const totals = totalsFor(employee, month, workspace);
    rows.push([
      employee.full_name,
      employee.position || ROLES[employee.role],
      ...days.map((day) => {
        const entry = entryFor(workspace.entries, employee.id, day.iso);
        return entry ? String(Number(entry.hours || 0)) : "";
      }),
      String(totals.worked),
      String(totals.expected),
      String(totals.difference),
      String(totals.overtime),
      String(totals.vacationDays),
      String(totals.medicalDays),
      String(totals.specialEventDays),
      String(totals.absenceDays),
      String(Math.max(0, Number(employee.co_available || 0) - totals.vacationDays))
    ]);
  });
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${companyName}-${month}-timesheet.csv`.replace(/[^a-z0-9.-]+/gi, "-");
  link.click();
  URL.revokeObjectURL(url);
}

function tabLabel(tab: string) {
  return nav.find((item) => item.value === tab)?.label || "Timesheet";
}
