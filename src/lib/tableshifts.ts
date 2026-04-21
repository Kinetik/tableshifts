export const ROLES: Record<string, string> = {
  admin_account: "Admin Account",
  payroll_admin: "Payroll Admin",
  employee: "Employee",
  team_leader: "Team Leader",
  department_manager: "Department Manager",
  company_manager: "Company Manager"
};

export const ENTRY_LABELS: Record<string, string> = {
  normal: "N",
  overtime: "OT",
  weekend: "",
  holiday: "H",
  vacation: "CO",
  medical: "CM",
  special_event: "SE",
  absence: "AB"
};

export type ProfileRow = {
  id: string;
  environment_id: string | null;
  email: string;
  full_name: string;
  role: string;
  identification_number: string | null;
  position: string | null;
  company_id: string | null;
  department_id: string | null;
  reports_to_user_id: string | null;
  team_leader_user_id: string | null;
  start_date: string | null;
  end_date: string | null;
  co_available: number | string | null;
  created_by: string | null;
  created_at: string | null;
};

export type CompanyRow = {
  id: string;
  environment_id: string;
  name: string;
  logo_path: string | null;
  entry_colors: Record<string, string> | null;
  created_by: string | null;
};

export type DepartmentRow = {
  id: string;
  environment_id: string;
  company_id: string;
  name: string;
  manager_user_id: string | null;
  team_leader_user_id: string | null;
  shift_hours: number | string;
  work_days: number[] | null;
};

export type EntryRow = {
  id: string;
  company_id: string;
  employee_user_id: string;
  department_id: string | null;
  work_date: string;
  type: string;
  hours: number | string;
  leave_request_id: string | null;
  attachment_path: string | null;
};

export type HolidayRow = {
  id: string;
  company_id: string | null;
  department_id: string | null;
  holiday_date: string;
  name: string;
  country_code: string;
};

