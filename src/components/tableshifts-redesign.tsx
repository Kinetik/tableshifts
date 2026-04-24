"use client";

import * as React from "react";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import {
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Download,
  Eye,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Palette,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
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
  { value: "companies", label: "Management", icon: Building2, setupOnly: true },
  { value: "admins", label: "Admins", icon: ShieldCheck, setupOnly: true },
  { value: "settings", label: "Settings", icon: Settings2, setupOnly: true }
];

const ENTRY_COLOR_KEYS = [
  ["vacation", "CO"],
  ["medical", "CM"],
  ["overtime", "OT"],
  ["absence", "AB"],
  ["special_event", "SE"]
] as const;

const ENTRY_COLOR_LABELS: Record<string, string> = {
  vacation: "Vacation",
  medical: "Medical",
  overtime: "Overtime",
  absence: "Absence",
  special_event: "Special Event"
};

const DEFAULT_ENTRY_COLORS: Record<string, string> = {
  vacation: "#dcfce7",
  medical: "#ffe4e6",
  overtime: "#fef3c7",
  absence: "#1c1917",
  special_event: "#e7e5e4"
};

const SPECIAL_EVENT_REASONS = [
  "Family death",
  "Child birth",
  "Marriage",
  "Blood donation",
  "Moving house",
  "Jury duty",
  "Civic duty",
  "Other special event"
];

