"use client";

import * as React from "react";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Download,
  LayoutDashboard,
  LogOut,
  Settings2,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  currentMonth,
  daysInMonth,
  entryFor,
  formatNumber,
  holidayForEmployee,
  isExpectedWorkDay,
  monthOptions,
  monthRange,
  normalHours,
  totalsFor,
  visibleEmployees
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
  const [month, setMonth] = React.useState(currentMonth());
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [message, setMessage] = React.useState("");

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
  const employees = activeCompany ? visibleEmployees(workspace, activeCompany.id) : [];
  const monthDays = daysInMonth(month);
  const scopeTotals = employees.reduce(
    (acc, employee) => {
      const totals = totalsFor(employee, month, workspace);
      acc.worked += totals.worked;
      acc.expected += totals.expected;
      acc.overtime += totals.overtime;
      acc.co += totals.vacationDays;
      acc.cm += totals.medicalDays;
      acc.se += totals.specialEventDays;
      return acc;
    },
    { worked: 0, expected: 0, overtime: 0, co: 0, cm: 0, se: 0 }
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
                onChange={(event) => setActiveCompanyId(event.target.value)}
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
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <TabsList>
                  <TabsTrigger value="timesheet">Timesheet</TabsTrigger>
                  <TabsTrigger value="leave">Leave</TabsTrigger>
                  <TabsTrigger value="charts">Charts</TabsTrigger>
                  {setupAllowed ? <TabsTrigger value="companies">Management</TabsTrigger> : null}
                </TabsList>
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

              <TabsContent value="timesheet">
                <div className="mb-4 grid gap-3 md:grid-cols-5">
                  <SummaryCard label="People" value={String(employees.length)} hint="visible scope" />
                  <SummaryCard label="Worked" value={`${formatNumber(scopeTotals.worked)}h`} hint="month total" />
                  <SummaryCard label="Overtime" value={`${formatNumber(scopeTotals.overtime)}h`} hint="recorded" />
                  <SummaryCard label="Leave" value={`${scopeTotals.co} CO / ${scopeTotals.cm} CM`} hint={`${scopeTotals.se} special events`} />
                  <SummaryCard label="Diff" value={`${scopeDifference > 0 ? "+" : ""}${formatNumber(scopeDifference)}h`} hint="worked vs norm" accent={scopeDifference < 0 ? "bad" : "good"} />
                </div>
                <TimesheetTable month={month} workspace={workspace} employees={employees} />
              </TabsContent>

              <TabsContent value="leave">
                <LeaveRequests workspace={workspace} />
              </TabsContent>

              <TabsContent value="charts">
                <Charts worked={scopeTotals.worked} expected={scopeTotals.expected} co={scopeTotals.co} cm={scopeTotals.cm} se={scopeTotals.se} />
              </TabsContent>

              <TabsContent value="companies">
                <Management workspace={workspace} />
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </div>
    </main>
  );
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