export type LeaveRequestRow = {
  id: string;
  company_id: string;
  employee_user_id: string;
  type: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  status: string;
  attachment_path: string | null;
  generated_document_html: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export type PayrollAccessRow = {
  payroll_user_id: string;
  company_id: string;
};

export type Workspace = {
  ownerId: string;
  profile: ProfileRow;
  profiles: ProfileRow[];
  companies: CompanyRow[];
  departments: DepartmentRow[];
  entries: EntryRow[];
  holidays: HolidayRow[];
  leaveRequests: LeaveRequestRow[];
  access: PayrollAccessRow[];
};

export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1, 1);
  const days = [];
  while (date.getMonth() === monthNumber - 1) {
    const day = date.getDate();
    days.push({
      day,
      iso: `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
      weekdayIndex: date.getDay()
    });
    date.setDate(date.getDate() + 1);
  }
  return days;
}

export function monthOptions(center = currentMonth()) {
  const [year, month] = center.split("-").map(Number);
  const base = new Date(year, month - 1, 1);
  return Array.from({ length: 15 }, (_, index) => {
    const date = new Date(base);
    date.setMonth(base.getMonth() + index - 7);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      value,
      label: date.toLocaleDateString(undefined, { month: "long", year: "numeric" })
    };
  });
}

export function monthRange(month: string) {
  const days = daysInMonth(month);
  return { start: days[0]?.iso || month, end: days.at(-1)?.iso || month };
}

export function isTimesheetUser(profile: ProfileRow) {
  return !["admin_account", "payroll_admin", "company_manager"].includes(profile.role);
}

export function companyIdsForUser(profile: ProfileRow, access: PayrollAccessRow[]) {
  const ids = new Set<string>();
  if (profile.company_id) ids.add(profile.company_id);
  access.filter((row) => row.payroll_user_id === profile.id).forEach((row) => ids.add(row.company_id));
  return ids;
}

export function accessibleCompanies(workspace: Workspace) {
  const user = workspace.profile;
  if (user.role === "admin_account") {
    return workspace.companies.filter((company) => company.created_by === user.id || workspace.ownerId === user.id);
  }
  if (user.role === "payroll_admin" || user.role === "company_manager") {
    const ids = companyIdsForUser(user, workspace.access);
    workspace.companies.forEach((company) => {
      if (company.created_by === user.id) ids.add(company.id);
    });
    return workspace.companies.filter((company) => ids.has(company.id));
  }
  return workspace.companies.filter((company) => company.id === user.company_id);
}

export function isEmployeeInLeaderTeam(employee: ProfileRow, leader: ProfileRow, departments: DepartmentRow[]) {
  const department = departments.find((item) => item.id === employee.department_id);
  return employee.team_leader_user_id === leader.id ||
    department?.team_leader_user_id === leader.id ||
    Boolean(employee.department_id && employee.department_id === leader.department_id);
}

export function visibleEmployees(workspace: Workspace, activeCompanyId: string) {
  const user = workspace.profile;
  let list = workspace.profiles.filter((profile) => isTimesheetUser(profile) && profile.company_id === activeCompanyId);
  if (user.role === "employee") {
    list = list.filter((profile) => profile.id === user.id);
  } else if (user.role === "team_leader") {
    list = list.filter((profile) => profile.id === user.id || isEmployeeInLeaderTeam(profile, user, workspace.departments));
  } else if (user.role === "department_manager") {
    list = list.filter((profile) => profile.department_id === user.department_id || profile.reports_to_user_id === user.id);
  } else if (user.role === "company_manager") {
    const ids = companyIdsForUser(user, workspace.access);
    list = list.filter((profile) => profile.company_id && ids.has(profile.company_id));
  }
  return list.toSorted((a, b) => a.full_name.localeCompare(b.full_name));
}

export function filteredEmployees(
  workspace: Workspace,
  activeCompanyId: string,
  departmentId: string,
  teamLeaderId: string
) {
  let list = visibleEmployees(workspace, activeCompanyId);
  if (departmentId !== "all") {
    list = list.filter((profile) => profile.department_id === departmentId);
  }
  if (teamLeaderId !== "all") {
    const leader = workspace.profiles.find((profile) => profile.id === teamLeaderId);
    list = list.filter((profile) => profile.id === teamLeaderId || (leader ? isEmployeeInLeaderTeam(profile, leader, workspace.departments) : false));
  }
  return list;
}

export function canEditEmployee(currentUser: ProfileRow, employee: ProfileRow, workspace: Workspace) {
  if (["admin_account", "payroll_admin"].includes(currentUser.role)) return false;
  if (currentUser.role === "company_manager") {
    const ids = companyIdsForUser(currentUser, workspace.access);
    return Boolean(employee.company_id && ids.has(employee.company_id));
  }
  if (currentUser.role === "department_manager") {
    return employee.department_id === currentUser.department_id || employee.reports_to_user_id === currentUser.id;
  }
  if (currentUser.role === "team_leader") {
    return employee.id === currentUser.id || isEmployeeInLeaderTeam(employee, currentUser, workspace.departments);
  }
  return employee.id === currentUser.id;
}

export function canCreateLeaveRequest(currentUser: ProfileRow) {
  return !["admin_account", "payroll_admin", "company_manager"].includes(currentUser.role);
}

export function canApproveLeave(currentUser: ProfileRow, employee: ProfileRow | undefined, workspace: Workspace) {
  if (!employee || currentUser.id === employee.id) return false;
  if (["admin_account", "payroll_admin"].includes(currentUser.role)) return false;
  if (currentUser.role === "company_manager") {
    const ids = companyIdsForUser(currentUser, workspace.access);
    return Boolean(employee.company_id && ids.has(employee.company_id));
  }
  if (currentUser.role === "department_manager") {
    return employee.department_id === currentUser.department_id || employee.reports_to_user_id === currentUser.id;
  }
  if (currentUser.role === "team_leader") {
    return isEmployeeInLeaderTeam(employee, currentUser, workspace.departments);
  }
  return false;
}

export function visibleLeaveRequests(workspace: Workspace, activeCompanyId: string) {
  const user = workspace.profile;
  return workspace.leaveRequests.filter((request) => {
    const employee = workspace.profiles.find((profile) => profile.id === request.employee_user_id);
    if (["admin_account", "payroll_admin"].includes(user.role)) return request.company_id === activeCompanyId;
    return request.employee_user_id === user.id || canApproveLeave(user, employee, workspace);
  });
}

export function generatedLeaveDocumentHtml(
  request: Pick<LeaveRequestRow, "type" | "start_date" | "end_date" | "notes" | "status" | "decided_at">,
  employee: ProfileRow,
  company: CompanyRow | undefined,
  approver?: ProfileRow
) {
  const title = ENTRY_LABELS[request.type] || request.type;
  const status = request.status === "approved" ? "Approved" : request.status === "rejected" ? "Rejected" : "Requested";
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Leave Request</title>
  <style>
    body { font-family: Arial, sans-serif; color: #15211b; padding: 40px; line-height: 1.55; }
    .brand { color: #047857; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.16em; }
    h1 { margin: 8px 0 24px; font-size: 30px; }
    .box { border: 1px solid #d7ded8; border-radius: 8px; padding: 20px; margin: 18px 0; }
    .muted { color: #68736d; }
    .status { display: inline-block; padding: 6px 10px; border-radius: 6px; background: #ecfdf5; color: #047857; font-weight: 800; }
  </style>
</head>
<body>
  <div class="brand">${escapeHtmlForDoc(company?.name || "TableShifts")}</div>
  <h1>Leave Request</h1>
  <p class="status">${status}</p>
  <div class="box">
    <p><strong>Requestor:</strong> ${escapeHtmlForDoc(employee.full_name)}</p>
    <p><strong>Type:</strong> ${escapeHtmlForDoc(title)}</p>
    <p><strong>Period:</strong> ${escapeHtmlForDoc(request.start_date)} to ${escapeHtmlForDoc(request.end_date)}</p>
    <p>Please approve this leave request for the period mentioned above.</p>
    ${request.notes ? `<p><strong>Notes:</strong> ${escapeHtmlForDoc(request.notes)}</p>` : ""}
  </div>
  <div class="box">
    <p><strong>Approval:</strong> ${approver ? escapeHtmlForDoc(approver.full_name) : "Team Leader / Manager"}</p>
    <p><strong>Status:</strong> ${status}${request.decided_at ? ` on ${escapeHtmlForDoc(request.decided_at.slice(0, 10))}` : ""}</p>
  </div>
  <p class="muted">Generated by TableShifts.</p>
</body>
</html>`;
}

function escapeHtmlForDoc(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function departmentFor(employee: ProfileRow, workspace: Workspace) {
  return workspace.departments.find((department) => department.id === employee.department_id) || null;
}

export function holidayForEmployee(employee: ProfileRow, iso: string, workspace: Workspace) {
  return workspace.holidays.find((holiday) => {
    const companyMatches = !holiday.company_id || holiday.company_id === employee.company_id;
    const departmentMatches = !holiday.department_id || holiday.department_id === employee.department_id;
    return holiday.holiday_date === iso && companyMatches && departmentMatches;
  });
}

export function isExpectedWorkDay(employee: ProfileRow, iso: string, weekdayIndex: number, workspace: Workspace) {
  const department = workspace.departments.find((item) => item.id === employee.department_id);
  const workDays = department?.work_days?.length ? department.work_days : [1, 2, 3, 4, 5];
  return workDays.includes(weekdayIndex) && !holidayForEmployee(employee, iso, workspace);
}

export function normalHours(employee: ProfileRow, workspace: Workspace) {
  const department = workspace.departments.find((item) => item.id === employee.department_id);
  return Number(department?.shift_hours || 8);
}

export function entryFor(entries: EntryRow[], employeeId: string, iso: string) {
  return entries.find((entry) => entry.employee_user_id === employeeId && entry.work_date === iso) || null;
}

export function totalsFor(employee: ProfileRow, month: string, workspace: Workspace) {
  const days = daysInMonth(month);
  const normal = normalHours(employee, workspace);
  let expected = 0;
  let worked = 0;
  let overtime = 0;
  let vacationDays = 0;
  let medicalDays = 0;
  let specialEventDays = 0;
  days.forEach((day) => {
    const expectedDay = isExpectedWorkDay(employee, day.iso, day.weekdayIndex, workspace);
    if (expectedDay) expected += normal;
    const entry = entryFor(workspace.entries, employee.id, day.iso);
    if (!entry) return;
    if (entry.type === "vacation") {
      vacationDays += 1;
      worked += expectedDay ? normal : 0;
      return;
    }
    if (entry.type === "medical") {
      medicalDays += 1;
      worked += expectedDay ? normal : 0;
      return;
    }
    if (entry.type === "special_event") {
      specialEventDays += 1;
      worked += expectedDay ? normal : 0;
      return;
    }
    const hours = Number(entry.hours || 0);
    worked += hours;
    if (entry.type === "overtime") overtime += Math.max(0, hours - normal);
  });
  return { expected, worked, overtime, vacationDays, medicalDays, specialEventDays, difference: worked - expected };
}

export function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
