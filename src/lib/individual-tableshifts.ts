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

export type IndividualDepartmentGroup = {
  id: string;
  name: string;
  order: number;
};

export type IndividualCompanyGroup = {
  id: string;
  name: string;
  order: number;
  departments: IndividualDepartmentGroup[];
};

export type IndividualHoliday = {
  date: string;
  name: string;
  countryCode?: string;
};

export type IndividualColumnWidths = {
  employee?: number;
  company?: number;
  department?: number;
  identificationNumber?: number;
  position?: number;
};

export type IndividualTableData = {
  id: string;
  month: string;
  normalHours: number;
  createdAt?: string;
  expiresAt?: string;
  speedDialSpotlightSeenAt?: string;
  organizations?: IndividualCompanyGroup[];
  rows: IndividualRow[];
  employeePool?: IndividualRow[];
  entries: Record<string, Record<string, IndividualEntry>>;
  holidays: IndividualHoliday[];
  columnWidths?: IndividualColumnWidths;
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

export const INDIVIDUAL_TABLE_TTL_DAYS = 90;
export const DEFAULT_COMPANY_NAME = "Company";
export const DEFAULT_DEPARTMENT_NAME = "Department";

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

export function defaultIndividualDepartment(name = DEFAULT_DEPARTMENT_NAME, order = 0): IndividualDepartmentGroup {
  return {
    id: makeIndividualId("dept"),
    name,
    order
  };
}

export function defaultIndividualCompany(name = DEFAULT_COMPANY_NAME, order = 0): IndividualCompanyGroup {
  return {
    id: makeIndividualId("company"),
    name,
    order,
    departments: [defaultIndividualDepartment(DEFAULT_DEPARTMENT_NAME, 0)]
  };
}

export function createIndividualTable(id = makeIndividualId()): IndividualTableData {
  const company = defaultIndividualCompany("Company 1");
  const department = company.departments[0];
  const createdAt = new Date().toISOString();
  const row = { ...defaultIndividualRow(), company: company.name, department: department.name };
  return {
    id,
    month: currentMonth(),
    normalHours: 8,
    createdAt,
    expiresAt: individualExpiryFromCreatedAt(createdAt),
    organizations: [company],
    rows: [row],
    employeePool: [],
    entries: {},
    holidays: [],
    columnWidths: {}
  };
}

export function individualExpiryFromCreatedAt(createdAt: string) {
  const started = Number.isFinite(Date.parse(createdAt)) ? new Date(createdAt) : new Date();
  started.setDate(started.getDate() + INDIVIDUAL_TABLE_TTL_DAYS);
  return started.toISOString();
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
  const createdAt = typeof data.createdAt === "string" && Number.isFinite(Date.parse(data.createdAt)) ? data.createdAt : new Date().toISOString();
  const rows = Array.isArray(data.rows) && data.rows.length ? data.rows.map(sanitizeIndividualRow) : [defaultIndividualRow()];
  const organizations = sanitizeIndividualOrganizations(data.organizations, rows);
  const firstCompany = organizations[0] || defaultIndividualCompany("Company 1");
  const firstDepartment = firstCompany.departments[0] || defaultIndividualDepartment(DEFAULT_DEPARTMENT_NAME, 0);
  const normalizedRows = rows.map((row) => ({
    ...row,
    company: row.company.trim() || firstCompany.name,
    department: row.department.trim() || firstDepartment.name
  }));
  return {
    id: data.id || id,
    month: data.month || currentMonth(),
    normalHours: sanitizeIndividualNormalHours(data.normalHours),
    createdAt,
    expiresAt: typeof data.expiresAt === "string" && Number.isFinite(Date.parse(data.expiresAt)) ? data.expiresAt : individualExpiryFromCreatedAt(createdAt),
    speedDialSpotlightSeenAt: typeof data.speedDialSpotlightSeenAt === "string" && Number.isFinite(Date.parse(data.speedDialSpotlightSeenAt)) ? data.speedDialSpotlightSeenAt : undefined,
    organizations: sanitizeIndividualOrganizations(organizations, normalizedRows),
    rows: normalizedRows,
    employeePool: Array.isArray(data.employeePool) ? data.employeePool.map(sanitizeIndividualRow) : normalizedRows.filter(individualRowHasContent),
    entries: data.entries && typeof data.entries === "object" ? data.entries : {},
    holidays: Array.isArray(data.holidays) ? data.holidays.map((holiday) => ({
      date: holiday.date || "",
      name: holiday.name || "Public holiday",
      countryCode: holiday.countryCode
    })).filter((holiday) => holiday.date) : [],
    columnWidths: sanitizeIndividualColumnWidths(data.columnWidths)
  };
}

export function sanitizeIndividualRow(row: Partial<IndividualRow>): IndividualRow {
  return {
    id: row.id || makeIndividualId("row"),
    name: row.name || "",
    company: row.company || "",
    department: row.department || "",
    identificationNumber: row.identificationNumber || "",
    position: row.position || ""
  };
}

export function individualRowHasContent(row: IndividualRow) {
  return Boolean(`${row.name}${row.company}${row.department}${row.identificationNumber}${row.position}`.trim());
}

export function sanitizeIndividualColumnWidths(value: unknown): IndividualColumnWidths {
  if (typeof value !== "object" || value === null) return {};
  const widths = value as Record<string, unknown>;
  return {
    employee: sanitizeColumnWidth(widths.employee, 160, 420),
    company: sanitizeColumnWidth(widths.company, 96, 280),
    department: sanitizeColumnWidth(widths.department, 96, 280),
    identificationNumber: sanitizeColumnWidth(widths.identificationNumber, 88, 260),
    position: sanitizeColumnWidth(widths.position, 96, 300)
  };
}

function sanitizeColumnWidth(value: unknown, min: number, max: number) {
  const width = Number(value);
  if (!Number.isFinite(width)) return undefined;
  return Math.max(min, Math.min(max, Math.round(width)));
}

export function sanitizeIndividualOrganizations(value: unknown, rows: IndividualRow[] = []): IndividualCompanyGroup[] {
  const fromData = Array.isArray(value)
    ? value.map((company, index) => sanitizeIndividualCompany(company as Partial<IndividualCompanyGroup>, index))
    : [];
  const companies = new Map<string, IndividualCompanyGroup>();

  fromData.forEach((company) => {
    companies.set(company.name.trim().toLowerCase(), company);
  });

  rows.forEach((row) => {
    const companyName = row.company.trim() || DEFAULT_COMPANY_NAME;
    const departmentName = row.department.trim() || DEFAULT_DEPARTMENT_NAME;
    const companyKey = companyName.toLowerCase();
    const existingCompany = companies.get(companyKey);
    if (!existingCompany) {
      companies.set(companyKey, {
        id: makeIndividualId("company"),
        name: companyName,
        order: companies.size,
        departments: [defaultIndividualDepartment(departmentName, 0)]
      });
      return;
    }
    const hasDepartment = existingCompany.departments.some((department) => department.name.trim().toLowerCase() === departmentName.toLowerCase());
    if (!hasDepartment) {
      existingCompany.departments.push(defaultIndividualDepartment(departmentName, existingCompany.departments.length));
    }
  });

  if (!companies.size) {
    const company = defaultIndividualCompany("Company 1");
    companies.set(company.name.toLowerCase(), company);
  }

  return Array.from(companies.values())
    .map((company, index) => ({
      ...company,
      order: Number.isFinite(company.order) ? company.order : index,
      departments: company.departments.length ? company.departments : [defaultIndividualDepartment(DEFAULT_DEPARTMENT_NAME, 0)]
    }))
    .toSorted((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

function sanitizeIndividualCompany(company: Partial<IndividualCompanyGroup>, index: number): IndividualCompanyGroup {
  const name = typeof company.name === "string" && company.name.trim() ? company.name.trim() : `${DEFAULT_COMPANY_NAME} ${index + 1}`;
  return {
    id: company.id || makeIndividualId("company"),
    name,
    order: Number.isFinite(Number(company.order)) ? Number(company.order) : index,
    departments: Array.isArray(company.departments)
      ? company.departments.map((department, departmentIndex) => sanitizeIndividualDepartment(department, departmentIndex))
      : [defaultIndividualDepartment(DEFAULT_DEPARTMENT_NAME, 0)]
  };
}

function sanitizeIndividualDepartment(department: Partial<IndividualDepartmentGroup>, index: number): IndividualDepartmentGroup {
  return {
    id: department.id || makeIndividualId("dept"),
    name: typeof department.name === "string" && department.name.trim() ? department.name.trim() : `${DEFAULT_DEPARTMENT_NAME} ${index + 1}`,
    order: Number.isFinite(Number(department.order)) ? Number(department.order) : index
  };
}

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

export function downloadIndividualTemplate() {
  downloadXlsx("tableshifts-import-template.xlsx", "Employees", [
    ["Employee", "Company", "Department", "Identification Number", "Position"],
    ["", "", "", "", ""]
  ]);
}

export function exportIndividualXlsx(table: IndividualTableData) {
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
  downloadXlsx(`individual-tableshifts-${table.month}.xlsx`, "Individual TableShift", rows);
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
      position: positionIndex >= 0 ? row[positionIndex] || "" : ""
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