const COUNTRY_OPTIONS = [
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
  const [totalsExpanded, setTotalsExpanded] = React.useState(false);
  const [companyMenuOpen, setCompanyMenuOpen] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [creatingCompany, setCreatingCompany] = React.useState(false);
  const [newCompanyName, setNewCompanyName] = React.useState("");
  const [companyLogoUrls, setCompanyLogoUrls] = React.useState<Record<string, string>>({});

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

  React.useEffect(() => {
    let cancelled = false;
    async function loadCompanyLogos() {
      if (!supabase || !workspace) return;
      const entries = await Promise.all(
        workspace.companies.map(async (company) => {
          if (!company.logo_path) return [company.id, ""] as const;
          const { data } = await supabase.storage.from("company-logos").createSignedUrl(company.logo_path, 60 * 20);
          return [company.id, data?.signedUrl || ""] as const;
        })
      );
      if (!cancelled) setCompanyLogoUrls(Object.fromEntries(entries));
    }
    void loadCompanyLogos();
    return () => {
      cancelled = true;
    };
  }, [supabase, workspace]);

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

  async function createCompanyFromSidebar() {
    if (!supabase || !workspace?.profile.environment_id || !newCompanyName.trim()) return;
    const { data, error } = await supabase
      .from("companies")
      .insert({
        environment_id: workspace.profile.environment_id,
        name: newCompanyName.trim(),
        created_by: workspace.profile.id
      })
      .select("*")
      .single();
    if (error) {
      setMessage(error.message);
      return;
    }
    setNewCompanyName("");
    setCreatingCompany(false);
    if (data?.id) setActiveCompanyId(data.id);
    if (authUser) void loadWorkspace(authUser);
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
  const visibleNav = nav.filter((item) => item.value !== "timesheet" && (!item.setupOnly || setupAllowed));
  const companyDepartments = workspace.departments.filter((department) => department.company_id === activeCompany?.id);
  const companyTeamLeaders = workspace.profiles.filter((profile) => (
    profile.role === "team_leader" &&
    profile.company_id === activeCompany?.id &&
    (departmentFilter === "all" || profile.department_id === departmentFilter || companyDepartments.find((department) => department.id === departmentFilter)?.team_leader_user_id === profile.id)
  ));
  const employees = activeCompany ? filteredEmployees(workspace, activeCompany.id, departmentFilter, teamFilter) : [];
  const accessibleCompanyIds = new Set(companies.map((company) => company.id));
  const pendingApprovals = workspace.leaveRequests.filter((request) => {
    const employee = workspace.profiles.find((profile) => profile.id === request.employee_user_id);
    return request.status === "requested" &&
      accessibleCompanyIds.has(request.company_id) &&
      canApproveLeave(workspace.profile, employee, workspace);
  });
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
  const activePanel = activeTab === "timesheet" ? null : activeTab;
  const sheetWide = ["leave", "companies", "admins", "settings"].includes(activeTab);

  return (
    <main className="h-screen overflow-hidden p-4 text-stone-950 md:p-6">
      <div className="grid h-full min-w-0 grid-cols-[252px_minmax(0,1fr)] gap-4 overflow-hidden">
        <aside className="relative grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-2 rounded-[22px] border border-emerald-900/10 bg-[#062f23] p-3 text-white shadow-[0_24px_80px_rgba(6,47,35,0.18)]">
          <div>
            <div className="mb-3 px-2 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-200">TableShifts</p>
            </div>
            <div className="relative px-2">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-2.5 py-2 text-left transition hover:bg-white/[0.08]"
                onClick={() => {
                  setCompanyMenuOpen((value) => !value);
                  setUserMenuOpen(false);
                }}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white text-emerald-950">
                  {activeCompany && companyLogoUrls[activeCompany.id]
                    ? <img src={companyLogoUrls[activeCompany.id]} alt="" className="h-full w-full object-contain" />
                    : <Building2 className="h-4.5 w-4.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-white">{activeCompany?.name || "Select company"}</div>
                  <div className="truncate text-[11px] text-emerald-200/70">{activeCompany ? `${companyDepartments.length} departments` : "No company selected"}</div>
                </div>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-emerald-100/70 transition-transform", companyMenuOpen && "rotate-180")} />
              </button>
              {companyMenuOpen ? (
                <div className="absolute left-2 right-2 top-[calc(100%+0.5rem)] z-20 rounded-2xl border border-white/10 bg-[#0c3a2b] p-2 shadow-[0_20px_60px_rgba(6,47,35,0.45)]">
                  <div className="mb-1 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/60">Companies</div>
                  <div className="grid gap-1">
                    {companies.map((company) => (
                      <button
                        key={company.id}
                        type="button"
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-2 py-2 text-left text-[13px] transition",
                          activeCompany?.id === company.id ? "bg-white text-emerald-950" : "text-white/80 hover:bg-white/[0.07] hover:text-white"
                        )}
                        onClick={() => {
                          setActiveCompanyId(company.id);
                          setDepartmentFilter("all");
                          setTeamFilter("all");
                          setCompanyMenuOpen(false);
                        }}
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white">
                          {companyLogoUrls[company.id]
                            ? <img src={companyLogoUrls[company.id]} alt="" className="h-full w-full object-contain" />
                            : <Building2 className="h-4 w-4 text-emerald-950" />}
                        </div>
                        <span className="min-w-0 flex-1 truncate font-medium">{company.name}</span>
                      </button>
                    ))}
                    {creatingCompany ? (
                      <div className="mt-1 rounded-xl border border-dashed border-white/14 bg-white/[0.05] p-2">
                        <input
                          className="h-8 w-full rounded-lg border border-white/10 bg-white px-2 text-[13px] font-semibold text-emerald-950 outline-none"
                          value={newCompanyName}
                          onChange={(event) => setNewCompanyName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void createCompanyFromSidebar();
                            if (event.key === "Escape") {
                              setCreatingCompany(false);
                              setNewCompanyName("");
                            }
                          }}
                          placeholder="Company name"
                          autoFocus
                        />
                      </div>
                    ) : null}
                    {setupAllowed ? (
                      <button
                        type="button"
                        className="mt-1 flex items-center gap-2 rounded-xl border border-dashed border-white/14 px-2 py-2 text-left text-[13px] font-semibold text-emerald-100/82 transition hover:bg-white/[0.07] hover:text-white"
                        onClick={() => {
                          setCreatingCompany(true);
                        }}
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]">
                          <Plus className="h-4 w-4" />
                        </div>
                        <span>Create company</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 px-2 py-1">
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/65">Workspace</div>
            <nav className="grid gap-0.5 overflow-y-auto">
              {visibleNav.map((item) => (
                <button
                  key={item.value}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-emerald-50/72 transition-colors hover:bg-white/7 hover:text-white",
                    activeTab === item.value && "bg-white/96 text-emerald-950 shadow-sm hover:bg-white hover:text-emerald-950"
                  )}
                  onClick={() => setActiveTab(item.value)}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  {item.value !== "timesheet" ? <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-40 transition group-hover:opacity-70" /> : null}
                </button>
              ))}
            </nav>
          </div>

          <div className="relative px-2">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-2.5 py-2 text-left transition hover:bg-white/[0.08]"
              onClick={() => {
                setUserMenuOpen((value) => !value);
                setCompanyMenuOpen(false);
              }}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[11px] font-black text-emerald-950">
                {workspace.profile.full_name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-white">{workspace.profile.full_name}</div>
                <div className="truncate text-[11px] text-emerald-200/70">{workspace.profile.email}</div>
              </div>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-emerald-100/70 transition-transform", userMenuOpen && "rotate-180")} />
            </button>
            {userMenuOpen ? (
              <div className="absolute bottom-[calc(100%+0.5rem)] left-2 right-2 z-20 rounded-2xl border border-white/10 bg-[#0c3a2b] p-2 shadow-[0_20px_60px_rgba(6,47,35,0.45)]">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <div className="text-[13px] font-semibold text-white">{workspace.profile.position || ROLES[workspace.profile.role]}</div>
                  <div className="mt-0.5 text-[11px] text-emerald-200/75">
                    {[activeCompany?.name, workspace.departments.find((department) => department.id === workspace.profile.department_id)?.name].filter(Boolean).join(" / ") || "No department"}
                  </div>
                </div>
                {pendingApprovals.length ? (
                  <button
                    type="button"
                    className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-white/82 transition hover:bg-white/[0.07] hover:text-white"
                    onClick={() => {
                      setActiveTab("leave");
                      setUserMenuOpen(false);
                    }}
                  >
                    <Bell className="h-4 w-4" />
                    <span className="flex-1">Pending approvals</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold">{pendingApprovals.length}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-white/82 transition hover:bg-white/[0.07] hover:text-white"
                  onClick={signOut}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="relative min-w-0 overflow-hidden rounded-[28px] border border-stone-200/80 bg-white/75 shadow-[0_24px_80px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="h-full min-w-0 overflow-hidden p-3 md:p-4">
            {message ? <p className="mb-4 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{message}</p> : null}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <select className="h-8 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-900 outline-none" value={month} onChange={(event) => setMonth(event.target.value)}>
                {monthOptions(month).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <select className="h-8 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-900 outline-none" value={departmentFilter} onChange={(event) => {
                setDepartmentFilter(event.target.value);
                setTeamFilter("all");
              }}>
                <option value="all">All departments</option>
                {companyDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
              <select className="h-8 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-semibold text-stone-900 outline-none" value={teamFilter} onChange={(event) => {
                const leader = workspace.profiles.find((profile) => profile.id === event.target.value);
                setTeamFilter(event.target.value);
                if (leader?.department_id) setDepartmentFilter(leader.department_id);
              }}>
                <option value="all">All team leaders</option>
                {companyTeamLeaders.map((leader) => <option key={leader.id} value={leader.id}>{leader.full_name}</option>)}
              </select>
              <Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5 text-xs font-semibold" onClick={() => exportCsv(activeCompany?.name || "TableShifts", month, employees, workspace)}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            </div>
            <TimesheetTable
              month={month}
              workspace={workspace}
              employees={employees}
              totalsExpanded={totalsExpanded}
              onToggleTotals={() => setTotalsExpanded((value) => !value)}
              onSetHours={(employee, iso, hours) => void saveCellHours(employee, iso, hours)}
              onSetType={(employee, iso, type) => void saveCellType(employee, iso, type)}
              onClearDay={(employee, iso) => void clearEmployeeDay(employee, iso)}
              onFill={(employee) => void fillNormalTime(employee)}
              onClear={(employee) => void clearEmployeeMonth(employee)}
            />
          </div>

          <SideSheet
            open={Boolean(activePanel)}
            title={tabLabel(activeTab)}
            description={sheetDescription(activeTab)}
            wide={sheetWide}
            onClose={() => setActiveTab("timesheet")}
          >
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

            {["companies", "admins", "settings"].includes(activeTab) ? (
              <Management
                workspace={workspace}
                activeTab={activeTab}
                activeCompany={activeCompany}
                supabase={supabase}
                onReload={() => authUser && loadWorkspace(authUser)}
                onSignOut={signOut}
                onMessage={setMessage}
              />
            ) : null}
          </SideSheet>
        </section>
      </div>
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

  async function saveCellEntry(employee: ProfileRow, iso: string, type: string, hours: number) {
    const currentWorkspace = workspace;
    if (!supabase || !currentWorkspace?.profile.environment_id || !employee.company_id) return;
    const existing = entryFor(currentWorkspace.entries, employee.id, iso);
    const entryId = existing?.id || crypto.randomUUID();
    const { error } = await supabase.from("timesheet_entries").upsert({
      id: entryId,
      environment_id: currentWorkspace.profile.environment_id,
      company_id: employee.company_id,
      employee_user_id: employee.id,
      department_id: employee.department_id,
      work_date: iso,
      type,
      hours,
      attachment_path: ["vacation", "medical"].includes(type) ? existing?.attachment_path || null : null,
      updated_by: currentWorkspace.profile.id,
      created_by: currentWorkspace.profile.id
    }, { onConflict: "employee_user_id,work_date" });
    if (error) {
      setMessage(error.message);
      return;
    }
    if (authUser) await loadWorkspace(authUser);
  }

  async function saveCellHours(employee: ProfileRow, iso: string, rawHours: string) {
    const currentWorkspace = workspace;
    if (!currentWorkspace) return;
    const trimmed = rawHours.trim();
    if (!trimmed) {
      await clearEmployeeDay(employee, iso);
      return;
    }
    const parsed = Number(trimmed.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 24) {
      setMessage("Enter hours between 0 and 24.");
      return;
    }
    const normal = normalHours(employee, currentWorkspace);
    await saveCellEntry(employee, iso, parsed > normal ? "overtime" : "normal", parsed);
  }

  async function saveCellType(employee: ProfileRow, iso: string, type: string) {
    const currentWorkspace = workspace;
    if (!currentWorkspace) return;
    const normal = normalHours(employee, currentWorkspace);
    const hours = type === "normal" ? normal : type === "overtime" ? normal + 2 : 0;
    await saveCellEntry(employee, iso, type, hours);
  }

  async function clearEmployeeDay(employee: ProfileRow, iso: string) {
    if (!supabase) return;
    const { error } = await supabase
      .from("timesheet_entries")
      .delete()
      .eq("employee_user_id", employee.id)
      .eq("work_date", iso);
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
  onSetHours,
  onSetType,
  onClearDay,
  onFill,
  onClear
}: {
  month: string;
  workspace: Workspace;
  employees: ProfileRow[];
  totalsExpanded: boolean;
  onToggleTotals: () => void;
  onSetHours: (employee: ProfileRow, iso: string, hours: string) => void;
  onSetType: (employee: ProfileRow, iso: string, type: string) => void;
  onClearDay: (employee: ProfileRow, iso: string) => void;
  onFill: (employee: ProfileRow) => void;
  onClear: (employee: ProfileRow) => void;
}) {
  const days = daysInMonth(month);
  const editableCellKeys = React.useMemo(() => {
    const keys: string[] = [];
    employees.forEach((employee) => {
      if (!canEditEmployee(workspace.profile, employee, workspace)) return;
      days.forEach((day) => {
        if (isExpectedWorkDay(employee, day.iso, day.weekdayIndex, workspace)) {
          keys.push(`${employee.id}:${day.iso}`);
        }
      });
    });
    return keys;
  }, [employees, month, workspace]);
  const compactColumns = ["Worked", "More"];
  const expandedColumns = ["Worked", "Norm", "Diff", "OT", "CO", "CM", "SE", "AB", "CO Left", "More", "Fill", "Clear"];
  const totalsColumns = totalsExpanded ? expandedColumns : compactColumns;
  const fixedCompactWidth = 176 + totalsColumns.length * 68;
  const expandedMinWidth = 188 + days.length * 38 + totalsColumns.length * 74;
  return (
    <Card className="max-w-full overflow-hidden">
      <div className={cn("max-h-[calc(100vh-260px)] max-w-full", totalsExpanded ? "overflow-auto" : "overflow-y-auto overflow-x-hidden")}>
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
                <tr key={employee.id} className="h-12 border-b border-stone-200 hover:bg-stone-50/60">
                  <td className="sticky left-0 z-10 bg-white px-3 py-1">
                    <strong className="block truncate text-sm">{employee.full_name}</strong>
                    <span className="block truncate text-[11px] font-semibold text-stone-500">{employee.position || ROLES[employee.role]}</span>
                  </td>
                  {days.map((day) => (
                    <EntryCell
                      key={day.iso}
                      employee={employee}
                      day={day}
                      workspace={workspace}
                      onSetHours={onSetHours}
                      onSetType={onSetType}
                      onClearDay={onClearDay}
                      onMove={(key, direction) => {
                        const currentIndex = editableCellKeys.indexOf(key);
                        if (currentIndex < 0) return;
                        const nextKey = editableCellKeys[currentIndex + direction];
                        if (!nextKey) return;
                        const nextInput = document.querySelector<HTMLInputElement>(`[data-cell-key="${nextKey}"] input`);
                        nextInput?.focus();
                        nextInput?.select();
                      }}
                    />
                  ))}
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
                    <Button size="sm" className="bg-amber-600 text-white hover:bg-amber-700" onClick={onToggleTotals}>{totalsExpanded ? "Less" : "More"}</Button>
                  </td>
                  {totalsExpanded ? (
                    <>
                      <td className="border-l border-stone-200 px-2 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-700 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                          onClick={() => onFill(employee)}
                          disabled={!canEditEmployee(workspace.profile, employee, workspace)}
                        >
                          Fill
                        </Button>
                      </td>
                      <td className="border-l border-stone-200 px-2 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-rose-700 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                          onClick={() => onClear(employee)}
                          disabled={!canEditEmployee(workspace.profile, employee, workspace)}
                        >
                          Clear
                        </Button>
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
  onSetHours,
  onSetType,
  onClearDay,
  onMove
}: {
  employee: ProfileRow;
  day: ReturnType<typeof daysInMonth>[number];
  workspace: Workspace;
  onSetHours: (employee: ProfileRow, iso: string, hours: string) => void;
  onSetType: (employee: ProfileRow, iso: string, type: string) => void;
  onClearDay: (employee: ProfileRow, iso: string) => void;
  onMove: (key: string, direction: 1 | -1) => void;
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
  const numericEntry = !entry || ["normal", "overtime"].includes(entry.type);
  const initialHours = numericEntry && entry ? String(formatNumber(Number(entry.hours || 0))) : "";
  const [draftHours, setDraftHours] = React.useState(initialHours);
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const longPressRef = React.useRef<number | null>(null);
  const cellKey = `${employee.id}:${day.iso}`;

  React.useEffect(() => {
    setDraftHours(initialHours);
  }, [initialHours]);

  React.useEffect(() => {
    if (!menu) return;
    function close() {
      setMenu(null);
    }
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  function commitHours() {
    if (!editable || !numericEntry || draftHours === initialHours) return;
    onSetHours(employee, day.iso, draftHours);
  }

  function updateDraftHours(value: string) {
    const digits = value.replace(/\D/g, "");
    if (!digits) {
      setDraftHours("");
      return;
    }
    setDraftHours(String(Math.min(24, Number(digits))));
  }

  function openMenu(x: number, y: number) {
    if (!editable) return;
    setMenu({ x, y });
  }

  function clearLongPress() {
    if (longPressRef.current) window.clearTimeout(longPressRef.current);
    longPressRef.current = null;
  }

  function applyType(nextType: string) {
    setMenu(null);
    if (nextType === "clear") {
      onClearDay(employee, day.iso);
      return;
    }
    onSetType(employee, day.iso, nextType);
  }

  function focusCellInput() {
    if (!editable || !numericEntry) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  return (
    <td
      title={tooltip}
      className={cn("border-l border-stone-200 p-0 text-center", cellClass(entry?.type, Boolean(holiday), expected, Boolean(customColor)))}
      style={customColor ? { backgroundColor: customColor } : undefined}
      onContextMenu={(event) => {
        event.preventDefault();
        openMenu(event.clientX, event.clientY);
      }}
    >
      <div
        data-cell-key={cellKey}
        className={cn(
          "relative flex h-12 w-full flex-col items-center justify-center px-0.5 py-0.5 text-center leading-tight focus-within:z-20 focus-within:shadow-[inset_0_0_0_2px_#047857]",
          editable && numericEntry ? "cursor-text hover:bg-white/25" : "cursor-default"
        )}
        onClick={focusCellInput}
        onPointerDown={(event) => {
          if (!editable) return;
          clearLongPress();
          longPressRef.current = window.setTimeout(() => openMenu(event.clientX, event.clientY), 550);
        }}
        onPointerUp={clearLongPress}
        onPointerLeave={clearLongPress}
      >
        {numericEntry ? (
          <>
            {entry?.type === "overtime" ? <span className="block text-[10px] font-black text-amber-900">OT</span> : null}
            <span className="mx-auto flex h-5 max-w-full items-center justify-center gap-0.5 leading-none">
              <input
                ref={inputRef}
                aria-label={`${employee.full_name} ${day.iso} hours`}
                className={cn(
                  "min-w-0 bg-transparent p-0 text-center text-[11px] font-black leading-none outline-none",
                  draftHours ? "w-auto" : "w-full",
                  editable ? "text-stone-950" : "text-stone-500"
                )}
                style={draftHours ? { width: `${Math.max(1, draftHours.length)}ch` } : undefined}
                value={draftHours}
                placeholder={holiday ? "H" : ""}
                disabled={!editable}
                inputMode="numeric"
                pattern="[0-9]*"
                onChange={(event) => updateDraftHours(event.target.value)}
                onBlur={commitHours}
                onKeyDown={(event) => {
                  if (event.key.length === 1 && !/\d/.test(event.key)) {
                    event.preventDefault();
                  }
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                  if (event.key === "Tab") {
                    event.preventDefault();
                    commitHours();
                    onMove(cellKey, event.shiftKey ? -1 : 1);
                  }
                  if (event.key === "Escape") {
                    setDraftHours(initialHours);
                    event.currentTarget.blur();
                  }
                }}
              />
              {draftHours ? <span className="text-[10px] font-bold text-stone-500">h</span> : null}
            </span>
          </>
        ) : (
          <>
            <span className="block text-[11px] font-black">{code}</span>
            <span className="text-[10px] text-stone-500">{detail}</span>
          </>
        )}
      </div>
      {menu ? (
        <div
          className="fixed z-[80] grid min-w-36 overflow-visible rounded-md border border-stone-200 bg-white p-1 text-left text-xs font-semibold shadow-xl shadow-stone-950/15"
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          {[
            ["normal", "Normal shift"],
            ["vacation", "Vacation CO"],
            ["medical", "Medical CM"],
            ["absence", "Absence"]
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                "rounded px-2 py-1.5 text-left hover:bg-stone-100",
                value === "clear" && "text-rose-700 hover:bg-rose-50"
              )}
              onClick={() => applyType(value)}
            >
              {label}
            </button>
          ))}
          <div className="group relative">
            <button type="button" className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-stone-100">
              Special Event
              <span className="text-stone-400">›</span>
            </button>
            <div className="absolute left-full top-0 hidden min-w-44 rounded-md border border-stone-200 bg-white p-1 shadow-xl shadow-stone-950/15 group-hover:grid group-focus-within:grid">
              {SPECIAL_EVENT_REASONS.map((reason) => (
                <button key={reason} type="button" className="rounded px-2 py-1.5 text-left hover:bg-stone-100" onClick={() => applyType("special_event")}>
                  {reason}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="rounded px-2 py-1.5 text-left text-rose-700 hover:bg-rose-50"
            onClick={() => applyType("clear")}
          >
            Clear
          </button>
        </div>
      ) : null}
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

  async function attachRecordedEntryFile(entry: EntryRow, file: File | null) {
    if (!supabase || !file) return;
    try {
      const path = await uploadLeaveDocument(supabase, workspace, entry.id, file);
      const { error } = await supabase
        .from("timesheet_entries")
        .update({ attachment_path: path })
        .eq("id", entry.id);
      if (error) {
        onMessage(error.message);
        return;
      }
      onReload();
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not upload leave document.");
    }
  }

  return (
    <div className="grid gap-3">
      {canCreate ? (
        <Card className="rounded-[22px] border-stone-200 shadow-none">
          <CardHeader className="pb-2.5">
            <CardTitle className="text-lg">New Leave Request</CardTitle>
            <CardDescription className="text-[13px]">Request CO, CM, or Special Event days. Generated documents can be previewed before submit.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-[140px_1fr_1fr_1.2fr]">
            <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-stone-500">
              Type
              <select className="h-9 rounded-md border border-stone-200 bg-white px-2 text-[13px] font-semibold normal-case tracking-normal text-stone-900" value={type} onChange={(event) => setType(event.target.value)}>
                <option value="vacation">Vacation CO</option>
                <option value="medical">Medical CM</option>
                <option value="special_event">Special Events</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-stone-500">
              Start
              <input className="h-9 rounded-md border border-stone-200 px-2 text-[13px] font-semibold normal-case tracking-normal text-stone-900" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-stone-500">
              End
              <input className="h-9 rounded-md border border-stone-200 px-2 text-[13px] font-semibold normal-case tracking-normal text-stone-900" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-stone-500">
              Notes
              <input className="h-9 rounded-md border border-stone-200 px-2 text-[13px] font-semibold normal-case tracking-normal text-stone-900" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional reason" />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-stone-500 xl:col-span-2">
              Document
              <input className="h-9 rounded-md border border-stone-200 bg-white px-2 py-1 text-[13px] font-semibold normal-case tracking-normal text-stone-900" type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </label>
            <div className="flex items-end gap-2 xl:col-span-2">
              <Button size="sm" variant="outline" className="h-8 rounded-lg px-2 text-[11px] font-semibold" onClick={() => setPreviewHtml(generatedLeaveDocumentHtml({ type, start_date: startDate, end_date: endDate, notes, status: "requested", decided_at: null }, workspace.profile, activeCompany))}>
                <Eye className="h-4 w-4" /> Preview
              </Button>
              <Button size="sm" className="h-8 rounded-lg px-2.5 text-[11px] font-semibold" onClick={submitRequest}>Submit</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-[22px] border-stone-200 shadow-none">
        <CardHeader className="pb-2.5">
          <CardTitle className="text-lg">Leave Requests</CardTitle>
          <CardDescription className="text-[13px]">One row per request, with approval and document actions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2.5">
          {requests.length ? requests.map((request) => {
            const employee = workspace.profiles.find((profile) => profile.id === request.employee_user_id);
            const canDecide = request.status === "requested" && canApproveLeave(workspace.profile, employee, workspace);
            const documentHtml = request.generated_document_html || (employee ? generatedLeaveDocumentHtml(request, employee, activeCompany) : "");
            return (
              <div key={request.id} className="grid gap-2.5 rounded-2xl border border-stone-200 bg-stone-50/55 p-2.5 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                <div>
                  <strong>{employee?.full_name || "Employee"}</strong>
                  <p className="text-[13px] text-stone-500">{request.start_date} to {request.end_date} - {ENTRY_LABELS[request.type] || request.type}{request.notes ? ` - ${request.notes}` : ""}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={request.status === "approved" ? "success" : request.status === "requested" ? "warning" : "secondary"}>{request.status}</Badge>
                  {request.attachment_path ? <Button size="sm" variant="outline" className="h-7 rounded-lg px-2 text-[11px] font-semibold" onClick={() => void downloadStorageFile(supabase, "leave-documents", request.attachment_path || "")}><Download className="h-3.5 w-3.5" />File</Button> : null}
                  {documentHtml ? <Button size="sm" variant="outline" className="h-7 rounded-lg px-2 text-[11px] font-semibold" onClick={() => setPreviewHtml(documentHtml)}>Preview</Button> : null}
                  {documentHtml ? <Button size="sm" variant="outline" className="h-7 rounded-lg px-2 text-[11px] font-semibold" onClick={() => downloadHtml(documentHtml, `${employee?.full_name || "leave"}-${request.start_date}.html`)}>Download</Button> : null}
                </div>
                {canDecide ? (
                  <div className="flex gap-2 lg:justify-end">
                    <Button size="sm" className="h-7 rounded-lg px-2.5 text-[11px] font-semibold" onClick={() => void decide(request, "approved")}>Approve</Button>
                    <Button size="sm" variant="outline" className="h-7 rounded-lg px-2.5 text-[11px] font-semibold" onClick={() => void decide(request, "rejected")}>Deny</Button>
                  </div>
                ) : null}
              </div>
            );
          }) : null}
          {recordedEntries.map((entry) => {
            const employee = workspace.profiles.find((profile) => profile.id === entry.employee_user_id);
            return (
              <div key={entry.id} className="grid gap-2.5 rounded-2xl border border-stone-200 bg-stone-50/55 p-2.5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <strong>{employee?.full_name || "Employee"}</strong>
                  <p className="text-[13px] text-stone-500">{entry.work_date} - {ENTRY_LABELS[entry.type] || entry.type} recorded in Timesheet</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Badge variant="secondary">Recorded</Badge>
                  {["vacation", "medical"].includes(entry.type) ? (
                    <label className="inline-flex h-7 cursor-pointer items-center rounded-lg border border-stone-200 bg-white px-2 text-[11px] font-semibold text-stone-800 hover:bg-stone-50">
                      {entry.attachment_path ? "Replace file" : "Attach file"}
                      <input
                        className="hidden"
                        type="file"
                        onChange={(event) => void attachRecordedEntryFile(entry, event.target.files?.[0] || null)}
                      />
                    </label>
                  ) : null}
                  {entry.attachment_path ? <Button size="sm" variant="outline" className="h-7 rounded-lg px-2 text-[11px] font-semibold" onClick={() => void downloadStorageFile(supabase, "leave-documents", entry.attachment_path || "")}><Download className="h-3.5 w-3.5" />File</Button> : null}
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
  const attentionRows = employees
    .map((employee) => ({ employee, totals: totalsFor(employee, month, workspace) }))
    .filter((row) => row.totals.difference < 0 || row.totals.overtime > 0 || row.totals.absenceDays > 0)
    .toSorted((a, b) => (a.totals.difference - b.totals.difference) || (b.totals.overtime - a.totals.overtime))
    .slice(0, 8);
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
  const exceptionMax = Math.max(1, ...departmentRows.map((row) => row.overtime + row.leave * 8 + row.absence * 8));
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Month Health</CardTitle>
              <CardDescription>{people} people in scope, {formatNumber(worked)}h worked from {formatNumber(expected)}h norm.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div>
                <div className="mb-2 flex items-end justify-between gap-3">
                  <span className="text-4xl font-black">{width}%</span>
                  <span className={cn("text-xl font-black", difference < 0 ? "text-rose-700" : "text-emerald-700")}>{difference > 0 ? "+" : ""}{formatNumber(difference)}h</span>
                </div>
                <div className="h-3 rounded-full bg-stone-100"><div className="h-3 rounded-full bg-emerald-700" style={{ width: `${width}%` }} /></div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm font-semibold">
                <div className="rounded-md bg-stone-50 p-3"><span className="block text-xs uppercase text-stone-500">OT</span>{formatNumber(overtime)}h</div>
                <div className="rounded-md bg-stone-50 p-3"><span className="block text-xs uppercase text-stone-500">Leave</span>{co + cm + se}d</div>
                <div className="rounded-md bg-stone-50 p-3"><span className="block text-xs uppercase text-stone-500">Absence</span>{ab}d</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Attention List</CardTitle>
              <CardDescription>People with missing hours, overtime, or absences.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {attentionRows.length ? attentionRows.map(({ employee, totals }) => (
                <div key={employee.id} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md bg-stone-50 p-2 text-sm font-semibold">
                  <span className="truncate">{employee.full_name}</span>
                  <span className="text-right">
                    <span className={totals.difference < 0 ? "text-rose-700" : "text-emerald-700"}>{totals.difference > 0 ? "+" : ""}{formatNumber(totals.difference)}h</span>
                    {totals.overtime ? <span className="ml-2 text-amber-700">{formatNumber(totals.overtime)}h OT</span> : null}
                    {totals.absenceDays ? <span className="ml-2 text-stone-900">{totals.absenceDays} AB</span> : null}
                  </span>
                </div>
              )) : <p className="text-sm font-semibold text-stone-500">No exceptions in this scope.</p>}
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Department Balance</CardTitle>
            <CardDescription>Worked and norm bars, with exceptions shown under each department.</CardDescription>
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
                  <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-2 bg-amber-400" style={{ width: `${Math.min(100, ((row.overtime + row.leave * 8 + row.absence * 8) / exceptionMax) * 100)}%` }} />
                  </div>
                </div>
                <p className="text-xs font-semibold text-stone-500">{row.employees} people - {formatNumber(row.overtime)}h OT - {row.leave} leave days - {row.absence} absences</p>
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
  activeCompany,
  supabase,
  onReload,
  onSignOut,
  onMessage
}: {
  workspace: Workspace;
  activeTab: string;
  activeCompany?: CompanyRow;
  supabase: SupabaseClient | null;
  onReload: () => void;
  onSignOut: () => Promise<void>;
  onMessage: (message: string) => void;
}) {
  if (activeTab === "companies") {
    return <ScopedCompanyManagement workspace={workspace} activeCompany={activeCompany} supabase={supabase} onReload={onReload} onMessage={onMessage} />;
  }
  if (activeTab === "admins") {
    return <AccountManagement mode="admins" workspace={workspace} supabase={supabase} onReload={onReload} onMessage={onMessage} />;
  }
  return <SettingsPage workspace={workspace} activeCompany={activeCompany} supabase={supabase} onReload={onReload} onSignOut={onSignOut} onMessage={onMessage} />;
}

type HolidayDraft = {
  date: string;
  name: string;
  countryCode: string;
};

function SettingsPage({
  workspace,
  activeCompany,
  supabase,
  onReload,
  onSignOut,
  onMessage
}: {
  workspace: Workspace;
  activeCompany?: CompanyRow;
  supabase: SupabaseClient | null;
  onReload: () => void;
  onSignOut: () => Promise<void>;
  onMessage: (message: string) => void;
}) {
  const [countryCode, setCountryCode] = React.useState("RO");
  const [holidayYear, setHolidayYear] = React.useState(String(new Date().getFullYear()));
  const [holidayCompanyId, setHolidayCompanyId] = React.useState(activeCompany?.id || "all");
  const [holidayDepartmentId, setHolidayDepartmentId] = React.useState("all");
  const [preview, setPreview] = React.useState<HolidayDraft[]>([]);
  const [manualDate, setManualDate] = React.useState("");
  const [manualName, setManualName] = React.useState("");
  const setupAllowed = ["admin_account", "payroll_admin"].includes(workspace.profile.role);
  const scopedDepartments = workspace.departments.filter((department) => holidayCompanyId !== "all" && department.company_id === holidayCompanyId);

  async function loadPublicHolidays() {
    const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${holidayYear}/${countryCode}`);
    if (!response.ok) {
      onMessage("Could not load public holidays for that country/year.");
      return;
    }
    const data = await response.json() as Array<{ date: string; localName?: string; name?: string; countryCode?: string }>;
    setPreview(data.map((holiday) => ({
      date: holiday.date,
      name: holiday.localName || holiday.name || "Holiday",
      countryCode: holiday.countryCode || countryCode
    })));
  }

  function addManualHoliday() {
    if (!manualDate || !manualName.trim()) return;
    setPreview((current) => [...current, { date: manualDate, name: manualName.trim(), countryCode }].toSorted((a, b) => a.date.localeCompare(b.date)));
    setManualDate("");
    setManualName("");
  }

  async function applyHolidays() {
    if (!supabase || !workspace.profile.environment_id || !setupAllowed || !preview.length) return;
    const rows = preview.map((holiday) => ({
      environment_id: workspace.profile.environment_id,
      company_id: holidayCompanyId === "all" ? null : holidayCompanyId,
      department_id: holidayDepartmentId === "all" ? null : holidayDepartmentId,
      country_code: holiday.countryCode,
      holiday_date: holiday.date,
      name: holiday.name,
      created_by: workspace.profile.id
    }));
    const { error } = await supabase.from("national_holidays").upsert(rows, { onConflict: "environment_id,company_id,department_id,country_code,holiday_date,name" });
    if (error) {
      onMessage(error.message);
      return;
    }
    onMessage(`${rows.length} holidays saved.`);
    setPreview([]);
    onReload();
  }

  async function deleteAdminAccount() {
    if (!supabase || workspace.profile.role !== "admin_account") return;
    const typed = window.prompt("This deletes your Admin Account, all companies, users, timesheets, leave requests, documents, and logs. Type DELETE TABLESHIFTS to continue.");
    if (typed !== "DELETE TABLESHIFTS") return;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      onMessage("Session expired. Please log in again.");
      return;
    }
    const response = await fetch("/api/delete-admin-environment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ confirm: "DELETE TABLESHIFTS" })
    });
    const body = await response.json();
    if (!response.ok) {
      onMessage(body.error || "Could not delete Admin Account.");
      return;
    }
    await onSignOut();
  }

  return (
    <div className="grid gap-3">
      <Card className="rounded-[22px] border-stone-200 shadow-none">
        <CardHeader className="pb-2.5">
          <CardTitle className="text-lg">National Holidays</CardTitle>
          <CardDescription className="text-[13px]">Load public holidays, adjust the list, and apply them to all companies or one scope.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-2.5 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-stone-500">
              Country
              <select className="h-9 rounded-md border border-stone-200 bg-white px-2 text-[13px] font-semibold normal-case tracking-normal text-stone-900" value={countryCode} onChange={(event) => setCountryCode(event.target.value)}>
                {COUNTRY_OPTIONS.map(([code, name]) => <option key={code} value={code}>{name} ({code})</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-stone-500">
              Year
              <input className="h-9 rounded-md border border-stone-200 px-3 text-[13px] font-semibold normal-case tracking-normal text-stone-900" value={holidayYear} onChange={(event) => setHolidayYear(event.target.value)} type="number" min="2020" max="2100" />
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-stone-500">
              Company
              <select className="h-9 rounded-md border border-stone-200 bg-white px-2 text-[13px] font-semibold normal-case tracking-normal text-stone-900" value={holidayCompanyId} onChange={(event) => {
                setHolidayCompanyId(event.target.value);
                setHolidayDepartmentId("all");
              }}>
                <option value="all">All companies</option>
                {accessibleCompanies(workspace).map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-black uppercase tracking-wide text-stone-500">
              Department
              <select className="h-9 rounded-md border border-stone-200 bg-white px-2 text-[13px] font-semibold normal-case tracking-normal text-stone-900" value={holidayDepartmentId} onChange={(event) => setHolidayDepartmentId(event.target.value)} disabled={holidayCompanyId === "all"}>
                <option value="all">All departments</option>
                {scopedDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </label>
            <div className="flex items-end">
              <Button size="sm" className="h-9 w-full text-xs" onClick={() => void loadPublicHolidays()} disabled={!setupAllowed}><CalendarDays className="h-4 w-4" />Load</Button>
            </div>
          </div>
          <div className="grid gap-2.5 md:grid-cols-[1fr_1.5fr_auto]">
            <input className="h-9 rounded-md border border-stone-200 px-3 text-[13px] font-semibold" type="date" value={manualDate} onChange={(event) => setManualDate(event.target.value)} />
            <input className="h-9 rounded-md border border-stone-200 px-3 text-[13px] font-semibold" value={manualName} onChange={(event) => setManualName(event.target.value)} placeholder="Manual holiday name" />
            <Button size="sm" variant="outline" className="h-9 text-xs" onClick={addManualHoliday}>Add manual</Button>
          </div>
          <div className="grid max-h-72 gap-2 overflow-auto">
            {preview.length ? preview.map((holiday) => (
              <div key={`${holiday.date}-${holiday.name}`} className="flex items-center justify-between gap-3 rounded-md bg-stone-50 p-2 text-[13px] font-semibold">
                <span>{holiday.date} - {holiday.name}</span>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setPreview((current) => current.filter((item) => item !== holiday))}><X className="h-4 w-4" />Remove</Button>
              </div>
            )) : <p className="text-sm font-semibold text-stone-500">Load holidays or add them manually before applying.</p>}
          </div>
          <div className="flex justify-end">
            <Button size="sm" className="h-9 text-xs" onClick={() => void applyHolidays()} disabled={!setupAllowed || !preview.length}>Apply holidays</Button>
          </div>
        </CardContent>
      </Card>

      {workspace.profile.role === "admin_account" ? (
        <Card className="rounded-[22px] border-rose-200 shadow-none">
          <CardHeader className="pb-2.5">
            <CardTitle className="text-lg">Admin Account Danger Area</CardTitle>
            <CardDescription className="text-[13px]">Delete this Admin Account and all associated company data.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" className="h-9 bg-rose-700 text-xs text-white hover:bg-rose-800" onClick={() => void deleteAdminAccount()}><Trash2 className="h-4 w-4" />Delete Admin Account</Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function CompanyDepartmentManagement({
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
  const [departmentName, setDepartmentName] = React.useState("");
  const [shiftHours, setShiftHours] = React.useState("8");
  const [managerId, setManagerId] = React.useState("");
  const [teamLeaderId, setTeamLeaderId] = React.useState("");
  const [expandedDepartmentId, setExpandedDepartmentId] = React.useState("");
  const [sidePanel, setSidePanel] = React.useState<
    | { type: "department"; companyId: string }
    | { type: "company"; companyId: string }
    | { type: "employee"; companyId: string; departmentId: string }
    | null
  >(null);
  const [editingCompanyName, setEditingCompanyName] = React.useState<Record<string, string>>({});
  const [colorDrafts, setColorDrafts] = React.useState<Record<string, Record<string, string>>>({});
  const [logoUrls, setLogoUrls] = React.useState<Record<string, string>>({});
  const [departmentDrafts, setDepartmentDrafts] = React.useState<Record<string, { name: string; manager: string; leader: string; hours: string; days: number[] }>>({});
  const selectedCompany = activeCompany || accessibleCompanies(workspace)[0];
  const targetCompanyId = selectedCompany?.id || "";
  const scopedDepartments = workspace.departments.filter((department) => department.company_id === targetCompanyId);
  const scopedUsers = workspace.profiles.filter((profile) => profile.company_id === targetCompanyId || companyIdsForProfile(profile, workspace).has(targetCompanyId));
  const companyManagers = workspace.profiles.filter((profile) => (
    ["department_manager", "company_manager"].includes(profile.role) &&
    (profile.company_id === targetCompanyId || profile.role === "company_manager")
  ));
  const assignedTeamLeaderIds = new Set(workspace.departments.map((department) => department.team_leader_user_id).filter(Boolean));
  const teamLeaders = workspace.profiles.filter((profile) => (
    profile.role === "team_leader" &&
    profile.company_id === targetCompanyId &&
    !assignedTeamLeaderIds.has(profile.id)
  ));

  React.useEffect(() => {
    setEditingCompanyName((current) => {
      const next = { ...current };
      workspace.companies.forEach((company) => {
        if (next[company.id] === undefined) next[company.id] = company.name;
      });
      return next;
    });
    setColorDrafts((current) => {
      const next = { ...current };
      workspace.companies.forEach((company) => {
        if (!next[company.id]) next[company.id] = { ...DEFAULT_ENTRY_COLORS, ...(company.entry_colors || {}) };
      });
      return next;
    });
    setDepartmentDrafts((current) => {
      const next = { ...current };
      workspace.departments.forEach((department) => {
        if (!next[department.id]) {
          next[department.id] = {
            name: department.name,
            manager: department.manager_user_id || "",
            leader: department.team_leader_user_id || "",
            hours: String(department.shift_hours || 8),
            days: department.work_days?.length ? department.work_days : [1, 2, 3, 4, 5]
          };
        }
      });
      return next;
    });
  }, [workspace.companies, workspace.departments]);

  React.useEffect(() => {
    if (!selectedCompany) return;
    setExpandedDepartmentId("");
    setSidePanel(null);
  }, [selectedCompany?.id]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadLogos() {
      if (!supabase) return;
      const entries = await Promise.all(workspace.companies.map(async (company) => {
        if (!company.logo_path) return [company.id, ""] as const;
        const { data } = await supabase.storage.from("company-logos").createSignedUrl(company.logo_path, 60 * 20);
        return [company.id, data?.signedUrl || ""] as const;
      }));
      if (!cancelled) setLogoUrls(Object.fromEntries(entries));
    }
    void loadLogos();
    return () => {
      cancelled = true;
    };
  }, [supabase, workspace.companies]);

  async function updateCompany(company: CompanyRow) {
    if (!supabase) return;
    const { error } = await supabase
      .from("companies")
      .update({
        name: editingCompanyName[company.id]?.trim() || company.name,
        entry_colors: colorDrafts[company.id] || company.entry_colors || {}
      })
      .eq("id", company.id);
    if (error) {
      onMessage(error.message);
      return;
    }
    onReload();
  }

  async function uploadCompanyLogo(company: CompanyRow, file: File | null) {
    if (!supabase || !workspace.profile.environment_id || !file) return;
    const safeName = file.name.replace(/[^a-z0-9._-]+/gi, "-");
    const path = `${workspace.profile.environment_id}/${company.id}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("company-logos").upload(path, file, { upsert: true });
    if (error) {
      onMessage(error.message);
      return;
    }
    const { error: updateError } = await supabase.from("companies").update({ logo_path: path }).eq("id", company.id);
    if (updateError) {
      onMessage(updateError.message);
      return;
    }
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
    setSidePanel(null);
    onReload();
  }

  async function updateDepartment(department: DepartmentRow) {
    if (!supabase) return;
    const draft = departmentDrafts[department.id];
    if (!draft) return;
    const { error } = await supabase.from("departments").update({
      name: draft.name.trim() || department.name,
      manager_user_id: draft.manager || null,
      team_leader_user_id: draft.leader || null,
      shift_hours: Number(draft.hours || 8),
      work_days: draft.days.length ? draft.days : [1, 2, 3, 4, 5]
    }).eq("id", department.id);
    if (error) {
      onMessage(error.message);
      return;
    }
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

  if (!selectedCompany) {
    return (
      <Card className="rounded-[22px] border-stone-200 shadow-none">
        <CardContent className="p-5">
          <p className="text-sm font-semibold text-stone-600">Create a company from the sidebar to start building the hierarchy.</p>
        </CardContent>
      </Card>
    );
  }

  const companyManagerOptions = workspace.profiles.filter((profile) => (
    ["department_manager", "company_manager"].includes(profile.role) &&
    (profile.company_id === selectedCompany.id || companyIdsForProfile(profile, workspace).has(selectedCompany.id))
  ));
  const colors = colorDrafts[selectedCompany.id] || DEFAULT_ENTRY_COLORS;

  return (
    <div className={cn("grid gap-3", sidePanel && "xl:grid-cols-[minmax(0,1fr)_430px]")}>
      <Card className="min-w-0 rounded-[22px] border-stone-200 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Company Hierarchy</CardTitle>
          <CardDescription className="text-xs">Selected company scope: {selectedCompany.name}.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2.5">
          <div className="min-w-0 rounded-[18px] border border-stone-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-stone-200 bg-stone-50">
                  {logoUrls[selectedCompany.id] ? <img src={logoUrls[selectedCompany.id]} alt="" className="h-full w-full object-contain" /> : <Building2 className="h-5 w-5 text-stone-500" />}
                </div>
                <div className="min-w-0">
                  <strong className="block truncate text-[14px]">{selectedCompany.name}</strong>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-bold text-stone-600">{scopedDepartments.length} departments</span>
                    <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-bold text-stone-600">{scopedUsers.length} users</span>
                    <Button size="sm" className="h-7 rounded-lg px-2 text-[11px] font-semibold" onClick={() => setSidePanel({ type: "department", companyId: selectedCompany.id })}><Plus className="h-3.5 w-3.5" />Create Department</Button>
                    <Button size="sm" variant="outline" className="h-7 rounded-lg px-2 text-[11px] font-semibold" onClick={() => setSidePanel({ type: "company", companyId: selectedCompany.id })}>Edit</Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-2 border-t border-stone-200 pt-3">
              {scopedDepartments.length ? scopedDepartments.map((department) => {
                const isOpen = expandedDepartmentId === department.id;
                const draft = departmentDrafts[department.id] || {
                  name: department.name,
                  manager: department.manager_user_id || "",
                  leader: department.team_leader_user_id || "",
                  hours: String(department.shift_hours || 8),
                  days: department.work_days?.length ? department.work_days : [1, 2, 3, 4, 5]
                };
                const teamLeaderOptions = workspace.profiles.filter((profile) => {
                  const assignedDepartment = workspace.departments.find((item) => item.team_leader_user_id === profile.id);
                  return profile.role === "team_leader" &&
                    profile.company_id === selectedCompany.id &&
                    (!assignedDepartment || assignedDepartment.id === department.id);
                });
                const departmentUsers = workspace.profiles.filter((profile) => profile.department_id === department.id);
                return (
                  <div key={department.id} className="rounded-xl border border-stone-200 bg-stone-50 p-2.5">
                    <button
                      type="button"
                      className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                      onClick={() => setExpandedDepartmentId(isOpen ? "" : department.id)}
                    >
                      <div className="min-w-0">
                        <strong className="block truncate text-[13px]">{department.name}</strong>
                        <p className="text-[11px] font-semibold text-stone-500">
                          {departmentUsers.length} users - {department.shift_hours || 8}h shift
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-lg px-2 text-[11px] font-semibold"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSidePanel({ type: "employee", companyId: selectedCompany.id, departmentId: department.id });
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />Create Employee
                        </Button>
                        {isOpen ? <ChevronDown className="h-4 w-4 text-stone-500" /> : <ChevronRight className="h-4 w-4 text-stone-500" />}
                      </div>
                    </button>

                    {isOpen ? (
                      <div className="mt-2 grid gap-2 border-t border-stone-200 pt-2">
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_156px]">
                            <label className="grid gap-1 min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Company name</span>
                          <input
                            className="h-8 rounded-md border border-stone-200 px-3 text-[13px] font-semibold"
                            value={editingCompanyName[selectedCompany.id] || selectedCompany.name}
                            onChange={(event) => setEditingCompanyName((current) => ({ ...current, [selectedCompany.id]: event.target.value }))}
                            placeholder="Company name"
                          />
                        </label>
                        <label className="grid gap-1 min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Logo</span>
                          <span className="flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-[12px] font-semibold">
                            <ImageIcon className="h-4 w-4" />Upload
                            <input className="hidden" type="file" accept="image/*" onChange={(event) => void uploadCompanyLogo(selectedCompany, event.target.files?.[0] || null)} />
                          </span>
                        </label>
                      </div>
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5 text-[11px] font-semibold" onClick={() => void deleteCompany(selectedCompany)}><Trash2 className="h-4 w-4" />Delete</Button>
                        <Button size="sm" className="h-8 rounded-lg px-2.5 text-[11px] font-semibold" onClick={() => void updateCompany(selectedCompany)}><Save className="h-4 w-4" />Save</Button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-stone-200 bg-stone-50 p-2.5">
                      <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-stone-500"><Palette className="h-3.5 w-3.5" />Timesheet Colors</p>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                        {ENTRY_COLOR_KEYS.map(([key]) => (
                          <label key={key} className="grid justify-items-center gap-1 text-center text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">
                            {ENTRY_COLOR_LABELS[key]}
                            <div className="flex h-8 w-full min-w-0 items-center gap-2 rounded-md border border-stone-200 bg-white px-2">
                              <input
                                className="h-5 w-7 border-0 bg-transparent p-0"
                                type="color"
                                value={colors[key] || DEFAULT_ENTRY_COLORS[key]}
                                onChange={(event) => setColorDrafts((current) => ({
                                  ...current,
                                [selectedCompany.id]: { ...(current[selectedCompany.id] || DEFAULT_ENTRY_COLORS), [key]: event.target.value }
                              }))}
                            />
                            <input
                              className="min-w-0 flex-1 bg-transparent text-xs font-semibold normal-case tracking-normal text-stone-900 outline-none"
                              value={colors[key] || DEFAULT_ENTRY_COLORS[key]}
                              onChange={(event) => setColorDrafts((current) => ({
                                ...current,
                                [selectedCompany.id]: { ...(current[selectedCompany.id] || DEFAULT_ENTRY_COLORS), [key]: event.target.value }
                              }))}
                            />
                          </div>
                          </label>
                        ))}
                      </div>
                    </div>

                            <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_88px]">
                              <label className="grid gap-1 min-w-0">
                                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">Name</span>
                                <input
                                  className="h-8 min-w-0 rounded-md border border-stone-200 px-2 text-[12px] font-semibold"
                                  value={draft.name}
                                  onChange={(event) => setDepartmentDrafts((current) => ({ ...current, [department.id]: { ...draft, name: event.target.value } }))}
                                />
                              </label>
                              <label className="grid gap-1 min-w-0">
                                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">Manager</span>
                                <select
                                  className="h-8 min-w-0 rounded-md border border-stone-200 bg-white px-2 text-[12px] font-semibold"
                                  value={draft.manager}
                                  onChange={(event) => setDepartmentDrafts((current) => ({ ...current, [department.id]: { ...draft, manager: event.target.value } }))}
                                >
                                  <option value="">No manager</option>
                                  {companyManagerOptions.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
                                </select>
                              </label>
                              <label className="grid gap-1 min-w-0">
                                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">Team Leader</span>
                                <select
                                  className="h-8 min-w-0 rounded-md border border-stone-200 bg-white px-2 text-[12px] font-semibold"
                                  value={draft.leader}
                                  onChange={(event) => setDepartmentDrafts((current) => ({ ...current, [department.id]: { ...draft, leader: event.target.value } }))}
                                >
                                  <option value="">No team leader</option>
                                  {teamLeaderOptions.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
                                </select>
                              </label>
                              <select
                                className="self-end h-8 rounded-md border border-stone-200 bg-white px-2 text-[12px] font-semibold"
                                value={draft.hours}
                                onChange={(event) => setDepartmentDrafts((current) => ({ ...current, [department.id]: { ...draft, hours: event.target.value } }))}
                              >
                                {Array.from({ length: 24 }, (_, index) => String(index + 1)).map((hour) => <option key={hour} value={hour}>{hour}h</option>)}
                              </select>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {([
                                ["Mon", 1],
                                ["Tue", 2],
                                ["Wed", 3],
                                ["Thu", 4],
                                ["Fri", 5],
                                ["Sat", 6],
                                ["Sun", 0]
                              ] as const).map(([day, index]) => (
                                <label key={day} className="flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-bold">
                                  <input
                                    type="checkbox"
                                    checked={draft.days.includes(index)}
                                    onChange={(event) => setDepartmentDrafts((current) => ({
                                      ...current,
                                      [department.id]: {
                                        ...draft,
                                        days: event.target.checked ? Array.from(new Set([...draft.days, index])).sort() : draft.days.filter((value) => value !== index)
                                      }
                                    }))}
                                  />
                                  {day}
                                </label>
                              ))}
                            </div>
                            <div className="flex flex-wrap justify-end gap-2 pt-0.5">
                              <Button size="sm" variant="outline" className="h-8 rounded-lg px-2 text-[11px] font-semibold" onClick={() => void deleteDepartment(department)}><Trash2 className="h-4 w-4" />Delete</Button>
                              <Button size="sm" className="h-8 rounded-lg px-2 text-[11px] font-semibold" onClick={() => void updateDepartment(department)}><Save className="h-4 w-4" />Save</Button>
                            </div>
                      </div>
                    ) : null}
                  </div>
                );
              }) : <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50 p-4 text-sm font-semibold text-stone-500">No departments yet. Use Create Department from the company header.</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {sidePanel ? (
        <Card className="min-w-0 self-start rounded-[22px] border-stone-200 shadow-none">
          <CardHeader className="pb-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">
                  {sidePanel.type === "department" ? "Create Department" : sidePanel.type === "company" ? "Company Settings" : "Create Employee"}
                </CardTitle>
                <CardDescription className="text-xs">{selectedCompany.name}</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="h-7 rounded-lg px-2 text-[11px] font-semibold" onClick={() => setSidePanel(null)}>Close</Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {sidePanel.type === "department" ? (
              <div className="grid gap-2">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Department</span>
                  <input className="h-8 rounded-md border border-stone-200 px-3 text-[13px] font-semibold" value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} placeholder="Department name" />
                </label>
                <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-2">
                  <label className="grid gap-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Shift</span>
                    <select className="h-8 rounded-md border border-stone-200 bg-white px-2 text-[13px] font-semibold" value={shiftHours} onChange={(event) => setShiftHours(event.target.value)}>
                      {Array.from({ length: 24 }, (_, index) => String(index + 1)).map((hour) => <option key={hour} value={hour}>{hour}h</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Manager</span>
                    <select className="h-8 min-w-0 rounded-md border border-stone-200 bg-white px-2 text-[13px] font-semibold" value={managerId} onChange={(event) => setManagerId(event.target.value)}>
                      <option value="">No manager</option>
                      {companyManagers.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
                    </select>
                  </label>
                </div>
                <label className="grid gap-1 min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Team leader</span>
                  <select className="h-8 min-w-0 rounded-md border border-stone-200 bg-white px-2 text-[13px] font-semibold" value={teamLeaderId} onChange={(event) => setTeamLeaderId(event.target.value)}>
                    <option value="">No team leader</option>
                    {teamLeaders.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
                  </select>
                </label>
                <Button size="sm" className="h-8 rounded-lg text-[11px] font-semibold" onClick={() => void createDepartment()}><Plus className="h-4 w-4" />Create Department</Button>
              </div>
            ) : null}

            {sidePanel.type === "company" ? (
              <div className="grid gap-3">
                <label className="grid gap-1 min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Company name</span>
                  <input
                    className="h-8 rounded-md border border-stone-200 px-3 text-[13px] font-semibold"
                    value={editingCompanyName[selectedCompany.id] || selectedCompany.name}
                    onChange={(event) => setEditingCompanyName((current) => ({ ...current, [selectedCompany.id]: event.target.value }))}
                    placeholder="Company name"
                  />
                </label>
                <label className="grid gap-1 min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Logo</span>
                  <span className="flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-[12px] font-semibold">
                    <ImageIcon className="h-4 w-4" />Upload logo
                    <input className="hidden" type="file" accept="image/*" onChange={(event) => void uploadCompanyLogo(selectedCompany, event.target.files?.[0] || null)} />
                  </span>
                </label>
                <div className="grid gap-2 rounded-xl border border-stone-200 bg-stone-50 p-2.5">
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-stone-500"><Palette className="h-3.5 w-3.5" />Timesheet Colors</p>
                  {ENTRY_COLOR_KEYS.map(([key]) => (
                    <label key={key} className="grid gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">
                      {ENTRY_COLOR_LABELS[key]}
                      <div className="flex h-8 items-center gap-2 rounded-md border border-stone-200 bg-white px-2">
                        <input
                          className="h-5 w-7 border-0 bg-transparent p-0"
                          type="color"
                          value={colors[key] || DEFAULT_ENTRY_COLORS[key]}
                          onChange={(event) => setColorDrafts((current) => ({
                            ...current,
                            [selectedCompany.id]: { ...(current[selectedCompany.id] || DEFAULT_ENTRY_COLORS), [key]: event.target.value }
                          }))}
                        />
                        <input
                          className="min-w-0 flex-1 bg-transparent text-xs font-semibold normal-case tracking-normal text-stone-900 outline-none"
                          value={colors[key] || DEFAULT_ENTRY_COLORS[key]}
                          onChange={(event) => setColorDrafts((current) => ({
                            ...current,
                            [selectedCompany.id]: { ...(current[selectedCompany.id] || DEFAULT_ENTRY_COLORS), [key]: event.target.value }
                          }))}
                        />
                      </div>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5 text-[11px] font-semibold" onClick={() => void deleteCompany(selectedCompany)}><Trash2 className="h-4 w-4" />Delete</Button>
                  <Button size="sm" className="h-8 rounded-lg px-2.5 text-[11px] font-semibold" onClick={() => void updateCompany(selectedCompany)}><Save className="h-4 w-4" />Save</Button>
                </div>
              </div>
            ) : null}

            {sidePanel.type === "employee" ? (
              <AccountManagement
                mode="employees"
                workspace={workspace}
                supabase={supabase}
                onReload={onReload}
                onMessage={onMessage}
                scopeCompanyId={sidePanel.companyId}
                scopeDepartmentId={sidePanel.departmentId}
                hideList
                compact
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ScopedCompanyManagement({
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
  const selectedCompany = activeCompany || accessibleCompanies(workspace)[0];
  const [sidePanel, setSidePanel] = React.useState<
    | { type: "department" }
    | { type: "company" }
    | { type: "employee"; departmentId: string }
    | null
  >(null);
  const [expandedDepartmentId, setExpandedDepartmentId] = React.useState("");
  const [departmentName, setDepartmentName] = React.useState("");
  const [shiftHours, setShiftHours] = React.useState("8");
  const [managerId, setManagerId] = React.useState("");
  const [teamLeaderId, setTeamLeaderId] = React.useState("");
  const [editingCompanyName, setEditingCompanyName] = React.useState<Record<string, string>>({});
  const [colorDrafts, setColorDrafts] = React.useState<Record<string, Record<string, string>>>({});
  const [logoUrls, setLogoUrls] = React.useState<Record<string, string>>({});
  const [departmentDrafts, setDepartmentDrafts] = React.useState<Record<string, { name: string; manager: string; leader: string; hours: string; days: number[] }>>({});

  const companyId = selectedCompany?.id || "";
  const departments = workspace.departments.filter((department) => department.company_id === companyId);
  const companyUsers = workspace.profiles.filter((profile) => profile.company_id === companyId || companyIdsForProfile(profile, workspace).has(companyId));
  const companyManagers = workspace.profiles.filter((profile) => (
    ["department_manager", "company_manager"].includes(profile.role) &&
    (profile.company_id === companyId || companyIdsForProfile(profile, workspace).has(companyId))
  ));
  const assignedTeamLeaderIds = new Set(workspace.departments.map((department) => department.team_leader_user_id).filter(Boolean));
  const availableTeamLeaders = workspace.profiles.filter((profile) => (
    profile.role === "team_leader" &&
    profile.company_id === companyId &&
    !assignedTeamLeaderIds.has(profile.id)
  ));

  React.useEffect(() => {
    setExpandedDepartmentId("");
    setSidePanel(null);
    setDepartmentName("");
    setManagerId("");
    setTeamLeaderId("");
  }, [companyId]);

  React.useEffect(() => {
    setEditingCompanyName((current) => {
      const next = { ...current };
      workspace.companies.forEach((company) => {
        if (next[company.id] === undefined) next[company.id] = company.name;
      });
      return next;
    });
    setColorDrafts((current) => {
      const next = { ...current };
      workspace.companies.forEach((company) => {
        if (!next[company.id]) next[company.id] = { ...DEFAULT_ENTRY_COLORS, ...(company.entry_colors || {}) };
      });
      return next;
    });
    setDepartmentDrafts((current) => {
      const next = { ...current };
      workspace.departments.forEach((department) => {
        if (!next[department.id]) {
          next[department.id] = {
            name: department.name,
            manager: department.manager_user_id || "",
            leader: department.team_leader_user_id || "",
            hours: String(department.shift_hours || 8),
            days: department.work_days?.length ? department.work_days : [1, 2, 3, 4, 5]
          };
        }
      });
      return next;
    });
  }, [workspace.companies, workspace.departments]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadLogos() {
      if (!supabase) return;
      const entries = await Promise.all(workspace.companies.map(async (company) => {
        if (!company.logo_path) return [company.id, ""] as const;
        const { data } = await supabase.storage.from("company-logos").createSignedUrl(company.logo_path, 60 * 20);
        return [company.id, data?.signedUrl || ""] as const;
      }));
      if (!cancelled) setLogoUrls(Object.fromEntries(entries));
    }
    void loadLogos();
    return () => {
      cancelled = true;
    };
  }, [supabase, workspace.companies]);

  async function createDepartment() {
    if (!supabase || !workspace.profile.environment_id || !selectedCompany || !departmentName.trim()) return;
    const { error } = await supabase.from("departments").insert({
      environment_id: workspace.profile.environment_id,
      company_id: selectedCompany.id,
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
    setSidePanel(null);
    onReload();
  }

  async function updateCompany(company: CompanyRow) {
    if (!supabase) return;
    const { error } = await supabase.from("companies").update({
      name: editingCompanyName[company.id]?.trim() || company.name,
      entry_colors: colorDrafts[company.id] || company.entry_colors || {}
    }).eq("id", company.id);
    if (error) {
      onMessage(error.message);
      return;
    }
    onReload();
  }

  async function uploadCompanyLogo(company: CompanyRow, file: File | null) {
    if (!supabase || !workspace.profile.environment_id || !file) return;
    const safeName = file.name.replace(/[^a-z0-9._-]+/gi, "-");
    const path = `${workspace.profile.environment_id}/${company.id}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("company-logos").upload(path, file, { upsert: true });
    if (error) {
      onMessage(error.message);
      return;
    }
    const { error: updateError } = await supabase.from("companies").update({ logo_path: path }).eq("id", company.id);
    if (updateError) {
      onMessage(updateError.message);
      return;
    }
    onReload();
  }

  async function updateDepartment(department: DepartmentRow) {
    if (!supabase) return;
    const draft = departmentDrafts[department.id];
    if (!draft) return;
    const { error } = await supabase.from("departments").update({
      name: draft.name.trim() || department.name,
      manager_user_id: draft.manager || null,
      team_leader_user_id: draft.leader || null,
      shift_hours: Number(draft.hours || 8),
      work_days: draft.days.length ? draft.days : [1, 2, 3, 4, 5]
    }).eq("id", department.id);
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

  if (!selectedCompany) {
    return (
      <Card className="rounded-[22px] border-stone-200 shadow-none">
        <CardContent className="p-5">
          <p className="text-sm font-semibold text-stone-600">Create a company from the sidebar to start building the hierarchy.</p>
        </CardContent>
      </Card>
    );
  }

  const colors = colorDrafts[selectedCompany.id] || DEFAULT_ENTRY_COLORS;

  return (
    <div className={cn("grid gap-3", sidePanel && "xl:grid-cols-[minmax(0,1fr)_360px]")}>
      <Card className="min-w-0 rounded-[22px] border-stone-200 shadow-none">
        <CardHeader className="pb-2.5">
          <CardTitle className="text-base">Company Hierarchy</CardTitle>
          <CardDescription className="text-xs">All management actions are scoped to {selectedCompany.name}.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="rounded-[18px] border border-stone-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-stone-200 bg-stone-50">
                  {logoUrls[selectedCompany.id] ? <img src={logoUrls[selectedCompany.id]} alt="" className="h-full w-full object-contain" /> : <Building2 className="h-5 w-5 text-stone-500" />}
                </div>
                <div className="min-w-0">
                  <strong className="block truncate text-sm">{selectedCompany.name}</strong>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-bold text-stone-600">{departments.length} departments</span>
                    <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-bold text-stone-600">{companyUsers.length} users</span>
                    <Button size="sm" className="h-7 rounded-lg px-2 text-[11px] font-semibold" onClick={() => setSidePanel({ type: "department" })}><Plus className="h-3.5 w-3.5" />Create Department</Button>
                    <Button size="sm" variant="outline" className="h-7 rounded-lg px-2 text-[11px] font-semibold" onClick={() => setSidePanel({ type: "company" })}>Edit</Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-2 border-t border-stone-200 pt-3">
              {departments.length ? departments.map((department) => {
                const draft = departmentDrafts[department.id] || {
                  name: department.name,
                  manager: department.manager_user_id || "",
                  leader: department.team_leader_user_id || "",
                  hours: String(department.shift_hours || 8),
                  days: department.work_days?.length ? department.work_days : [1, 2, 3, 4, 5]
                };
                const departmentUsers = workspace.profiles.filter((profile) => profile.department_id === department.id);
                const isOpen = expandedDepartmentId === department.id;
                const teamLeaderOptions = workspace.profiles.filter((profile) => {
                  const assignedDepartment = workspace.departments.find((item) => item.team_leader_user_id === profile.id);
                  return profile.role === "team_leader" &&
                    profile.company_id === selectedCompany.id &&
                    (!assignedDepartment || assignedDepartment.id === department.id);
                });
                return (
                  <div key={department.id} className="rounded-xl border border-stone-200 bg-stone-50 p-2.5">
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setExpandedDepartmentId(isOpen ? "" : department.id)}
                      >
                        <strong className="block text-[13px]">{department.name}</strong>
                        <span className="text-[11px] font-semibold text-stone-500">{departmentUsers.length} users - {department.shift_hours || 8}h shift</span>
                      </button>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-lg px-2 text-[11px] font-semibold"
                          onClick={(event) => {
                            setSidePanel({ type: "employee", departmentId: department.id });
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />Create Employee
                        </Button>
                        <button
                          type="button"
                          className="rounded-md p-1 text-stone-500 hover:bg-white"
                          onClick={() => setExpandedDepartmentId(isOpen ? "" : department.id)}
                          aria-label={isOpen ? "Collapse department" : "Expand department"}
                        >
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    {isOpen ? (
                      <div className="mt-2 grid gap-2 border-t border-stone-200 pt-2">
                        <div className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_88px]">
                          <label className="grid gap-1 min-w-0">
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">Name</span>
                            <input className="h-8 min-w-0 rounded-md border border-stone-200 px-2 text-[12px] font-semibold" value={draft.name} onChange={(event) => setDepartmentDrafts((current) => ({ ...current, [department.id]: { ...draft, name: event.target.value } }))} />
                          </label>
                          <label className="grid gap-1 min-w-0">
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">Manager</span>
                            <select className="h-8 min-w-0 rounded-md border border-stone-200 bg-white px-2 text-[12px] font-semibold" value={draft.manager} onChange={(event) => setDepartmentDrafts((current) => ({ ...current, [department.id]: { ...draft, manager: event.target.value } }))}>
                              <option value="">No manager</option>
                              {companyManagers.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
                            </select>
                          </label>
                          <label className="grid gap-1 min-w-0">
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">Team Leader</span>
                            <select className="h-8 min-w-0 rounded-md border border-stone-200 bg-white px-2 text-[12px] font-semibold" value={draft.leader} onChange={(event) => setDepartmentDrafts((current) => ({ ...current, [department.id]: { ...draft, leader: event.target.value } }))}>
                              <option value="">No team leader</option>
                              {teamLeaderOptions.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
                            </select>
                          </label>
                          <select className="self-end h-8 rounded-md border border-stone-200 bg-white px-2 text-[12px] font-semibold" value={draft.hours} onChange={(event) => setDepartmentDrafts((current) => ({ ...current, [department.id]: { ...draft, hours: event.target.value } }))}>
                            {Array.from({ length: 24 }, (_, index) => String(index + 1)).map((hour) => <option key={hour} value={hour}>{hour}h</option>)}
                          </select>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {([
                            ["Mon", 1],
                            ["Tue", 2],
                            ["Wed", 3],
                            ["Thu", 4],
                            ["Fri", 5],
                            ["Sat", 6],
                            ["Sun", 0]
                          ] as const).map(([day, index]) => (
                            <label key={day} className="flex items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-bold">
                              <input
                                type="checkbox"
                                checked={draft.days.includes(index)}
                                onChange={(event) => setDepartmentDrafts((current) => ({
                                  ...current,
                                  [department.id]: {
                                    ...draft,
                                    days: event.target.checked ? Array.from(new Set([...draft.days, index])).sort() : draft.days.filter((value) => value !== index)
                                  }
                                }))}
                              />
                              {day}
                            </label>
                          ))}
                        </div>
                        <div className="rounded-lg border border-stone-200 bg-white p-2">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">Employees</p>
                            <span className="text-[11px] font-semibold text-stone-500">{departmentUsers.length} in department</span>
                          </div>
                          {departmentUsers.length ? (
                            <div className="grid gap-1">
                              {departmentUsers
                                .toSorted((a, b) => a.full_name.localeCompare(b.full_name))
                                .map((profile) => (
                                  <div key={profile.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md bg-stone-50 px-2 py-1.5">
                                    <div className="min-w-0">
                                      <strong className="block truncate text-[12px]">{profile.full_name}</strong>
                                      <span className="block truncate text-[11px] font-semibold text-stone-500">{profile.position || ROLES[profile.role]} - {profile.email}</span>
                                    </div>
                                    <Badge variant="secondary" className="text-[10px]">{ROLES[profile.role]}</Badge>
                                  </div>
                                ))}
                            </div>
                          ) : (
                            <p className="text-[12px] font-semibold text-stone-500">No employees in this department yet.</p>
                          )}
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="outline" className="h-8 rounded-lg px-2 text-[11px] font-semibold" onClick={() => void deleteDepartment(department)}><Trash2 className="h-4 w-4" />Delete</Button>
                          <Button size="sm" className="h-8 rounded-lg px-2 text-[11px] font-semibold" onClick={() => void updateDepartment(department)}><Save className="h-4 w-4" />Save</Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              }) : (
                <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50 p-4 text-sm font-semibold text-stone-500">No departments yet. Create one from the company header.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {sidePanel ? (
        <Card className="min-w-0 self-start rounded-[22px] border-stone-200 shadow-none">
          <CardHeader className="pb-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{sidePanel.type === "department" ? "Create Department" : sidePanel.type === "company" ? "Company Settings" : "Create Employee"}</CardTitle>
                <CardDescription className="text-xs">{selectedCompany.name}</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="h-7 rounded-lg px-2 text-[11px] font-semibold" onClick={() => setSidePanel(null)}>Close</Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {sidePanel.type === "department" ? (
              <div className="grid gap-2">
                <label className="grid gap-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Department</span>
                  <input className="h-8 rounded-md border border-stone-200 px-3 text-[13px] font-semibold" value={departmentName} onChange={(event) => setDepartmentName(event.target.value)} placeholder="Department name" />
                </label>
                <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-2">
                  <label className="grid gap-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Shift</span>
                    <select className="h-8 rounded-md border border-stone-200 bg-white px-2 text-[13px] font-semibold" value={shiftHours} onChange={(event) => setShiftHours(event.target.value)}>
                      {Array.from({ length: 24 }, (_, index) => String(index + 1)).map((hour) => <option key={hour} value={hour}>{hour}h</option>)}
                    </select>
                  </label>
                  <label className="grid gap-1 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Manager</span>
                    <select className="h-8 min-w-0 rounded-md border border-stone-200 bg-white px-2 text-[13px] font-semibold" value={managerId} onChange={(event) => setManagerId(event.target.value)}>
                      <option value="">No manager</option>
                      {companyManagers.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
                    </select>
                  </label>
                </div>
                <label className="grid gap-1 min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Team leader</span>
                  <select className="h-8 min-w-0 rounded-md border border-stone-200 bg-white px-2 text-[13px] font-semibold" value={teamLeaderId} onChange={(event) => setTeamLeaderId(event.target.value)}>
                    <option value="">No team leader</option>
                    {availableTeamLeaders.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
                  </select>
                </label>
                <Button size="sm" className="h-8 rounded-lg text-[11px] font-semibold" onClick={() => void createDepartment()}><Plus className="h-4 w-4" />Create Department</Button>
              </div>
            ) : null}

            {sidePanel.type === "company" ? (
              <div className="grid gap-3">
                <label className="grid gap-1 min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Company name</span>
                  <input className="h-8 rounded-md border border-stone-200 px-3 text-[13px] font-semibold" value={editingCompanyName[selectedCompany.id] || selectedCompany.name} onChange={(event) => setEditingCompanyName((current) => ({ ...current, [selectedCompany.id]: event.target.value }))} placeholder="Company name" />
                </label>
                <label className="grid gap-1 min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Logo</span>
                  <span className="flex h-8 cursor-pointer items-center justify-center gap-2 rounded-md border border-stone-200 bg-white px-3 text-[12px] font-semibold">
                    <ImageIcon className="h-4 w-4" />Upload logo
                    <input className="hidden" type="file" accept="image/*" onChange={(event) => void uploadCompanyLogo(selectedCompany, event.target.files?.[0] || null)} />
                  </span>
                </label>
                <div className="grid gap-2 rounded-xl border border-stone-200 bg-stone-50 p-2.5">
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-stone-500"><Palette className="h-3.5 w-3.5" />Timesheet Colors</p>
                  {ENTRY_COLOR_KEYS.map(([key]) => (
                    <label key={key} className="grid gap-1 text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">
                      {ENTRY_COLOR_LABELS[key]}
                      <div className="flex h-8 items-center gap-2 rounded-md border border-stone-200 bg-white px-2">
                        <input className="h-5 w-7 border-0 bg-transparent p-0" type="color" value={colors[key] || DEFAULT_ENTRY_COLORS[key]} onChange={(event) => setColorDrafts((current) => ({ ...current, [selectedCompany.id]: { ...(current[selectedCompany.id] || DEFAULT_ENTRY_COLORS), [key]: event.target.value } }))} />
                        <input className="min-w-0 flex-1 bg-transparent text-xs font-semibold normal-case tracking-normal text-stone-900 outline-none" value={colors[key] || DEFAULT_ENTRY_COLORS[key]} onChange={(event) => setColorDrafts((current) => ({ ...current, [selectedCompany.id]: { ...(current[selectedCompany.id] || DEFAULT_ENTRY_COLORS), [key]: event.target.value } }))} />
                      </div>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5 text-[11px] font-semibold" onClick={() => void deleteCompany(selectedCompany)}><Trash2 className="h-4 w-4" />Delete</Button>
                  <Button size="sm" className="h-8 rounded-lg px-2.5 text-[11px] font-semibold" onClick={() => void updateCompany(selectedCompany)}><Save className="h-4 w-4" />Save</Button>
                </div>
              </div>
            ) : null}

            {sidePanel.type === "employee" ? (
              <AccountManagement
                mode="employees"
                workspace={workspace}
                supabase={supabase}
                onReload={onReload}
                onMessage={onMessage}
                scopeCompanyId={selectedCompany.id}
                scopeDepartmentId={sidePanel.departmentId}
                hideList
                compact
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function AccountManagement({
  mode,
  workspace,
  supabase,
  onReload,
  onMessage,
  scopeCompanyId,
  scopeDepartmentId,
  hideList = false,
  compact = false
}: {
  mode: "employees" | "admins";
  workspace: Workspace;
  supabase: SupabaseClient | null;
  onReload: () => void;
  onMessage: (message: string) => void;
  scopeCompanyId?: string;
  scopeDepartmentId?: string;
  hideList?: boolean;
  compact?: boolean;
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
  const [companyId, setCompanyId] = React.useState(scopeCompanyId || workspace.companies[0]?.id || "");
  const [departmentId, setDepartmentId] = React.useState(scopeDepartmentId || "");
  const [position, setPosition] = React.useState("");
  const [identificationNumber, setIdentificationNumber] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [coAvailable, setCoAvailable] = React.useState("0");
  const [reportsToId, setReportsToId] = React.useState("");
  const [teamLeaderId, setTeamLeaderId] = React.useState("");
  const [permittedCompanyIds, setPermittedCompanyIds] = React.useState<string[]>(companyId ? [companyId] : []);
  const [listOpen, setListOpen] = React.useState(mode !== "employees" && !hideList);
  const suggestedCoDays = startDate ? calculateCoEntitlement(startDate, endDate) : 0;

  const companyOptions = scopeCompanyId ? workspace.companies.filter((company) => company.id === scopeCompanyId) : workspace.companies;
  const departmentOptions = workspace.departments.filter((department) => department.company_id === companyId && (!scopeDepartmentId || department.id === scopeDepartmentId));
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
  const accessibleCompanyIds = new Set(accessibleCompanies(workspace).map((company) => company.id));
  const accounts = workspace.profiles
    .filter((profile) => {
      if (mode === "employees") {
        return !["admin_account", "payroll_admin", "company_manager"].includes(profile.role) &&
          (workspace.profile.role === "admin_account" || Boolean(profile.company_id && accessibleCompanyIds.has(profile.company_id))) &&
          (!scopeCompanyId || profile.company_id === scopeCompanyId) &&
          (!scopeDepartmentId || profile.department_id === scopeDepartmentId);
      }
      if (workspace.profile.role === "admin_account") return ["payroll_admin", "company_manager"].includes(profile.role);
      if (profile.role !== "company_manager") return false;
      const profileCompanies = companyIdsForProfile(profile, workspace);
      return Array.from(profileCompanies).some((id) => accessibleCompanyIds.has(id));
    })
    .toSorted((a, b) => a.full_name.localeCompare(b.full_name));

  React.useEffect(() => {
    if (!scopeCompanyId || editingId) return;
    setCompanyId(scopeCompanyId);
    setDepartmentId(scopeDepartmentId || "");
    if (scopeDepartmentId) applyDepartmentDefaults(scopeDepartmentId);
  }, [scopeCompanyId, scopeDepartmentId, editingId]);

  React.useEffect(() => {
    if (!departmentId) return;
    if (selectedDepartment?.manager_user_id && !reportsToId && ["employee", "team_leader"].includes(role)) setReportsToId(selectedDepartment.manager_user_id);
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

  function applyDepartmentDefaults(nextDepartmentId: string) {
    setDepartmentId(nextDepartmentId);
    const department = workspace.departments.find((item) => item.id === nextDepartmentId);
    if (!department) {
      setReportsToId("");
      setTeamLeaderId("");
      return;
    }
    if (["employee", "team_leader"].includes(role)) {
      setReportsToId(department.manager_user_id || "");
    }
    if (role === "department_manager") {
      const companyManager = workspace.profiles.find((profile) => profile.role === "company_manager" && companyIdsForProfile(profile, workspace).has(companyId));
      setReportsToId(companyManager?.id || "");
      setTeamLeaderId("");
      return;
    }
    if (role === "employee") {
      const leaders = workspace.profiles.filter((profile) => profile.role === "team_leader" && profile.company_id === companyId && profile.department_id === nextDepartmentId);
      setTeamLeaderId(department.team_leader_user_id || (leaders.length === 1 ? leaders[0].id : ""));
    } else {
      setTeamLeaderId("");
    }
  }

  function resetForm() {
    setEditingId("");
    setRole(roleOptions[0]);
    setName("");
    setEmail("");
    setPassword("");
    setCompanyId(scopeCompanyId || workspace.companies[0]?.id || "");
    setDepartmentId(scopeDepartmentId || "");
    setPosition("");
    setIdentificationNumber("");
    setStartDate("");
    setEndDate("");
    setCoAvailable("0");
    setReportsToId("");
    setTeamLeaderId("");
    setPermittedCompanyIds(scopeCompanyId ? [scopeCompanyId] : workspace.companies[0]?.id ? [workspace.companies[0].id] : []);
  }

  function updateStartDate(value: string) {
    setStartDate(value);
    if (mode === "employees" && value) setCoAvailable(String(calculateCoEntitlement(value, endDate)));
  }

  function updateEndDate(value: string) {
    setEndDate(value);
    if (mode === "employees" && startDate) setCoAvailable(String(calculateCoEntitlement(startDate, value)));
  }

  function updateRole(nextRole: string) {
    setRole(nextRole);
    if (nextRole !== "employee") setTeamLeaderId("");
    if (departmentId) {
      const department = workspace.departments.find((item) => item.id === departmentId);
      if (["employee", "team_leader"].includes(nextRole)) setReportsToId(department?.manager_user_id || "");
      if (nextRole === "department_manager") {
        const companyManager = workspace.profiles.find((profile) => profile.role === "company_manager" && companyIdsForProfile(profile, workspace).has(companyId));
        setReportsToId(companyManager?.id || "");
      }
    }
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
    setStartDate(profile.start_date || "");
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
    <div className="grid gap-3">
      <Card className={cn("border-stone-200 shadow-none", compact ? "rounded-2xl" : "rounded-[22px]")}>
        <CardHeader className="pb-2.5">
          <CardTitle className={cn(compact ? "text-base" : "text-lg")}>{editingId ? "Edit" : "Create"} {mode === "employees" ? "Employee" : "Admin / Manager"}</CardTitle>
          <CardDescription className="text-[13px]">
            {mode === "employees"
              ? "Employees, Team Leaders, and Department Managers."
              : "Payroll Admins and Company Managers. Company access uses checkboxes."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {mode === "employees" ? (
            <div className="grid gap-3">
              <div className={cn(
                "grid gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5",
                !compact && "xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start"
              )}>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Role</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {roleOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-[11px] font-black transition-colors",
                          role === option
                            ? "border-emerald-700 bg-emerald-700 text-white"
                            : "border-stone-200 bg-white text-stone-600 hover:border-emerald-300 hover:text-emerald-800"
                        )}
                        onClick={() => updateRole(option)}
                      >
                        {ROLES[option]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={cn("flex flex-wrap gap-2", !compact && "xl:justify-end")}>
                  <Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5 text-[11px] font-semibold" onClick={resetForm}>Reset</Button>
                  <Button size="sm" className="h-8 rounded-lg px-2.5 text-[11px] font-semibold" onClick={saveAccount}><Save className="h-4 w-4" />Save Account</Button>
                </div>
              </div>

              <div className={cn("grid gap-3", !compact && "xl:grid-cols-[minmax(0,1fr)_220px]")}>
                <div className="grid gap-3">
                  <div className="grid gap-2 rounded-xl border border-stone-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Identity</p>
                      <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-bold text-stone-600">{ROLES[role]}</span>
                    </div>
                    <div className={cn("grid gap-2", !compact && "xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]")}>
                      <label className="grid gap-1 min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">Name</span>
                        <input className="h-8 rounded-md border border-stone-200 bg-white px-3 text-[13px] font-semibold text-stone-900" value={name} onChange={(event) => setName(event.target.value)} placeholder="Employee name" />
                      </label>
                      <label className="grid gap-1 min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">Email</span>
                        <input className="h-8 rounded-md border border-stone-200 bg-white px-3 text-[13px] font-semibold text-stone-900" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" type="email" />
                      </label>
                    </div>
                    <div className={cn("grid gap-2", !compact && "xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_140px]")}>
                      <label className="grid gap-1 min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">Password</span>
                        <input className="h-8 rounded-md border border-stone-200 bg-white px-3 text-[13px] font-semibold text-stone-900" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={editingId ? "New password optional" : "Temporary password"} type="password" />
                      </label>
                      <label className="grid gap-1 min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">Position</span>
                        <input className="h-8 rounded-md border border-stone-200 bg-white px-3 text-[13px] font-semibold text-stone-900" value={position} onChange={(event) => setPosition(event.target.value)} placeholder="Position" />
                      </label>
                      <label className="grid gap-1 min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">ID</span>
                        <input className="h-8 rounded-md border border-stone-200 bg-white px-3 text-[13px] font-semibold text-stone-900" value={identificationNumber} onChange={(event) => setIdentificationNumber(event.target.value)} placeholder="ID number" />
                      </label>
                    </div>
                  </div>

                  <div className="grid gap-2 rounded-xl border border-stone-200 bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Organization</p>
                    <div className={cn("grid gap-2", !compact && "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")}>
                      <label className="grid gap-1 min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">Company</span>
                        <select className="h-8 rounded-md border border-stone-200 bg-stone-50 px-2 text-[13px] font-semibold text-stone-900" value={companyId} disabled={Boolean(scopeCompanyId)} onChange={(event) => {
                          setCompanyId(event.target.value);
                          setDepartmentId("");
                          setReportsToId("");
                          setTeamLeaderId("");
                        }}>
                          {companyOptions.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-1 min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">Department</span>
                        <select className="h-8 rounded-md border border-stone-200 bg-stone-50 px-2 text-[13px] font-semibold text-stone-900" value={departmentId} disabled={Boolean(scopeDepartmentId)} onChange={(event) => applyDepartmentDefaults(event.target.value)}>
                          <option value="">No department</option>
                          {departmentOptions.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                        </select>
                      </label>
                      <label className="grid gap-1 min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">Reports to</span>
                        <select className="h-8 rounded-md border border-stone-200 bg-stone-50 px-2 text-[13px] font-semibold text-stone-900" value={reportsToId} onChange={(event) => setReportsToId(event.target.value)}>
                          <option value="">Reports to none</option>
                          {managers.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
                        </select>
                      </label>
                      {role === "employee" ? (
                        <label className="grid gap-1 min-w-0">
                          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">Team leader</span>
                          <select className="h-8 rounded-md border border-stone-200 bg-stone-50 px-2 text-[13px] font-semibold text-stone-900" value={teamLeaderId} onChange={(event) => setTeamLeaderId(event.target.value)}>
                            <option value="">No team leader</option>
                            {teamLeaders.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
                          </select>
                        </label>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className={cn("grid w-full gap-3", compact ? "max-w-none" : "max-w-[220px] xl:justify-self-start")}>
                  <div className="grid gap-2 rounded-xl border border-stone-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Contract</p>
                      <button type="button" className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700" onClick={() => setCoAvailable(String(suggestedCoDays))}>
                        Use {suggestedCoDays} CO
                      </button>
                    </div>
                    <div className="grid gap-2">
                      <DateInput label="Start date" value={startDate} onChange={updateStartDate} />
                      <DateInput label="End date" value={endDate} onChange={updateEndDate} />
                      <label className="grid gap-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.16em] text-stone-500">Available CO days</span>
                        <input className="h-8 rounded-md border border-stone-200 bg-stone-50 px-3 text-[13px] font-semibold text-stone-900" value={coAvailable} onChange={(event) => setCoAvailable(event.target.value)} placeholder={`${suggestedCoDays}`} type="number" step="0.25" />
                      </label>
                    </div>
                  </div>

                  {!compact ? <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Summary</p>
                    <div className="mt-2 grid gap-2">
                      <div className="flex items-center justify-between rounded-md border border-stone-200 bg-white px-3 py-2 text-[13px] font-semibold text-stone-700">
                        <span>Company</span>
                        <span className="text-stone-900">{workspace.companies.find((item) => item.id === companyId)?.name || "None"}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md border border-stone-200 bg-white px-3 py-2 text-[13px] font-semibold text-stone-700">
                        <span>Department</span>
                        <span className="text-stone-900">{selectedDepartment?.name || "None"}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-md border border-stone-200 bg-white px-3 py-2 text-[13px] font-semibold text-stone-700">
                        <span>CO available</span>
                        <span className="text-stone-900">{coAvailable || "0"}</span>
                      </div>
                    </div>
                  </div> : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="grid gap-3">
                <div className="grid gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-stone-500">Account</p>
                  <div className="flex flex-wrap gap-1.5">
                    {roleOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        className={cn(
                          "rounded-md border px-3 py-1.5 text-xs font-black transition-colors",
                          role === option
                            ? "border-emerald-700 bg-emerald-700 text-white"
                            : "border-stone-200 bg-white text-stone-600 hover:border-emerald-300 hover:text-emerald-800"
                        )}
                        onClick={() => updateRole(option)}
                      >
                        {ROLES[option]}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-2">
                    <label className="grid gap-1">
                      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">Name</span>
                      <input className="h-9 rounded-md border border-stone-200 bg-white px-3 text-[13px] font-semibold text-stone-900" value={name} onChange={(event) => setName(event.target.value)} placeholder="Account name" />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">Email</span>
                      <input className="h-9 rounded-md border border-stone-200 bg-white px-3 text-[13px] font-semibold text-stone-900" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" type="email" />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">Password</span>
                      <input className="h-9 rounded-md border border-stone-200 bg-white px-3 text-[13px] font-semibold text-stone-900" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={editingId ? "New password optional" : "Temporary password"} type="password" />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="rounded-xl border border-stone-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.22em] text-stone-500">Company Access</p>
                    <span className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-bold text-stone-600">{permittedCompanyIds.length} selected</span>
                  </div>
                  <div className="mt-2 grid max-h-48 gap-2 overflow-auto md:grid-cols-2">
                    {workspace.companies.map((company) => (
                      <label key={company.id} className="flex items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-[13px] font-semibold text-stone-800">
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

                <div className="flex flex-wrap justify-end gap-2 rounded-xl border border-stone-200 bg-stone-50 p-2.5">
                  <Button size="sm" variant="outline" onClick={resetForm}>Reset</Button>
                  <Button size="sm" onClick={saveAccount}><Save className="h-4 w-4" />Save Account</Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {!hideList ? <Card className="rounded-[22px] border-stone-200 shadow-none">
        <CardHeader className="pb-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">{mode === "employees" ? "Employees" : "Admins and Managers"}</CardTitle>
              <CardDescription className="text-[13px]">{accounts.length} accounts in this environment.</CardDescription>
            </div>
            <Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5 text-[11px] font-semibold" onClick={() => setListOpen((value) => !value)}>
              {listOpen ? "Hide list" : "Show list"}
            </Button>
          </div>
        </CardHeader>
        {listOpen ? <CardContent className="grid gap-2">
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
        </CardContent> : null}
      </Card> : null}
    </div>
  );
}

function companyIdsForProfile(profile: ProfileRow, workspace: Workspace) {
  const ids = new Set<string>();
  if (profile.company_id) ids.add(profile.company_id);
  workspace.access.filter((item) => item.payroll_user_id === profile.id).forEach((item) => ids.add(item.company_id));
  return ids;
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="relative grid gap-1">
      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-stone-500">{label}</span>
      <input
        className={cn(
          "h-8 rounded-md border border-stone-200 bg-stone-50 px-3 text-[13px] font-semibold text-stone-900",
          !value && "text-transparent"
        )}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type="date"
      />
      {!value ? <span className="pointer-events-none absolute bottom-[9px] left-3 text-[13px] font-semibold text-stone-400">--/--/----</span> : null}
    </label>
  );
}

function calculateCoEntitlement(startDate: string, endDate?: string) {
  if (!startDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 0;
  const yearEnd = new Date(start.getFullYear(), 11, 31);
  const contractEnd = endDate ? new Date(`${endDate}T00:00:00`) : yearEnd;
  const finalDay = contractEnd < yearEnd ? contractEnd : yearEnd;
  if (finalDay < start) return 0;
  let total = 0;
  for (let cursor = new Date(start.getFullYear(), start.getMonth(), 1); cursor <= finalDay; cursor.setMonth(cursor.getMonth() + 1)) {
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    const activeStart = start > monthStart ? start : monthStart;
    const activeEnd = finalDay < monthEnd ? finalDay : monthEnd;
    if (activeEnd >= activeStart) {
      const activeDays = Math.floor((activeEnd.getTime() - activeStart.getTime()) / 86400000) + 1;
      total += 1.75 * (activeDays / monthEnd.getDate());
    }
  }
  return Math.round(total * 4) / 4;
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
      <Card className="w-full max-w-xl overflow-hidden rounded-[24px] shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
        <CardHeader className="flex-row items-center justify-between border-b border-stone-200 p-3.5">
          <div>
            <CardTitle className="text-lg">Leave Request Document</CardTitle>
            <CardDescription className="text-[13px]">Preview of the generated request form.</CardDescription>
          </div>
          <Button size="sm" variant="outline" className="h-8 rounded-lg px-2.5 text-[11px] font-semibold" onClick={onClose}>Close</Button>
        </CardHeader>
        <CardContent className="p-0">
          <iframe className="h-[390px] w-full bg-white" srcDoc={scaledDocumentPreviewHtml(html)} title="Leave request document preview" />
        </CardContent>
      </Card>
    </div>
  );
}

function scaledDocumentPreviewHtml(html: string) {
  const compactStyles = `
    <style>
      html, body { overflow: hidden !important; }
      body { padding: 14px !important; font-size: 12px !important; line-height: 1.3 !important; }
      .brand { font-size: 10px !important; letter-spacing: 0.18em !important; }
      h1 { margin: 4px 0 10px !important; font-size: 18px !important; }
      p { margin: 6px 0 !important; }
      .box { padding: 10px !important; margin: 8px 0 !important; border-radius: 7px !important; }
      .status { padding: 4px 7px !important; font-size: 11px !important; border-radius: 999px !important; }
    </style>
  `;
  if (html.includes("</head>")) return html.replace("</head>", `${compactStyles}</head>`);
  return `${compactStyles}${html}`;
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
    ["Employee", "Department", "Position", ...days.map((day) => day.iso), "Worked", "Norm", "Diff", "OT", "CO", "CM", "SE", "AB", "CO Left"]
  ];
  employees.forEach((employee) => {
    const totals = totalsFor(employee, month, workspace);
    const department = departmentFor(employee, workspace);
    rows.push([
      employee.full_name,
      department?.name || "",
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

function sheetDescription(tab: string) {
  if (tab === "leave") return "Requests, approvals, and supporting leave documents.";
  if (tab === "charts") return "Compact analytics for the current visible scope.";
  if (tab === "companies") return "Selected-company hierarchy, departments, colors, and employee creation.";
  if (tab === "admins") return "Admin-account access, payroll admins, and company managers.";
  if (tab === "settings") return "Holidays, danger actions, and deployment-safe preferences.";
  return "Workspace panel";
}

function SideSheet({
  open,
  title,
  description,
  wide,
  onClose,
  children
}: {
  open: boolean;
  title: string;
  description: string;
  wide?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className={cn(
          "absolute inset-0 z-20 bg-emerald-950/8 backdrop-blur-[1px] transition-opacity",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "absolute inset-y-3 left-3 z-30 flex min-w-0 flex-col overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.14)] transition-transform duration-300",
          wide ? "w-[min(780px,calc(100%-1.5rem))]" : "w-[min(560px,calc(100%-1.5rem))]",
          open ? "translate-x-0" : "-translate-x-[106%]"
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 bg-stone-50/80 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Workspace Sheet</p>
            <h2 className="truncate text-[22px] font-black leading-tight text-stone-950">{title}</h2>
            <p className="mt-1 max-w-2xl text-[13px] text-stone-500">{description}</p>
          </div>
          <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" onClick={onClose}>
            <X className="h-4 w-4" />
            Close
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </aside>
    </>
  );
}