function TimesheetTable({ month, workspace, employees }: { month: string; workspace: Workspace; employees: ProfileRow[] }) {
  const days = daysInMonth(month);
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1220px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className="sticky left-0 z-10 w-56 bg-stone-50 px-4 py-3 text-left font-black">Employee</th>
              {days.map((day) => (
                <th key={day.iso} className="w-11 border-l border-stone-200 px-1 py-2 text-center">
                  <span className="block text-base font-black">{day.day}</span>
                  <span className="text-[11px] font-bold text-stone-500">{day.weekday}</span>
                </th>
              ))}
              {["Worked", "Norm", "Diff", "OT", "CO", "CM", "SE"].map((label) => (
                <th key={label} className="border-l border-stone-200 px-3 py-3 text-center font-black">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.length ? employees.map((employee) => {
              const totals = totalsFor(employee, month, workspace);
              return (
                <tr key={employee.id} className="border-b border-stone-200 hover:bg-stone-50/60">
                  <td className="sticky left-0 z-10 bg-white px-4 py-3">
                    <strong className="block text-base">{employee.full_name}</strong>
                    <span className="text-xs font-semibold text-stone-500">{employee.position || ROLES[employee.role]}</span>
                  </td>
                  {days.map((day) => <EntryCell key={day.iso} employee={employee} day={day} workspace={workspace} />)}
                  <td className="border-l border-stone-200 px-3 text-center font-black">{formatNumber(totals.worked)}h</td>
                  <td className="border-l border-stone-200 px-3 text-center font-black">{formatNumber(totals.expected)}h</td>
                  <td className={cn("border-l border-stone-200 px-3 text-center font-black", totals.difference < 0 ? "text-rose-700" : "text-emerald-700")}>
                    {totals.difference > 0 ? "+" : ""}{formatNumber(totals.difference)}h
                  </td>
                  <td className="border-l border-stone-200 px-3 text-center font-black">{formatNumber(totals.overtime)}h</td>
                  <td className="border-l border-stone-200 px-3 text-center font-black">{totals.vacationDays}d</td>
                  <td className="border-l border-stone-200 px-3 text-center font-black">{totals.medicalDays}d</td>
                  <td className="border-l border-stone-200 px-3 text-center font-black">{totals.specialEventDays}d</td>
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

function EntryCell({ employee, day, workspace }: { employee: ProfileRow; day: ReturnType<typeof daysInMonth>[number]; workspace: Workspace }) {
  const entry = entryFor(workspace.entries, employee.id, day.iso);
  const holiday = holidayForEmployee(employee, day.iso, workspace);
  const expected = isExpectedWorkDay(employee, day.iso, day.weekdayIndex, workspace);
  const normal = normalHours(employee, workspace);
  const code = entry ? ENTRY_LABELS[entry.type] || entry.type : holiday ? "H" : "";
  const detail = entry ? entryDetail(entry, normal) : "";
  const tooltip = entry ? entryTooltip(entry, normal) : holiday?.name || (expected ? "Expected working day" : "Non-working day");
  return (
    <td title={tooltip} className={cn("border-l border-stone-200 px-1 py-2 text-center", cellClass(entry?.type, Boolean(holiday), expected))}>
      <span className="block font-black">{code}</span>
      <span className="text-xs text-stone-500">{detail}</span>
    </td>
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

function cellClass(type: string | undefined, holiday: boolean, expected: boolean) {
  if (type === "vacation") return "bg-emerald-100 text-emerald-900";
  if (type === "medical") return "bg-rose-100 text-rose-900";
  if (type === "absence") return "bg-stone-900 text-white";
  if (type === "overtime") return "bg-amber-100 text-amber-950";
  if (type === "special_event") return "bg-stone-200 text-stone-800";
  if (holiday) return "bg-yellow-50 text-yellow-900";
  if (!expected) return "bg-sky-50";
  return "bg-white";
}

function LeaveRequests({ workspace }: { workspace: Workspace }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave Requests</CardTitle>
        <CardDescription>Loaded from Supabase. Approval actions are the next porting slice.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {workspace.leaveRequests.length ? workspace.leaveRequests.map((request) => {
          const employee = workspace.profiles.find((profile) => profile.id === request.employee_user_id);
          return (
            <div key={request.id} className="flex flex-col gap-2 rounded-lg border border-stone-200 p-3 md:flex-row md:items-center md:justify-between">
              <div>
                <strong>{employee?.full_name || "Employee"}</strong>
                <p className="text-sm text-stone-500">{request.start_date} to {request.end_date} - {ENTRY_LABELS[request.type] || request.type}</p>
              </div>
              <Badge variant={request.status === "approved" ? "success" : request.status === "requested" ? "warning" : "secondary"}>{request.status}</Badge>
            </div>
          );
        }) : <p className="text-sm font-semibold text-stone-500">No leave requests found.</p>}
      </CardContent>
    </Card>
  );
}

function Charts({ worked, expected, co, cm, se }: { worked: number; expected: number; co: number; cm: number; se: number }) {
  const width = expected ? Math.min(100, Math.round((worked / expected) * 100)) : 0;
  return (
    <div className="grid gap-4 md:grid-cols-2">
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
          {[["CO", co, "bg-emerald-500"], ["CM", cm, "bg-rose-400"], ["SE", se, "bg-stone-400"]].map(([label, value, color]) => (
            <div key={label as string} className="grid grid-cols-[40px_1fr_44px] items-center gap-3 text-sm font-semibold">
              <span>{label}</span>
              <div className="h-2 rounded-full bg-stone-100"><div className={cn("h-2 rounded-full", color as string)} style={{ width: `${Math.min(100, Number(value) * 12)}%` }} /></div>
              <span>{value}d</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Management({ workspace }: { workspace: Workspace }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <EntityCard title="Companies" items={workspace.companies.map((company) => company.name)} />
      <EntityCard title="Departments" items={workspace.departments.map((department) => department.name)} />
      <EntityCard title="People" items={workspace.profiles.map((profile) => `${profile.full_name} - ${ROLES[profile.role]}`)} />
    </div>
  );
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

function exportCsv(companyName: string, month: string, employees: ProfileRow[], workspace: Workspace) {
  const days = daysInMonth(month);
  const rows = [
    ["Employee", "Position", ...days.map((day) => day.iso), "Worked", "Norm", "Diff", "OT", "CO", "CM", "SE"]
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
      String(totals.specialEventDays)
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
