(function () {
  const STORAGE_KEY = "tableshifts.full.v2";
  const SESSION_KEY = "tableshifts.session.v2";
  const ROLES = {
    admin_account: "Admin Account",
    employee: "Employee",
    team_leader: "Team Leader",
    department_manager: "Department Manager",
    company_manager: "Company Manager",
    payroll_admin: "Payroll Admin"
  };
  const ENTRY_LABELS = {
    normal: "N",
    overtime: "OT",
    weekend: "WE",
    holiday: "H",
    vacation: "CO",
    medical: "CM",
    special_event: "SE",
    absence: "AB"
  };
  const HOLIDAY_COUNTRIES = [
    ["RO", "Romania"],
    ["US", "United States"],
    ["GB", "United Kingdom"],
    ["DE", "Germany"],
    ["FR", "France"],
    ["IT", "Italy"],
    ["ES", "Spain"],
    ["AT", "Austria"],
    ["HU", "Hungary"],
    ["BG", "Bulgaria"],
    ["PL", "Poland"],
    ["NL", "Netherlands"]
  ];

  let db = loadDb();
  const supabaseState = window.TableShiftsSupabase || { configured: false, client: null, mode: "local" };
  const supabase = supabaseState.client;
  let session = {
    userId: "",
    activeCompanyId: db.companies[0]?.id || "",
    activeTab: "timesheet",
    month: getCurrentMonth(),
    departmentFilter: "all",
    teamFilter: "all",
    totalsExpanded: false,
    editingEntry: null
  };
  let pendingLeaveDraft = null;

  const el = {
    loginView: byId("loginView"),
    appView: byId("appView"),
    loginEmail: byId("loginEmail"),
    loginPassword: byId("loginPassword"),
    loginError: byId("loginError"),
    loginBtn: byId("loginBtn"),
    showCreateAdminBtn: byId("showCreateAdminBtn"),
    createAdminForm: byId("createAdminForm"),
    newAdminName: byId("newAdminName"),
    newAdminEmail: byId("newAdminEmail"),
    newAdminPassword: byId("newAdminPassword"),
    newAdminPassword2: byId("newAdminPassword2"),
    sessionLabel: byId("sessionLabel"),
    topIdentity: byId("topIdentity"),
    pendingApprovalsBtn: byId("pendingApprovalsBtn"),
    adminDangerZone: byId("adminDangerZone"),
    deleteAdminAccountBtn: byId("deleteAdminAccountBtn"),
    tabs: byId("tabs"),
    pageTitle: byId("pageTitle"),
    monthPicker: byId("monthPicker"),
    companyScopeWrap: byId("companyScopeWrap"),
    companyScope: byId("companyScope"),
    departmentScopeWrap: byId("departmentScopeWrap"),
    departmentScope: byId("departmentScope"),
    teamScopeWrap: byId("teamScopeWrap"),
    teamScope: byId("teamScope"),
    exportCsvBtn: byId("exportCsvBtn"),
    saveBtn: byId("saveBtn"),
    logoutBtn: byId("logoutBtn"),
    timesheetGrid: byId("timesheetGrid"),
    metricPeople: byId("metricPeople"),
    metricWorked: byId("metricWorked"),
    metricOvertime: byId("metricOvertime"),
    metricCo: byId("metricCo"),
    metricCm: byId("metricCm"),
    metricSe: byId("metricSe"),
    metricDifference: byId("metricDifference"),
    fulfillmentBox: byId("fulfillmentBox"),
    fulfillmentText: byId("fulfillmentText"),
    fulfillmentBar: byId("fulfillmentBar"),
    fulfillmentMeta: byId("fulfillmentMeta"),
    chartsTab: byId("chartsTab"),
    hoursChart: byId("hoursChart"),
    leaveChart: byId("leaveChart"),
    leaveLegend: byId("leaveLegend"),
    overtimeChart: byId("overtimeChart"),
    leaveTab: byId("leaveTab"),
    leaveRequestForm: byId("leaveRequestForm"),
    leaveType: byId("leaveType"),
    leaveStartDate: byId("leaveStartDate"),
    leaveEndDate: byId("leaveEndDate"),
    leaveDocument: byId("leaveDocument"),
    leaveGenerateDocument: byId("leaveGenerateDocument"),
    leaveNotes: byId("leaveNotes"),
    leaveRequestsList: byId("leaveRequestsList"),
    leavePreviewModal: byId("leavePreviewModal"),
    leaveDocumentPreview: byId("leaveDocumentPreview"),
    confirmLeavePreviewBtn: byId("confirmLeavePreviewBtn"),
    cancelLeavePreviewBtn: byId("cancelLeavePreviewBtn"),
    cancelLeavePreviewBottomBtn: byId("cancelLeavePreviewBottomBtn"),
    holidaysTab: byId("holidaysTab"),
    holidayFetchForm: byId("holidayFetchForm"),
    holidayCountry: byId("holidayCountry"),
    holidayYear: byId("holidayYear"),
    holidayCompany: byId("holidayCompany"),
    holidayDepartment: byId("holidayDepartment"),
    holidayStatus: byId("holidayStatus"),
    manualHolidayForm: byId("manualHolidayForm"),
    manualHolidayId: byId("manualHolidayId"),
    manualHolidayDate: byId("manualHolidayDate"),
    manualHolidayName: byId("manualHolidayName"),
    holidaysList: byId("holidaysList"),
    usersTab: byId("usersTab"),
    companiesTab: byId("companiesTab"),
    departmentsTab: byId("departmentsTab"),
    timesheetTab: byId("timesheetTab"),
    employeeForm: byId("employeeForm"),
    employeeId: byId("employeeId"),
    employeeName: byId("employeeName"),
    employeeEmail: byId("employeeEmail"),
    employeeIdentification: byId("employeeIdentification"),
    employeePosition: byId("employeePosition"),
    employeePassword: byId("employeePassword"),
    employeeStartDate: byId("employeeStartDate"),
    employeeEndDate: byId("employeeEndDate"),
    employeeRole: byId("employeeRole"),
    employeeCompany: byId("employeeCompany"),
    employeeCompanyAccess: byId("employeeCompanyAccess"),
    employeeDepartment: byId("employeeDepartment"),
    employeeReportsTo: byId("employeeReportsTo"),
    employeeTeamLeader: byId("employeeTeamLeader"),
    employeeCo: byId("employeeCo"),
    resetEmployeeFormBtn: byId("resetEmployeeFormBtn"),
    usersList: byId("usersList"),
    companyForm: byId("companyForm"),
    companyName: byId("companyName"),
    companyDepartments: byId("companyDepartments"),
    companyLogo: byId("companyLogo"),
    companyLogoPreview: byId("companyLogoPreview"),
    companiesList: byId("companiesList"),
    companyLog: byId("companyLog"),
    departmentForm: byId("departmentForm"),
    departmentId: byId("departmentId"),
    departmentName: byId("departmentName"),
    departmentCompany: byId("departmentCompany"),
    departmentManager: byId("departmentManager"),
    departmentTeamLeader: byId("departmentTeamLeader"),
    departmentShiftHours: byId("departmentShiftHours"),
    resetDepartmentFormBtn: byId("resetDepartmentFormBtn"),
    departmentsList: byId("departmentsList"),
    departmentLog: byId("departmentLog"),
    cellEditor: byId("cellEditor"),
    editorTitle: byId("editorTitle"),
    editorSubtitle: byId("editorSubtitle"),
    entryType: byId("entryType"),
    entryHours: byId("entryHours"),
    entryFileWrap: byId("entryFileWrap"),
    entryFile: byId("entryFile"),
    entryFileMeta: byId("entryFileMeta"),
    editorHelp: byId("editorHelp"),
    saveEntryBtn: byId("saveEntryBtn"),
    deleteEntryBtn: byId("deleteEntryBtn"),
    closeEditorBtn: byId("closeEditorBtn")
  };

  init();

  async function init() {
    bindLogin();
    bindApp();
    await restoreSession();
  }

  function bindLogin() {
    el.loginBtn.addEventListener("click", login);
    el.showCreateAdminBtn.addEventListener("click", () => {
      el.createAdminForm.hidden = !el.createAdminForm.hidden;
    });
    el.createAdminForm.addEventListener("submit", createPayrollAdminFromLogin);
    el.loginEmail.addEventListener("keydown", (event) => {
      if (event.key === "Enter") login();
    });
    el.loginPassword.addEventListener("keydown", (event) => {
      if (event.key === "Enter") login();
    });
  }

  function bindApp() {
    el.monthPicker.addEventListener("change", () => {
      session.month = el.monthPicker.value || getCurrentMonth();
      saveSession();
      renderTimesheet();
    });
    el.companyScope.addEventListener("change", () => {
      session.activeCompanyId = el.companyScope.value;
      session.departmentFilter = "all";
      session.teamFilter = "all";
      saveSession();
      renderAll();
    });
    el.departmentScope.addEventListener("change", () => {
      session.departmentFilter = el.departmentScope.value;
      if (session.teamFilter !== "all") {
        const leader = userById(session.teamFilter);
        if (!leader || leader.departmentId !== session.departmentFilter) session.teamFilter = "all";
      }
      saveSession();
      renderTimesheet();
    });
    el.teamScope.addEventListener("change", () => {
      session.teamFilter = el.teamScope.value;
      if (session.teamFilter !== "all") {
        const leader = userById(session.teamFilter);
        if (leader?.departmentId) session.departmentFilter = leader.departmentId;
      }
      saveSession();
      renderTimesheet();
    });
    el.exportCsvBtn.addEventListener("click", exportVisibleCsv);
    el.saveBtn.addEventListener("click", () => {
      saveDb();
      flash(el.saveBtn, "Saved");
    });
    el.logoutBtn.addEventListener("click", logout);
    el.pendingApprovalsBtn.addEventListener("click", () => {
      session.activeTab = "leave";
      saveSession();
      renderAll();
    });
    el.deleteAdminAccountBtn.addEventListener("click", deleteCurrentAdminAccount);
    el.employeeForm.addEventListener("submit", saveEmployee);
    el.resetEmployeeFormBtn.addEventListener("click", resetEmployeeForm);
    el.employeeCompany.addEventListener("change", () => {
      fillEmployeeDepartmentOptions();
      prefillReporting();
    });
    el.employeeDepartment.addEventListener("change", prefillReporting);
    el.employeeRole.addEventListener("change", syncCompanyAccessVisibility);
    el.employeeStartDate.addEventListener("change", updateCoEntitlementFromDates);
    el.employeeEndDate.addEventListener("change", updateCoEntitlementFromDates);
    el.leaveRequestForm.addEventListener("submit", submitLeaveRequest);
    el.confirmLeavePreviewBtn.addEventListener("click", confirmLeaveRequestDraft);
    el.cancelLeavePreviewBtn.addEventListener("click", cancelLeaveRequestDraft);
    el.cancelLeavePreviewBottomBtn.addEventListener("click", cancelLeaveRequestDraft);
    el.companyForm.addEventListener("submit", createCompany);
    el.companyLogo.addEventListener("change", previewCompanyLogo);
    el.departmentForm.addEventListener("submit", saveDepartment);
    el.resetDepartmentFormBtn.addEventListener("click", resetDepartmentForm);
    el.departmentCompany.addEventListener("change", fillDepartmentManagerOptions);
    el.holidayFetchForm.addEventListener("submit", fetchAndApplyHolidays);
    el.manualHolidayForm.addEventListener("submit", addManualHoliday);
    el.holidayCompany.addEventListener("change", () => {
      fillHolidayDepartmentOptions();
      renderHolidays();
    });
    el.holidayDepartment.addEventListener("change", renderHolidays);
    el.holidayYear.addEventListener("change", renderHolidays);
    el.holidayCountry.addEventListener("change", renderHolidays);
    el.closeEditorBtn.addEventListener("click", closeEditor);
    el.saveEntryBtn.addEventListener("click", saveEntryFromEditor);
    el.deleteEntryBtn.addEventListener("click", deleteEntryFromEditor);
    document.querySelectorAll("[data-quick]").forEach((button) => {
      button.addEventListener("click", () => applyQuick(button.dataset.quick));
    });
  }

  async function login() {
    const email = clean(el.loginEmail.value).toLowerCase();
    if (useSupabaseAuth()) {
      await loginWithSupabase(email, el.loginPassword.value);
      return;
    }
    const user = users().find((item) => clean(item.email).toLowerCase() === email);
    el.loginError.textContent = "";
    if (!user) {
      el.loginError.textContent = "No user found for that email.";
      return;
    }
    if ((user.password || "") !== el.loginPassword.value) {
      el.loginError.textContent = "Password is not correct.";
      return;
    }

    session.userId = user.id;
    session.activeCompanyId = ["admin_account", "payroll_admin"].includes(user.role)
      ? accessibleCompanies(user)[0]?.id || ""
      : user.companyId;
    session.activeTab = "timesheet";
    session.month = getCurrentMonth();
    el.monthPicker.value = session.month;
    el.loginView.hidden = true;
    el.appView.hidden = false;
    saveSession();
    renderAll();
  }

  async function logout() {
    if (useSupabaseAuth()) {
      await supabase.auth.signOut();
    }
    session.userId = "";
    sessionStorage.removeItem(SESSION_KEY);
    el.loginEmail.value = "";
    el.loginPassword.value = "";
    el.loginView.hidden = false;
    el.appView.hidden = true;
  }

  async function restoreSession() {
    if (useSupabaseAuth()) {
      try {
        const { data } = await supabase.auth.getSession();
        const authUser = data?.session?.user;
        if (!authUser) return;
        const user = await syncSupabaseProfile(authUser.id);
        if (!user) return;
        startAuthenticatedSession(user);
      } catch (error) {
        console.warn("Could not restore Supabase session", error);
      }
      return;
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      if (!saved?.userId || !userById(saved.userId)) return;
      session = {
        ...session,
        ...saved,
        editingEntry: null,
        month: saved.month || getCurrentMonth(),
        activeTab: saved.activeTab || "timesheet",
        departmentFilter: saved.departmentFilter || "all",
        teamFilter: saved.teamFilter || "all",
        totalsExpanded: Boolean(saved.totalsExpanded)
      };
      const companies = accessibleCompanies(currentUser());
      if (companies.length && !companies.some((company) => company.id === session.activeCompanyId)) {
        session.activeCompanyId = companies[0].id;
      }
      el.monthPicker.value = session.month;
      el.loginView.hidden = true;
      el.appView.hidden = false;
      renderAll();
    } catch (error) {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }

  function saveSession() {
    if (!session.userId) return;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      userId: session.userId,
      activeCompanyId: session.activeCompanyId,
      activeTab: session.activeTab,
      month: session.month,
      departmentFilter: session.departmentFilter,
      teamFilter: session.teamFilter,
      totalsExpanded: session.totalsExpanded
    }));
  }

  async function createPayrollAdminFromLogin(event) {
    event.preventDefault();
    const name = clean(el.newAdminName.value);
    const email = clean(el.newAdminEmail.value).toLowerCase();
    const password = el.newAdminPassword.value;
    const password2 = el.newAdminPassword2.value;
    el.loginError.textContent = "";
    if (!name || !email || !password) {
      el.loginError.textContent = "Name, email, and password are required.";
      return;
    }
    if (password !== password2) {
      el.loginError.textContent = "Passwords do not match.";
      return;
    }
    if (!useSupabaseAuth() && users().some((user) => clean(user.email).toLowerCase() === email)) {
      el.loginError.textContent = "An account with this email already exists.";
      return;
    }
    if (useSupabaseAuth()) {
      await createSupabaseAdminAccount(name, email, password);
      return;
    }
    db.users.push({
      id: makeId("pa"),
      name,
      email,
      identificationNumber: `PA-${Date.now().toString().slice(-5)}`,
      position: "Payroll Administrator",
      password,
      role: "admin_account",
      companyId: "",
      departmentId: "",
      reportsToId: "",
      teamLeaderId: "",
      startDate: todayIso(),
      endDate: "",
      coAvailable: 0,
      adminOwnerId: "",
      permittedCompanyIds: [],
      createdAt: new Date().toISOString()
    });
    saveDb();
    el.loginEmail.value = email;
    el.loginPassword.value = "";
    el.createAdminForm.reset();
    el.createAdminForm.hidden = true;
    el.loginError.textContent = "Admin Account created. Enter the password to sign in.";
  }

  function useSupabaseAuth() {
    return Boolean(supabaseState.configured && supabase);
  }

  async function loginWithSupabase(email, password) {
    el.loginError.textContent = "";
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      el.loginError.textContent = authErrorMessage(error);
      return;
    }
    const user = await syncSupabaseProfile(data.user.id);
    if (!user) {
      el.loginError.textContent = "Account exists, but the TableShifts profile is not ready yet.";
      return;
    }
    startAuthenticatedSession(user);
  }

  async function createSupabaseAdminAccount(name, email, password) {
    el.loginError.textContent = "";
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          account_type: "admin_account"
        }
      }
    });
    if (error) {
      el.loginError.textContent = authErrorMessage(error);
      return;
    }
    el.loginEmail.value = email;
    el.loginPassword.value = "";
    el.createAdminForm.reset();
    el.createAdminForm.hidden = true;
    if (!data.session) {
      el.loginError.textContent = "Admin Account created. Confirm the email if Supabase asks, then sign in from any device.";
      return;
    }
    const user = await syncSupabaseProfile(data.user.id);
    if (user) {
      startAuthenticatedSession(user);
    } else {
      el.loginError.textContent = "Admin Account created. Enter the password to sign in.";
    }
  }

  async function syncSupabaseProfile(userId) {
    const profile = await waitForSupabaseProfile(userId);
    if (!profile) return null;
    const user = profileToLocalUser(profile);
    db.users = db.users || [];
    const existingIndex = db.users.findIndex((item) => item.id === user.id);
    if (existingIndex >= 0) db.users[existingIndex] = { ...db.users[existingIndex], ...user };
    else db.users.push(user);
    saveDb();
    return user;
  }

  async function waitForSupabaseProfile(userId) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (data) return data;
      if (error && error.code !== "PGRST116") {
        console.warn("Supabase profile lookup failed", error);
      }
      await sleep(350);
    }
    return null;
  }

  function profileToLocalUser(profile) {
    return {
      id: profile.id,
      name: profile.full_name,
      email: profile.email,
      identificationNumber: profile.identification_number || "",
      position: profile.position || ROLES[profile.role] || "Employee",
      password: "",
      role: profile.role,
      companyId: profile.company_id || "",
      departmentId: profile.department_id || "",
      reportsToId: profile.reports_to_user_id || "",
      teamLeaderId: profile.team_leader_user_id || "",
      startDate: profile.start_date || todayIso(),
      endDate: profile.end_date || "",
      coAvailable: Number(profile.co_available || 0),
      adminOwnerId: profile.role === "admin_account" ? profile.id : "",
      environmentId: profile.environment_id || "",
      permittedCompanyIds: [],
      createdAt: profile.created_at || new Date().toISOString()
    };
  }

  function startAuthenticatedSession(user) {
    session.userId = user.id;
    session.activeCompanyId = ["admin_account", "payroll_admin"].includes(user.role)
      ? accessibleCompanies(user)[0]?.id || ""
      : user.companyId;
    session.activeTab = "timesheet";
    session.month = getCurrentMonth();
    el.monthPicker.value = session.month;
    el.loginView.hidden = true;
    el.appView.hidden = false;
    saveSession();
    renderAll();
  }

  function authErrorMessage(error) {
    const message = String(error?.message || "Authentication failed.");
    if (/invalid login credentials/i.test(message)) return "Email or password is not correct.";
    if (/already registered|already exists|user already/i.test(message)) return "An account with this email already exists.";
    return message;
  }

  function renderAll() {
    renderShell();
    renderTimesheet();
    renderLeaveRequests();
    renderCharts();
    if (canManageSetup()) {
      renderCompanySetup();
      renderDepartmentSetup();
      renderHolidaySetup();
      renderUserManagement();
    }
  }

  function renderShell() {
    const user = currentUser();
    const company = companyById(session.activeCompanyId);
    el.pageTitle.textContent = tabTitle(session.activeTab);
    el.sessionLabel.textContent = company?.name || "";
    el.topIdentity.innerHTML = `<strong>${escapeHtml(user.name)}</strong><span>${ROLES[user.role]} - ${escapeHtml(user.email || "")}</span>`;
    const pendingCount = pendingApprovalsForCurrentUser().length;
    el.pendingApprovalsBtn.hidden = !["team_leader", "department_manager", "company_manager", "payroll_admin", "admin_account"].includes(user.role);
    el.pendingApprovalsBtn.textContent = pendingCount ? `${pendingCount} pending leave` : "No pending leave";
    el.pendingApprovalsBtn.classList.toggle("has-pending", pendingCount > 0);
    el.monthPicker.value = session.month;
    el.tabs.innerHTML = tabsForUser()
      .map((tab) => `<button class="${tab.id === session.activeTab ? "active" : ""}" data-tab="${tab.id}" type="button">${tab.label}</button>`)
      .join("");
    el.tabs.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        session.activeTab = button.dataset.tab;
        saveSession();
        showActiveTab();
        renderShell();
        if (session.activeTab === "timesheet") renderTimesheet();
      });
    });
    showActiveTab();
  }

  function showActiveTab() {
    ["timesheet", "leave", "charts", "companies", "departments", "holidays", "users"].forEach((tab) => {
      byId(`${tab}Tab`).hidden = session.activeTab !== tab;
    });
    if (session.activeTab === "charts") renderCharts();
    if (session.activeTab === "leave") renderLeaveRequests();
  }

  function renderTimesheet() {
    fillScopeControls();
    const days = daysInMonth(session.month);
    const visible = visibleEmployees();
    el.timesheetGrid.style.setProperty("--days", days.length);
    el.timesheetGrid.classList.toggle("totals-expanded", session.totalsExpanded);
    el.timesheetGrid.replaceChildren();

    const detailHeaders = ["Norm", "Diff", "OT", "CO", "CM", "SE", "CO Left"];
    const headers = ["Employee", ...days.map((day) => dayHeader(day)), "Worked", ...detailHeaders, "More", "Fill", "Clear"];
    headers.forEach((header, index) => {
      const cell = div("sheet-header");
      if (index === 0) cell.classList.add("sticky-name");
      if (detailHeaders.includes(header)) cell.classList.add("detail-total");
      if (header === "More") {
        cell.classList.add("toggle-total-cell");
        cell.innerHTML = `<button id="toggleTotalsBtn" type="button" class="mini toggle-totals" aria-expanded="${session.totalsExpanded}">${session.totalsExpanded ? "Less" : "More"}</button>`;
        el.timesheetGrid.appendChild(cell);
        return;
      }
      cell.innerHTML = header;
      el.timesheetGrid.appendChild(cell);
    });
    byId("toggleTotalsBtn")?.addEventListener("click", () => {
      session.totalsExpanded = !session.totalsExpanded;
      saveSession();
      renderTimesheet();
    });

    visible.forEach((employee) => renderEmployeeRow(employee, days));
    renderSummary(visible, days);
    renderCharts();
  }

  function fillScopeControls() {
    const user = currentUser();
    const canSwitchCompany = ["admin_account", "payroll_admin"].includes(user.role);
    el.companyScopeWrap.hidden = !canSwitchCompany;
    const companies = accessibleCompanies(user);
    if (session.activeCompanyId && !companies.some((company) => company.id === session.activeCompanyId)) {
      session.activeCompanyId = companies[0]?.id || "";
    }
    el.companyScope.innerHTML = companies.map((company) => option(company.id, company.name, company.id === session.activeCompanyId)).join("");

    const manageable = ["admin_account", "payroll_admin", "company_manager", "department_manager", "team_leader"].includes(user.role);
    el.departmentScopeWrap.hidden = !manageable || user.role === "employee";
    el.teamScopeWrap.hidden = !manageable || user.role === "employee";

    const selectedLeader = userById(session.teamFilter);
    const departmentOptions = departments()
      .filter((department) => department.companyId === session.activeCompanyId)
      .filter((department) => user.role !== "department_manager" || department.managerId === user.id || department.id === user.departmentId)
      .filter((department) => user.role !== "team_leader" || department.teamLeaderId === user.id || department.id === user.departmentId)
      .filter((department) => session.teamFilter === "all" || department.id === selectedLeader?.departmentId);
    if (session.departmentFilter !== "all" && !departmentOptions.some((department) => department.id === session.departmentFilter)) {
      session.departmentFilter = "all";
    }
    el.departmentScope.innerHTML = option("all", "All departments", session.departmentFilter === "all") +
      departmentOptions.map((department) => option(department.id, department.name, department.id === session.departmentFilter)).join("");

    const teamLeaders = users()
      .filter((item) => item.companyId === session.activeCompanyId && item.role === "team_leader")
      .filter((item) => session.departmentFilter === "all" || item.departmentId === session.departmentFilter);
    if (session.teamFilter !== "all" && !teamLeaders.some((leader) => leader.id === session.teamFilter)) {
      session.teamFilter = "all";
    }
    el.teamScope.innerHTML = option("all", "All team leaders", session.teamFilter === "all") +
      teamLeaders.map((leader) => option(leader.id, leader.name, leader.id === session.teamFilter)).join("");
  }

  function renderEmployeeRow(employee, days) {
    const editable = canEditEmployee(employee);
    const nameCell = div("name-cell sticky-name");
    nameCell.innerHTML = `<strong>${escapeHtml(employee.name)}</strong><span>${deptName(employee.departmentId)} - ${escapeHtml(employee.position || "No position")}</span>`;
    el.timesheetGrid.appendChild(nameCell);

    days.forEach((day) => {
      const entry = getEntry(employee.id, day.iso);
      const cell = div(`day-cell ${editable ? "editable" : "locked"}`);
      const department = departmentById(employee.departmentId);
      const holiday = holidayForEmployee(employee, day.iso);
      const isWorkDay = isExpectedWorkDay(employee, day, department);
      cell.dataset.workday = isWorkDay ? "true" : "false";
      if (holiday) cell.dataset.holiday = "true";
      if (entry) {
        const parts = entryParts(entry, department);
        cell.innerHTML = `<strong>${ENTRY_LABELS[entry.type] || "N"}</strong><span>${parts}</span>`;
      } else if (pendingLeaveForEmployee(employee.id, day.iso)) {
        cell.innerHTML = `<strong>REQ</strong>`;
      } else {
        cell.innerHTML = `<span class="empty-cell">${holiday ? "H" : ""}</span>`;
      }
      if (editable) {
        cell.tabIndex = 0;
        cell.setAttribute("role", "button");
        cell.setAttribute("aria-label", `Edit ${employee.name} on ${day.iso}`);
        cell.addEventListener("click", () => openEditor(employee.id, day.iso));
        cell.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openEditor(employee.id, day.iso);
          }
        });
      }
      el.timesheetGrid.appendChild(cell);
    });

    const totals = totalsFor(employee, days);
    addTotalCell(`${formatHours(totals.worked)}h`);
    addTotalCell(`${formatHours(totals.expected)}h`, "detail-total");
    addTotalCell(`${formatSigned(totals.difference)}h`, `detail-total ${totals.difference < 0 ? "negative" : totals.difference > 0 ? "positive" : ""}`);
    addTotalCell(`${formatHours(totals.overtime)}h`, "detail-total");
    addTotalCell(`${totals.vacationDays}d`, "detail-total");
    addTotalCell(`${totals.medicalDays}d`, "detail-total");
    addTotalCell(`${totals.specialEventDays}d`, "detail-total");
    addTotalCell(`${formatHours(Math.max(0, Number(employee.coAvailable || 0) - totals.vacationDays))}d`, "detail-total");
    const toggleCell = div("total-cell toggle-total-cell");
    toggleCell.textContent = session.totalsExpanded ? "<" : "...";
    el.timesheetGrid.appendChild(toggleCell);
    const fillCell = div("total-cell");
    const fillButton = document.createElement("button");
    fillButton.type = "button";
    fillButton.className = "mini";
    fillButton.textContent = "Fill";
    fillButton.disabled = !editable;
    fillButton.addEventListener("click", () => fillNormalTime(employee, days));
    fillCell.appendChild(fillButton);
    el.timesheetGrid.appendChild(fillCell);

    const clearCell = div("total-cell");
    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.className = "mini danger";
    clearButton.textContent = "Clear";
    clearButton.disabled = !editable;
    clearButton.addEventListener("click", () => clearEmployeeMonth(employee));
    clearCell.appendChild(clearButton);
    el.timesheetGrid.appendChild(clearCell);
  }

  function addTotalCell(text, extraClass) {
    const cell = div(`total-cell ${extraClass || ""}`);
    cell.textContent = text;
    el.timesheetGrid.appendChild(cell);
  }

  function renderSummary(visible, days) {
    const totals = visible.reduce(
      (acc, employee) => {
        const row = totalsFor(employee, days);
        acc.expected += row.expected;
        acc.worked += row.worked;
        acc.overtime += row.overtime;
        acc.vacationDays += row.vacationDays;
        acc.medicalDays += row.medicalDays;
        acc.specialEventDays += row.specialEventDays;
        return acc;
      },
      { expected: 0, worked: 0, overtime: 0, vacationDays: 0, medicalDays: 0, specialEventDays: 0 }
    );
    const diff = totals.worked - totals.expected;
    el.metricPeople.textContent = visible.length;
    el.metricWorked.textContent = formatHours(totals.worked);
    el.metricOvertime.textContent = formatHours(totals.overtime);
    el.metricCo.textContent = totals.vacationDays;
    el.metricCm.textContent = totals.medicalDays;
    el.metricSe.textContent = totals.specialEventDays;
    el.metricDifference.textContent = formatSigned(diff);

    const showFulfillment = ["team_leader", "department_manager", "company_manager", "payroll_admin", "admin_account"].includes(currentUser().role);
    el.fulfillmentBox.hidden = !showFulfillment;
    if (showFulfillment) {
      const percent = totals.expected ? Math.round((totals.worked / totals.expected) * 100) : 0;
      el.fulfillmentText.textContent = `${percent}%`;
      el.fulfillmentBar.style.width = `${Math.min(140, percent)}%`;
      el.fulfillmentMeta.textContent = `${formatHours(totals.worked)} worked from ${formatHours(totals.expected)} expected hours`;
    }
  }

  function renderCharts() {
    if (!el.hoursChart) return;
    const days = daysInMonth(session.month);
    const visible = visibleEmployees();
    const totals = visible.map((employee) => ({ employee, totals: totalsFor(employee, days) }));
    const scope = totals.reduce(
      (acc, row) => {
        acc.expected += row.totals.expected;
        acc.worked += row.totals.worked;
        acc.overtime += row.totals.overtime;
        acc.vacationDays += row.totals.vacationDays;
        acc.medicalDays += row.totals.medicalDays;
        acc.specialEventDays += row.totals.specialEventDays;
        return acc;
      },
      { expected: 0, worked: 0, overtime: 0, vacationDays: 0, medicalDays: 0, specialEventDays: 0 }
    );

    const maxHours = Math.max(scope.expected, scope.worked, 1);
    el.hoursChart.innerHTML = [
      chartBar("Expected", scope.expected, maxHours, "expected"),
      chartBar("Worked", scope.worked, maxHours, "worked"),
      chartBar("Overtime", scope.overtime, maxHours, "overtime")
    ].join("");

    const leaveTotal = scope.vacationDays + scope.medicalDays + scope.specialEventDays;
    const coPercent = leaveTotal ? Math.round((scope.vacationDays / leaveTotal) * 100) : 0;
    el.leaveChart.style.setProperty("--co", `${coPercent}%`);
    el.leaveChart.innerHTML = `<strong>${leaveTotal}</strong><span>leave days</span>`;
    el.leaveLegend.innerHTML = `<span><i class="co-dot"></i>CO ${scope.vacationDays}</span><span><i class="cm-dot"></i>CM ${scope.medicalDays}</span><span><i class="se-dot"></i>SE ${scope.specialEventDays}</span>`;

    const overtimeRows = totals
      .filter((row) => row.totals.overtime > 0)
      .sort((a, b) => b.totals.overtime - a.totals.overtime)
      .slice(0, 8);
    const maxOvertime = Math.max(...overtimeRows.map((row) => row.totals.overtime), 1);
    el.overtimeChart.innerHTML = overtimeRows.length
      ? overtimeRows.map((row) => chartBar(row.employee.name, row.totals.overtime, maxOvertime, "overtime")).join("")
      : `<p class="hint">No overtime recorded in this scope.</p>`;
  }

  function chartBar(label, value, max, kind) {
    const width = Math.max(2, Math.round((value / max) * 100));
    return `<div class="chart-row ${kind}">
      <span>${escapeHtml(label)}</span>
      <div class="chart-track"><i style="width: ${width}%"></i></div>
      <strong>${formatHours(value)}</strong>
    </div>`;
  }

  function visibleEmployees() {
    const user = currentUser();
    let list = users().filter((item) => isTimesheetUser(item) && item.companyId === session.activeCompanyId);
    if (user.role === "employee") {
      list = list.filter((item) => item.id === user.id);
    } else if (user.role === "team_leader") {
      list = list.filter((item) => item.id === user.id || item.teamLeaderId === user.id);
    } else if (user.role === "department_manager") {
      list = list.filter((item) => item.departmentId === user.departmentId || item.reportsToId === user.id);
    } else if (user.role === "company_manager") {
      list = list.filter((item) => item.companyId === user.companyId);
    }
    if (session.departmentFilter !== "all") {
      list = list.filter((item) => item.departmentId === session.departmentFilter);
    }
    if (session.teamFilter !== "all") {
      list = list.filter((item) => item.teamLeaderId === session.teamFilter || item.id === session.teamFilter);
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }

  function canEditEmployee(employee) {
    const user = currentUser();
    if (["admin_account", "payroll_admin"].includes(user.role)) return accessibleCompanies(user).some((company) => company.id === employee.companyId);
    if (user.role === "company_manager") return employee.companyId === user.companyId;
    if (user.role === "department_manager") return employee.departmentId === user.departmentId || employee.reportsToId === user.id;
    if (user.role === "team_leader") return employee.id === user.id || employee.teamLeaderId === user.id;
    return employee.id === user.id;
  }

  function openEditor(employeeId, iso) {
    const employee = userById(employeeId);
    const department = departmentById(employee.departmentId);
    const entry = getEntry(employeeId, iso) || { type: "normal", hours: department?.shiftHours || 8 };
    session.editingEntry = { employeeId, iso };
    el.editorTitle.textContent = employee.name;
    el.editorSubtitle.textContent = iso;
    el.entryType.value = entry.type;
    el.entryHours.value = entry.hours || "";
    el.entryFile.value = "";
    renderEntryAttachmentMeta(entry);
    updateEditorHelp();
    el.cellEditor.hidden = false;
  }

  function closeEditor() {
    session.editingEntry = null;
    el.cellEditor.hidden = true;
  }

  function applyQuick(type) {
    const editing = session.editingEntry;
    if (!editing) return;
    const employee = userById(editing.employeeId);
    const department = departmentById(employee.departmentId);
    const normalHours = department?.shiftHours || 8;
    el.entryType.value = type;
    if (type === "normal" || type === "weekend") el.entryHours.value = normalHours;
    if (type === "overtime") el.entryHours.value = normalHours + 2;
    if (type === "vacation" || type === "medical" || type === "special_event" || type === "absence") el.entryHours.value = 0;
    updateEditorHelp();
  }

  function updateEditorHelp() {
    const editing = session.editingEntry;
    if (!editing) return;
    const employee = userById(editing.employeeId);
    const department = departmentById(employee.departmentId);
    const normalHours = department?.shiftHours || 8;
    if (el.entryType.value === "overtime") {
      el.editorHelp.textContent = `Overtime is normal shift plus extra time. With a ${normalHours}h shift, 10h records 8h normal and 2h overtime.`;
    } else {
      el.editorHelp.textContent = `Normal shift for this department is ${normalHours}h.`;
    }
    el.entryFileWrap.hidden = el.entryType.value !== "vacation";
    if (el.entryType.value !== "vacation") {
      el.entryFile.value = "";
      renderEntryAttachmentMeta(null);
    }
  }

  function renderEntryAttachmentMeta(entry) {
    const attachment = entry?.attachment;
    const request = entry?.requestId ? (db.leaveRequests || []).find((item) => item.id === entry.requestId) : null;
    if (!attachment && !request?.generatedDocument) {
      el.entryFileMeta.innerHTML = "";
      return;
    }
    el.entryFileMeta.innerHTML = [
      attachment ? `<span>Attached: ${escapeHtml(attachment.name)}</span><button id="removeEntryFileBtn" type="button" class="secondary mini">Remove</button>` : "",
      request?.generatedDocument ? `<button id="previewEntryLeaveDocBtn" type="button" class="secondary mini">Preview request</button><button id="downloadEntryLeaveDocBtn" type="button" class="secondary mini">Download request</button>` : ""
    ].filter(Boolean).join("");
    byId("removeEntryFileBtn")?.addEventListener("click", removeEntryAttachment);
    byId("previewEntryLeaveDocBtn")?.addEventListener("click", () => previewExistingLeaveDocument(request.id));
    byId("downloadEntryLeaveDocBtn")?.addEventListener("click", () => downloadLeaveDocument(request.id));
  }

  function removeEntryAttachment() {
    const editing = session.editingEntry;
    if (!editing) return;
    const entry = getEntry(editing.employeeId, editing.iso);
    if (entry) {
      delete entry.attachment;
      setEntry(editing.employeeId, editing.iso, entry);
      saveDb();
    }
    el.entryFile.value = "";
    renderEntryAttachmentMeta(null);
  }

  el.entryType.addEventListener("change", updateEditorHelp);

  async function saveEntryFromEditor() {
    const editing = session.editingEntry;
    if (!editing) return;
    const employee = userById(editing.employeeId);
    const department = departmentById(employee.departmentId);
    const normalHours = department?.shiftHours || 8;
    const type = el.entryType.value;
    let hours = Number(el.entryHours.value || 0);
    if (!Number.isFinite(hours)) hours = 0;
    if (type === "overtime" && hours < normalHours) hours = normalHours;
    const existing = getEntry(editing.employeeId, editing.iso);
    const attachment = type === "vacation"
      ? (el.entryFile.files[0] ? await readFileMeta(el.entryFile.files[0]) : existing?.attachment)
      : null;
    const value = { type, hours };
    if (attachment) value.attachment = attachment;
    setEntry(editing.employeeId, editing.iso, value);
    saveDb();
    closeEditor();
    renderTimesheet();
  }

  function deleteEntryFromEditor() {
    const editing = session.editingEntry;
    if (!editing) return;
    deleteEntry(editing.employeeId, editing.iso);
    saveDb();
    closeEditor();
    renderTimesheet();
  }

  function fillNormalTime(employee, days) {
    const department = departmentById(employee.departmentId);
    const normalHours = department?.shiftHours || 8;
    days.forEach((day) => {
      const workDay = isExpectedWorkDay(employee, day, department);
      if (workDay && !getEntry(employee.id, day.iso)) {
        setEntry(employee.id, day.iso, { type: "normal", hours: normalHours });
      }
    });
    saveDb();
    renderTimesheet();
  }

  function clearEmployeeMonth(employee) {
    const confirmed = window.confirm(`Clear all entries for ${employee.name} in ${session.month}?`);
    if (!confirmed) return;
    const monthData = db.entries[session.activeCompanyId]?.[session.month];
    if (monthData) delete monthData[employee.id];
    saveDb();
    renderTimesheet();
  }

  function totalsFor(employee, days) {
    const department = departmentById(employee.departmentId);
    const normalHours = department?.shiftHours || 8;
    let expected = 0;
    let worked = 0;
    let overtime = 0;
    let vacationDays = 0;
    let medicalDays = 0;
    let specialEventDays = 0;
    days.forEach((day) => {
      const workDay = isExpectedWorkDay(employee, day, department);
      if (workDay) expected += normalHours;
      const entry = getEntry(employee.id, day.iso);
      if (!entry) return;
      if (entry.type === "vacation") {
        vacationDays += 1;
        worked += workDay ? normalHours : 0;
        return;
      }
      if (entry.type === "medical") {
        medicalDays += 1;
        worked += workDay ? normalHours : 0;
        return;
      }
      if (entry.type === "special_event") {
        specialEventDays += 1;
        worked += workDay ? normalHours : 0;
        return;
      }
      const hours = Number(entry.hours || 0);
      worked += hours;
      if (entry.type === "overtime") overtime += Math.max(0, hours - normalHours);
    });
    return { expected, worked, overtime, vacationDays, medicalDays, specialEventDays, difference: worked - expected };
  }

  function entryParts(entry, department) {
    const normalHours = department?.shiftHours || 8;
    if (entry.type === "overtime") {
      return `${normalHours}+${formatHours(Math.max(0, Number(entry.hours || 0) - normalHours))}`;
    }
    if (entry.type === "vacation" || entry.type === "medical" || entry.type === "special_event") return "day";
    return formatHours(Number(entry.hours || 0));
  }

  function isExpectedWorkDay(employee, day, department) {
    const baseWorkDay = department ? department.workDays.includes(day.weekdayIndex) : isWeekday(day.date);
    return baseWorkDay && !holidayForEmployee(employee, day.iso);
  }

  function holidayForEmployee(employee, iso) {
    return (db.holidays || []).find((holiday) => {
      const companyMatches = holiday.companyId === "all" || holiday.companyId === employee.companyId;
      const departmentMatches = holiday.departmentId === "all" || holiday.departmentId === employee.departmentId;
      const environmentMatches = holiday.adminOwnerId === companyById(employee.companyId)?.ownerAdminId;
      return holiday.date === iso && companyMatches && departmentMatches && environmentMatches;
    });
  }

  function renderUserManagement() {
    fillEmployeeFormOptions();
    el.adminDangerZone.hidden = currentUser().role !== "admin_account";
    const companyIds = new Set(accessibleCompanies().map((company) => company.id));
    const list = users().filter((user) => {
      if (user.role === "admin_account") return false;
      if (currentUser().role === "admin_account" && user.role === "payroll_admin") return user.adminOwnerId === currentUser().id;
      return companyIds.has(user.companyId);
    });
    el.usersList.innerHTML = list.map((user) => userCard(user)).join("");
    el.usersList.querySelectorAll("[data-edit-user]").forEach((button) => {
      button.addEventListener("click", () => editEmployee(button.dataset.editUser));
    });
    el.usersList.querySelectorAll("[data-delete-user]").forEach((button) => {
      button.addEventListener("click", () => deleteEmployee(button.dataset.deleteUser));
    });
  }

  async function submitLeaveRequest(event) {
    event.preventDefault();
    const startDate = el.leaveStartDate.value;
    const endDate = el.leaveEndDate.value || startDate;
    if (!startDate || !endDate || endDate < startDate) {
      window.alert("Choose a valid leave date range.");
      return;
    }
    const file = el.leaveDocument.files[0] ? await readFileMeta(el.leaveDocument.files[0]) : null;
    pendingLeaveDraft = {
      id: makeId("leave"),
      employeeId: currentUser().id,
      companyId: currentUser().companyId || session.activeCompanyId,
      type: el.leaveType.value,
      startDate,
      endDate,
      notes: clean(el.leaveNotes.value),
      attachment: file,
      generatedDocument: el.leaveGenerateDocument.checked,
      status: "requested",
      createdAt: new Date().toISOString(),
      decidedAt: "",
      decidedBy: ""
    };
    if (pendingLeaveDraft.generatedDocument) {
      showLeaveDocumentPreview(pendingLeaveDraft);
      return;
    }
    saveLeaveRequest(pendingLeaveDraft);
    pendingLeaveDraft = null;
  }

  function showLeaveDocumentPreview(request) {
    el.confirmLeavePreviewBtn.hidden = false;
    el.leaveDocumentPreview.innerHTML = leaveDocumentHtml(request);
    el.leavePreviewModal.hidden = false;
  }

  function cancelLeaveRequestDraft() {
    pendingLeaveDraft = null;
    el.leavePreviewModal.hidden = true;
  }

  function confirmLeaveRequestDraft() {
    if (!pendingLeaveDraft) return;
    saveLeaveRequest(pendingLeaveDraft);
    pendingLeaveDraft = null;
    el.leavePreviewModal.hidden = true;
  }

  function saveLeaveRequest(request) {
    db.leaveRequests = db.leaveRequests || [];
    db.leaveRequests.push(request);
    saveDb();
    el.leaveRequestForm.reset();
    el.leaveGenerateDocument.checked = true;
    renderAll();
  }

  function renderLeaveRequests() {
    if (!el.leaveRequestsList) return;
    const list = visibleLeaveRequests();
    el.leaveRequestsList.innerHTML = list.length
      ? list.map((request) => request.source === "timesheet" ? timesheetLeaveCard(request) : leaveRequestCard(request)).join("")
      : `<p class="hint">No leave requests in this scope yet.</p>`;
    el.leaveRequestsList.querySelectorAll("[data-approve-leave]").forEach((button) => {
      button.addEventListener("click", () => approveLeaveRequest(button.dataset.approveLeave));
    });
    el.leaveRequestsList.querySelectorAll("[data-reject-leave]").forEach((button) => {
      button.addEventListener("click", () => decideLeaveRequest(button.dataset.rejectLeave, "rejected"));
    });
    el.leaveRequestsList.querySelectorAll("[data-remove-leave-file]").forEach((button) => {
      button.addEventListener("click", () => removeLeaveRequestAttachment(button.dataset.removeLeaveFile));
    });
    el.leaveRequestsList.querySelectorAll("[data-download-file]").forEach((button) => {
      button.addEventListener("click", () => downloadAttachment(button.dataset.downloadFile, button.dataset.filename));
    });
    el.leaveRequestsList.querySelectorAll("[data-preview-leave-doc]").forEach((button) => {
      button.addEventListener("click", () => previewExistingLeaveDocument(button.dataset.previewLeaveDoc));
    });
    el.leaveRequestsList.querySelectorAll("[data-download-leave-doc]").forEach((button) => {
      button.addEventListener("click", () => downloadLeaveDocument(button.dataset.downloadLeaveDoc));
    });
  }

  function visibleLeaveRequests() {
    const user = currentUser();
    const requests = (db.leaveRequests || [])
      .filter((request) => ["admin_account", "payroll_admin"].includes(user.role) || request.companyId === session.activeCompanyId || request.employeeId === user.id)
      .filter((request) => request.employeeId === user.id || canApproveLeave(request))
      .map((request) => ({ ...request, source: "request" }));
    return [...requests, ...visibleTimesheetLeaveEntries()]
      .sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)));
  }

  function canApproveLeave(request) {
    const user = currentUser();
    const employee = userById(request.employeeId);
    if (!employee || user.id === employee.id) return false;
    if (["admin_account", "payroll_admin"].includes(user.role)) return accessibleCompanies(user).some((company) => company.id === employee.companyId);
    if (user.role === "company_manager") return employee.companyId === user.companyId;
    if (user.role === "department_manager") return employee.departmentId === user.departmentId || employee.reportsToId === user.id;
    if (user.role === "team_leader") return employee.teamLeaderId === user.id;
    return false;
  }

  function pendingApprovalsForCurrentUser() {
    return (db.leaveRequests || []).filter((request) => request.status === "requested" && canApproveLeave(request));
  }

  function leaveRequestCard(request) {
    const employee = userById(request.employeeId);
    const canDecide = request.status === "requested" && canApproveLeave(request);
    const file = request.attachment ? ` - ${escapeHtml(request.attachment.name)}` : "";
    const canRemove = request.attachment && request.employeeId === currentUser().id && request.status === "requested";
    const canPreviewDocument = request.generatedDocument;
    return `<article class="directory-row">
      <div><strong>${escapeHtml(employee?.name || "Unknown")}</strong><span>${request.startDate} to ${request.endDate} - ${ENTRY_LABELS[request.type]}${file}</span></div>
      <div><span>Status: ${escapeHtml(request.status)}${request.notes ? ` - ${escapeHtml(request.notes)}` : ""}</span></div>
      <div class="row-actions">
        ${request.attachment ? `<button type="button" class="secondary" data-download-file="${request.id}" data-filename="${escapeAttr(request.attachment.name)}">Download file</button>` : ""}
        ${canPreviewDocument ? `<button type="button" class="secondary" data-preview-leave-doc="${request.id}">Preview document</button><button type="button" class="secondary" data-download-leave-doc="${request.id}">Download document</button>` : ""}
        ${canRemove ? `<button type="button" class="secondary" data-remove-leave-file="${request.id}">Remove file</button>` : ""}
        ${canDecide ? `<button type="button" data-approve-leave="${request.id}">Approve</button><button type="button" class="danger" data-reject-leave="${request.id}">Reject</button>` : ""}
      </div>
    </article>`;
  }

  function timesheetLeaveCard(item) {
    const employee = userById(item.employeeId);
    return `<article class="directory-row">
      <div><strong>${escapeHtml(employee?.name || "Unknown")}</strong><span>${item.date} - CO entered in Timesheet${item.attachment ? ` - ${escapeHtml(item.attachment.name)}` : ""}</span></div>
      <div><span>Status: Recorded</span></div>
      <div class="row-actions">
        ${item.attachment ? `<button type="button" class="secondary" data-download-file="${item.downloadId}" data-filename="${escapeAttr(item.attachment.name)}">Download file</button>` : ""}
      </div>
    </article>`;
  }

  function visibleTimesheetLeaveEntries() {
    const visibleIds = new Set(visibleEmployees().map((employee) => employee.id));
    const items = [];
    Object.entries(db.entries?.[session.activeCompanyId] || {}).forEach(([month, monthData]) => {
      Object.entries(monthData || {}).forEach(([employeeId, days]) => {
        if (!visibleIds.has(employeeId)) return;
        Object.entries(days || {}).forEach(([date, entry]) => {
          if (entry?.type !== "vacation") return;
          if (entry.requestId) return;
          items.push({
            source: "timesheet",
            downloadId: `entry:${session.activeCompanyId}:${month}:${employeeId}:${date}`,
            employeeId,
            companyId: session.activeCompanyId,
            date,
            createdAt: date,
            attachment: entry.attachment || null
          });
        });
      });
    });
    return items;
  }

  function approveLeaveRequest(id) {
    const request = (db.leaveRequests || []).find((item) => item.id === id);
    const employee = userById(request?.employeeId);
    if (!request || !employee || !canApproveLeave(request)) return;
    const days = datesBetween(request.startDate, request.endDate);
    const oldCompanyId = session.activeCompanyId;
    const oldMonth = session.month;
    session.activeCompanyId = employee.companyId;
    days.forEach((iso) => {
      const date = parseIsoDate(iso);
      const month = iso.slice(0, 7);
      const day = { date, iso, weekdayIndex: date.getDay() };
      const department = departmentById(employee.departmentId);
      if (!isExpectedWorkDay(employee, day, department)) return;
      session.month = month;
      setEntry(employee.id, iso, { type: request.type, hours: 0, requestId: request.id, attachment: request.attachment });
    });
    session.activeCompanyId = oldCompanyId;
    session.month = oldMonth;
    decideLeaveRequest(id, "approved");
  }

  function decideLeaveRequest(id, status) {
    const request = (db.leaveRequests || []).find((item) => item.id === id);
    if (!request || !canApproveLeave(request)) return;
    request.status = status;
    request.decidedAt = new Date().toISOString();
    request.decidedBy = currentUser().id;
    saveDb();
    renderAll();
  }

  function removeLeaveRequestAttachment(id) {
    const request = (db.leaveRequests || []).find((item) => item.id === id);
    if (!request || request.employeeId !== currentUser().id || request.status !== "requested") return;
    delete request.attachment;
    saveDb();
    renderLeaveRequests();
  }

  function downloadAttachment(id) {
    let attachment = null;
    if (id.startsWith("entry:")) {
      const [, companyId, month, employeeId, iso] = id.split(":");
      attachment = db.entries?.[companyId]?.[month]?.[employeeId]?.[iso]?.attachment;
    } else {
      attachment = (db.leaveRequests || []).find((item) => item.id === id)?.attachment;
    }
    if (!attachment?.dataUrl) return;
    const link = document.createElement("a");
    link.href = attachment.dataUrl;
    link.download = attachment.name || "attachment";
    link.click();
  }

  function previewExistingLeaveDocument(id) {
    const request = (db.leaveRequests || []).find((item) => item.id === id);
    if (!request) return;
    el.confirmLeavePreviewBtn.hidden = true;
    el.leaveDocumentPreview.innerHTML = leaveDocumentHtml(request);
    el.leavePreviewModal.hidden = false;
    pendingLeaveDraft = null;
  }

  function downloadLeaveDocument(id) {
    const request = (db.leaveRequests || []).find((item) => item.id === id);
    if (!request) return;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Leave request</title></head><body>${leaveDocumentHtml(request)}</body></html>`;
    const employee = userById(request.employeeId);
    download(`leave-request-${slug(employee?.name || "employee")}-${request.startDate}.html`, html, "text/html");
  }

  function leaveDocumentHtml(request) {
    const employee = userById(request.employeeId) || currentUser();
    const company = companyById(employee.companyId || request.companyId) || companyById(request.companyId);
    const approver = request.decidedBy ? userById(request.decidedBy) : approvalTargetFor(employee);
    const status = request.status === "approved" ? "Approved" : request.status === "rejected" ? "Rejected" : "Requested";
    const decidedDate = request.decidedAt ? new Date(request.decidedAt).toLocaleDateString() : "";
    return `<article class="leave-document">
      <header>
        ${company?.logo?.dataUrl ? `<img src="${escapeAttr(company.logo.dataUrl)}" alt="${escapeAttr(company.name)} logo" />` : ""}
        <div>
          <strong>${escapeHtml(company?.name || "Company")}</strong>
          <span>Leave Request</span>
        </div>
      </header>
      <section>
        <p><b>Status:</b> ${status}</p>
        <p><b>Requestor:</b> ${escapeHtml(employee.name)}</p>
        <p><b>Type:</b> ${ENTRY_LABELS[request.type] || request.type}</p>
        <p><b>Requested period:</b> ${request.startDate} to ${request.endDate}</p>
        <p><b>Date of request:</b> ${new Date(request.createdAt).toLocaleDateString()}</p>
      </section>
      <p class="document-message">I kindly request approval for the leave period listed above. Please review the request and confirm whether it can be approved for planning and payroll records.</p>
      ${request.notes ? `<section><b>Notes:</b><p>${escapeHtml(request.notes)}</p></section>` : ""}
      <footer>
        <div><span>Approved by</span><strong>${request.status === "approved" ? escapeHtml(approver?.name || "Approver") : escapeHtml(approver?.name || "Team leader / Manager")}</strong></div>
        <div><span>Approval date</span><strong>${request.status === "approved" ? decidedDate : ""}</strong></div>
      </footer>
    </article>`;
  }

  function approvalTargetFor(employee) {
    return userById(employee.teamLeaderId) || userById(employee.reportsToId);
  }

  function pendingLeaveForEmployee(employeeId, iso) {
    return (db.leaveRequests || []).some((request) =>
      request.employeeId === employeeId &&
      request.status === "requested" &&
      request.startDate <= iso &&
      request.endDate >= iso
    );
  }

  function renderHolidaySetup() {
    fillHolidayControls();
    renderHolidays();
  }

  function fillHolidayControls() {
    const currentYear = Number(session.month.slice(0, 4)) || new Date().getFullYear();
    if (!el.holidayYear.value) el.holidayYear.value = currentYear;
    el.holidayCountry.innerHTML = HOLIDAY_COUNTRIES.map(([code, name]) => option(code, `${name} (${code})`, code === (el.holidayCountry.value || "RO"))).join("");
    el.holidayCompany.innerHTML = option("all", "All companies", el.holidayCompany.value === "all") +
      accessibleCompanies().map((company) => option(company.id, company.name, company.id === (el.holidayCompany.value || session.activeCompanyId))).join("");
    if (!el.holidayCompany.value) el.holidayCompany.value = session.activeCompanyId || "all";
    fillHolidayDepartmentOptions();
  }

  function fillHolidayDepartmentOptions() {
    const companyId = el.holidayCompany.value;
    const departmentsForCompany = departments().filter((department) => companyId === "all" || department.companyId === companyId);
    el.holidayDepartment.innerHTML = option("all", "All departments", el.holidayDepartment.value === "all") +
      departmentsForCompany.map((department) => option(department.id, `${department.name} (${companyById(department.companyId)?.name || "Company"})`, department.id === el.holidayDepartment.value)).join("");
    if (el.holidayDepartment.value !== "all" && !departmentsForCompany.some((department) => department.id === el.holidayDepartment.value)) {
      el.holidayDepartment.value = "all";
    }
  }

  async function fetchAndApplyHolidays(event) {
    event.preventDefault();
    const year = Number(el.holidayYear.value || session.month.slice(0, 4));
    const countryCode = el.holidayCountry.value;
    el.holidayStatus.textContent = "Fetching public holidays...";
    try {
      const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`);
      if (!response.ok) throw new Error("Holiday request failed");
      const holidays = await response.json();
      const added = addHolidayRecords(
        holidays.map((holiday) => ({
          date: holiday.date,
          name: holiday.localName || holiday.name,
          countryCode
        })),
        el.holidayCompany.value,
        el.holidayDepartment.value
      );
      saveDb();
      renderAll();
      el.holidayStatus.textContent = `Applied ${added} holiday${added === 1 ? "" : "s"} for ${countryCode} ${year}.`;
    } catch (error) {
      el.holidayStatus.textContent = "Could not fetch holidays. You can still add them manually below.";
    }
  }

  function addManualHoliday(event) {
    event.preventDefault();
    const existing = (db.holidays || []).find((holiday) => holiday.id === el.manualHolidayId.value);
    const record = {
      date: el.manualHolidayDate.value,
      name: clean(el.manualHolidayName.value),
      countryCode: el.holidayCountry.value
    };
    if (!record.date || !record.name) return;
    if (existing) {
      existing.date = record.date;
      existing.name = record.name;
      existing.countryCode = record.countryCode;
      existing.companyId = el.holidayCompany.value;
      existing.departmentId = el.holidayDepartment.value;
      existing.adminOwnerId = activeAdminId();
      existing.updatedAt = new Date().toISOString();
      saveDb();
      el.manualHolidayForm.reset();
      el.manualHolidayId.value = "";
      renderAll();
      el.holidayStatus.textContent = "Holiday updated.";
      return;
    }
    const added = addHolidayRecords([record], el.holidayCompany.value, el.holidayDepartment.value);
    saveDb();
    el.manualHolidayForm.reset();
    el.manualHolidayId.value = "";
    renderAll();
    el.holidayStatus.textContent = added ? "Manual holiday added." : "That holiday already exists for this scope.";
  }

  function addHolidayRecords(records, companyId, departmentId) {
    db.holidays = db.holidays || [];
    let added = 0;
    records.forEach((record) => {
      const exists = db.holidays.some((holiday) =>
        holiday.date === record.date &&
        holiday.countryCode === record.countryCode &&
        holiday.companyId === companyId &&
        holiday.departmentId === departmentId
      );
      if (exists) return;
      db.holidays.push({
        id: makeId("hol"),
        date: record.date,
        name: record.name,
        countryCode: record.countryCode,
        companyId,
        departmentId,
        adminOwnerId: activeAdminId(),
        createdAt: new Date().toISOString()
      });
      added += 1;
    });
    return added;
  }

  function renderHolidays() {
    const year = String(el.holidayYear.value || session.month.slice(0, 4));
    const countryCode = el.holidayCountry.value || "RO";
    const companyId = el.holidayCompany.value || "all";
    const departmentId = el.holidayDepartment.value || "all";
    const holidays = (db.holidays || [])
      .filter((holiday) => holiday.adminOwnerId === activeAdminId())
      .filter((holiday) => holiday.date.startsWith(`${year}-`))
      .filter((holiday) => holiday.countryCode === countryCode)
      .filter((holiday) => companyId === "all" || holiday.companyId === companyId || holiday.companyId === "all")
      .filter((holiday) => departmentId === "all" || holiday.departmentId === departmentId || holiday.departmentId === "all")
      .sort((a, b) => a.date.localeCompare(b.date));

    el.holidaysList.innerHTML = holidays.length
      ? holidays.map((holiday) => holidayCard(holiday)).join("")
      : `<p class="hint">No holidays for this selection yet.</p>`;
    el.holidaysList.querySelectorAll("[data-delete-holiday]").forEach((button) => {
      button.addEventListener("click", () => deleteHoliday(button.dataset.deleteHoliday));
    });
    el.holidaysList.querySelectorAll("[data-edit-holiday]").forEach((button) => {
      button.addEventListener("click", () => editHoliday(button.dataset.editHoliday));
    });
  }

  function holidayCard(holiday) {
    const scope = [
      holiday.companyId === "all" ? "All companies" : companyById(holiday.companyId)?.name || "Company",
      holiday.departmentId === "all" ? "All departments" : departmentById(holiday.departmentId)?.name || "Department"
    ].join(" - ");
    return `<article class="directory-row">
      <div><strong>${escapeHtml(holiday.name)}</strong><span>${holiday.date} - ${holiday.countryCode}</span></div>
      <div><span>${escapeHtml(scope)}</span></div>
      <div class="row-actions">
        <button type="button" class="secondary" data-edit-holiday="${holiday.id}">Edit</button>
        <button type="button" class="danger" data-delete-holiday="${holiday.id}">Delete</button>
      </div>
    </article>`;
  }

  function editHoliday(id) {
    const holiday = (db.holidays || []).find((item) => item.id === id);
    if (!holiday) return;
    el.manualHolidayId.value = holiday.id;
    el.manualHolidayDate.value = holiday.date;
    el.manualHolidayName.value = holiday.name;
    el.holidayCountry.value = holiday.countryCode;
    el.holidayCompany.value = holiday.companyId;
    fillHolidayDepartmentOptions();
    el.holidayDepartment.value = holiday.departmentId;
    el.holidayStatus.textContent = "Editing holiday. Change the fields and submit the manual form.";
  }

  function deleteHoliday(id) {
    const holiday = (db.holidays || []).find((item) => item.id === id);
    if (!holiday) return;
    if (!window.confirm(`Delete holiday ${holiday.name} on ${holiday.date}?`)) return;
    db.holidays = db.holidays.filter((item) => item.id !== id);
    saveDb();
    renderAll();
  }

  function fillEmployeeFormOptions() {
    const roleChoices = currentUser().role === "admin_account"
      ? ["payroll_admin", "employee", "team_leader", "department_manager", "company_manager"]
      : ["employee", "team_leader", "department_manager", "company_manager"];
    el.employeeRole.innerHTML = roleChoices
      .map((role) => option(role, ROLES[role]))
      .join("");
    const companies = accessibleCompanies();
    el.employeeCompany.innerHTML = companies.map((company) => option(company.id, company.name, company.id === session.activeCompanyId)).join("");
    el.employeeCompanyAccess.innerHTML = companies.map((company) => `
      <label>
        <input type="checkbox" value="${escapeAttr(company.id)}" />
        <span>${escapeHtml(company.name)}</span>
      </label>
    `).join("");
    syncCompanyAccessVisibility();
    fillEmployeeDepartmentOptions();
    fillReportingOptions();
  }

  function syncCompanyAccessVisibility() {
    const isPayroll = el.employeeRole.value === "payroll_admin";
    el.employeeCompanyAccess.closest(".field").hidden = !isPayroll;
    if (isPayroll && !selectedCompanyAccess().length && el.employeeCompany.value) {
      el.employeeCompanyAccess.querySelectorAll("input").forEach((input) => {
        input.checked = input.value === el.employeeCompany.value;
      });
    }
  }

  function selectedCompanyAccess() {
    return Array.from(el.employeeCompanyAccess.querySelectorAll("input:checked")).map((input) => input.value);
  }

  function fillEmployeeDepartmentOptions() {
    const companyId = el.employeeCompany.value || session.activeCompanyId;
    el.employeeDepartment.innerHTML = option("", "No department") +
      departments().filter((department) => department.companyId === companyId).map((department) => option(department.id, department.name)).join("");
    fillReportingOptions();
  }

  function fillReportingOptions() {
    const companyId = el.employeeCompany.value || session.activeCompanyId;
    const departmentId = el.employeeDepartment.value;
    const managers = users().filter((user) => user.companyId === companyId && ["department_manager", "company_manager"].includes(user.role));
    const leaders = users()
      .filter((user) => user.companyId === companyId && ["team_leader", "company_manager"].includes(user.role))
      .filter((user) => !departmentId || user.role === "company_manager" || user.departmentId === departmentId);
    el.employeeReportsTo.innerHTML = option("", "None") + managers.map((user) => option(user.id, user.name)).join("");
    el.employeeTeamLeader.innerHTML = option("", "None") + leaders.map((user) => option(user.id, user.name)).join("");
  }

  function prefillReporting() {
    fillReportingOptions();
    const department = departmentById(el.employeeDepartment.value);
    const companyManager = users().find((user) => user.companyId === el.employeeCompany.value && user.role === "company_manager");
    if (department) {
      el.employeeReportsTo.value = department.managerId || companyManager?.id || "";
      el.employeeTeamLeader.value = department.teamLeaderId || companyManager?.id || "";
    }
  }

  function saveEmployee(event) {
    event.preventDefault();
    const id = el.employeeId.value || makeId("u");
    const existing = userById(id);
    const user = {
      id,
      name: clean(el.employeeName.value),
      email: clean(el.employeeEmail.value).toLowerCase(),
      identificationNumber: clean(el.employeeIdentification.value),
      position: clean(el.employeePosition.value),
      password: el.employeePassword.value,
      startDate: el.employeeStartDate.value,
      endDate: el.employeeEndDate.value,
      role: el.employeeRole.value,
      companyId: el.employeeRole.value === "payroll_admin" ? "" : el.employeeCompany.value,
      departmentId: el.employeeRole.value === "company_manager" ? "" : el.employeeDepartment.value,
      reportsToId: el.employeeReportsTo.value,
      teamLeaderId: el.employeeTeamLeader.value,
      coAvailable: Number(el.employeeCo.value || 0),
      adminOwnerId: activeAdminId(),
      permittedCompanyIds: el.employeeRole.value === "payroll_admin" ? selectedCompanyAccess() : [],
      createdAt: existing?.createdAt || new Date().toISOString()
    };
    if (!user.name || !user.email || !user.identificationNumber || !user.position || !user.password || !user.startDate) {
      window.alert("Name, email, identification number, position, password, and start date are required.");
      return;
    }
    const emailTaken = users().some((item) => item.id !== id && clean(item.email).toLowerCase() === user.email);
    if (emailTaken) {
      window.alert("That email is already used by another user.");
      return;
    }
    if (existing) {
      db.users = db.users.map((item) => (item.id === id ? user : item));
    } else {
      db.users.push(user);
    }
    saveDb();
    resetEmployeeForm();
    renderAll();
  }

  function editEmployee(id) {
    const user = userById(id);
    el.employeeId.value = user.id;
    el.employeeName.value = user.name;
    el.employeeEmail.value = user.email || "";
    el.employeeIdentification.value = user.identificationNumber || "";
    el.employeePosition.value = user.position || "";
    el.employeePassword.value = user.password || "";
    el.employeeStartDate.value = user.startDate || todayIso();
    el.employeeEndDate.value = user.endDate || "";
    el.employeeRole.value = user.role;
    el.employeeCompany.value = user.role === "payroll_admin" ? (user.permittedCompanyIds?.[0] || session.activeCompanyId) : user.companyId;
    el.employeeCompanyAccess.querySelectorAll("input").forEach((input) => {
      input.checked = (user.permittedCompanyIds || []).includes(input.value);
    });
    syncCompanyAccessVisibility();
    fillEmployeeDepartmentOptions();
    el.employeeDepartment.value = user.departmentId;
    fillReportingOptions();
    el.employeeReportsTo.value = user.reportsToId;
    el.employeeTeamLeader.value = user.teamLeaderId;
    el.employeeCo.value = user.coAvailable || 0;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteEmployee(id) {
    const user = userById(id);
    if (!window.confirm(`Delete employee ${user.name}? This also removes timesheet entries.`)) return;
    db.users = db.users.filter((item) => item.id !== id);
    Object.values(db.entries).forEach((companyData) => {
      Object.values(companyData).forEach((monthData) => delete monthData[id]);
    });
    saveDb();
    renderAll();
  }

  function deleteCurrentAdminAccount() {
    const admin = currentUser();
    if (admin.role !== "admin_account") return;
    const message = [
      `Delete Admin Account ${admin.name}?`,
      "This permanently deletes this admin environment:",
      "- all companies owned by this Admin Account",
      "- all departments, holidays, logs, timesheets, leave requests",
      "- all associated Payroll Admin and employee accounts",
      "Type DELETE to confirm."
    ].join("\n");
    if (window.prompt(message) !== "DELETE") return;
    const companyIds = new Set(db.companies.filter((company) => company.ownerAdminId === admin.id).map((company) => company.id));
    const userIds = new Set(db.users
      .filter((user) => user.id === admin.id || user.adminOwnerId === admin.id || companyIds.has(user.companyId))
      .map((user) => user.id));
    db.leaveRequests = (db.leaveRequests || []).filter((request) => !userIds.has(request.employeeId) && !companyIds.has(request.companyId));
    db.holidays = (db.holidays || []).filter((holiday) => holiday.adminOwnerId !== admin.id && !companyIds.has(holiday.companyId));
    db.departments = (db.departments || []).filter((department) => !companyIds.has(department.companyId));
    db.companies = db.companies.filter((company) => !companyIds.has(company.id));
    userIds.forEach((id) => {
      Object.values(db.entries || {}).forEach((companyData) => {
        Object.values(companyData || {}).forEach((monthData) => delete monthData[id]);
      });
    });
    companyIds.forEach((id) => delete db.entries[id]);
    db.users = db.users.filter((user) => !userIds.has(user.id));
    db.logs.company = (db.logs.company || []).filter((item) => item.adminOwnerId !== admin.id);
    db.logs.department = (db.logs.department || []).filter((item) => item.adminOwnerId !== admin.id);
    saveDb();
    logout();
  }

  function resetEmployeeForm() {
    el.employeeForm.reset();
    el.employeeId.value = "";
    fillEmployeeFormOptions();
    el.employeeCompany.value = session.activeCompanyId;
    el.employeeCompanyAccess.querySelectorAll("input").forEach((input) => {
      input.checked = false;
    });
    syncCompanyAccessVisibility();
    fillEmployeeDepartmentOptions();
    el.employeeStartDate.value = todayIso();
    el.employeeEndDate.value = "";
    updateCoEntitlementFromDates();
  }

  function updateCoEntitlementFromDates() {
    if (!el.employeeStartDate.value) return;
    el.employeeCo.value = calculateCoEntitlement(el.employeeStartDate.value, el.employeeEndDate.value);
  }

  function calculateCoEntitlement(startIso, endIso) {
    const start = parseIsoDate(startIso);
    if (!start) return 0;
    const end = parseIsoDate(endIso) || new Date(start.getFullYear(), 11, 31);
    const finalDate = new Date(Math.min(end.getTime(), new Date(start.getFullYear(), 11, 31).getTime()));
    if (finalDate < start) return 0;
    let total = 0;
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= finalDate) {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const activeStart = start > monthStart ? start : monthStart;
      const activeEnd = finalDate < monthEnd ? finalDate : monthEnd;
      if (activeEnd >= activeStart) {
        const daysInMonth = monthEnd.getDate();
        const activeDays = Math.floor((activeEnd - activeStart) / 86400000) + 1;
        total += 1.75 * (activeDays / daysInMonth);
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return Number(total.toFixed(2));
  }

  function userCard(user) {
    return `<article class="directory-row">
      <div><strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(user.email || "")} - ${escapeHtml(user.identificationNumber || "")}</span></div>
      <div><span>${ROLES[user.role]} - ${escapeHtml(user.position || "No position")} - ${deptName(user.departmentId)} - CO ${user.coAvailable || 0}</span></div>
      <div class="row-actions">
        <button type="button" class="secondary" data-edit-user="${user.id}">Edit</button>
        <button type="button" class="danger" data-delete-user="${user.id}">Delete</button>
      </div>
    </article>`;
  }

  function renderCompanySetup() {
    el.companiesList.innerHTML = accessibleCompanies().map((company) => {
      const count = departments().filter((department) => department.companyId === company.id).length;
      return `<article class="directory-row">
        <div class="company-row-title">
          ${company.logo?.dataUrl ? `<img src="${escapeAttr(company.logo.dataUrl)}" alt="${escapeAttr(company.name)} logo" />` : ""}
          <div><strong>${escapeHtml(company.name)}</strong><span>${count} departments</span></div>
        </div>
        <button type="button" class="danger" data-delete-company="${company.id}">Delete</button>
      </article>`;
    }).join("");
    el.companiesList.querySelectorAll("[data-delete-company]").forEach((button) => {
      button.addEventListener("click", () => deleteCompany(button.dataset.deleteCompany));
    });
    renderLogs();
  }

  async function createCompany(event) {
    event.preventDefault();
    const name = clean(el.companyName.value);
    if (!name) return;
    const logo = el.companyLogo.files[0] ? await readFileMeta(el.companyLogo.files[0]) : null;
    const company = {
      id: makeId("org"),
      name,
      logo,
      ownerAdminId: activeAdminId(),
      createdBy: currentUser().id,
      createdAt: new Date().toISOString()
    };
    db.companies.push(company);
    if (currentUser().role === "payroll_admin") {
      currentUser().permittedCompanyIds = Array.from(new Set([...(currentUser().permittedCompanyIds || []), company.id]));
    }
    addLog("company", `Created company ${name}`);
    clean(el.companyDepartments.value)
      .split(",")
      .map(clean)
      .filter(Boolean)
      .forEach((departmentName) => {
        db.departments.push(defaultDepartment(departmentName, company.id));
        addLog("company", `Added department ${departmentName} to ${name}`);
      });
    el.companyForm.reset();
    el.companyLogoPreview.innerHTML = "";
    session.activeCompanyId = company.id;
    saveSession();
    saveDb();
    renderAll();
  }

  async function previewCompanyLogo() {
    const file = el.companyLogo.files[0];
    if (!file) {
      el.companyLogoPreview.innerHTML = "";
      return;
    }
    const logo = await readFileMeta(file);
    el.companyLogoPreview.innerHTML = `<img src="${escapeAttr(logo.dataUrl)}" alt="Company logo preview" /><span>${escapeHtml(logo.name)}</span>`;
  }

  function deleteCompany(id) {
    const company = companyById(id);
    if (!window.confirm(`Delete company ${company.name}? Departments, users, and entries for it will be removed.`)) return;
    db.companies = db.companies.filter((item) => item.id !== id);
    db.departments = db.departments.filter((item) => item.companyId !== id);
    db.users = db.users.filter((item) => item.role === "admin_account" || item.role === "payroll_admin" || item.companyId !== id);
    delete db.entries[id];
    addLog("company", `Deleted company ${company.name}`);
    session.activeCompanyId = accessibleCompanies()[0]?.id || "";
    saveSession();
    saveDb();
    renderAll();
  }

  function renderDepartmentSetup() {
    fillDepartmentFormOptions();
    el.departmentsList.innerHTML = departments().map((department) => departmentCard(department)).join("");
    el.departmentsList.querySelectorAll("[data-edit-dept]").forEach((button) => {
      button.addEventListener("click", () => editDepartment(button.dataset.editDept));
    });
    el.departmentsList.querySelectorAll("[data-delete-dept]").forEach((button) => {
      button.addEventListener("click", () => deleteDepartment(button.dataset.deleteDept));
    });
    renderLogs();
  }

  function fillDepartmentFormOptions() {
    el.departmentCompany.innerHTML = accessibleCompanies().map((company) => option(company.id, company.name, company.id === session.activeCompanyId)).join("");
    fillDepartmentManagerOptions();
  }

  function fillDepartmentManagerOptions() {
    const companyId = el.departmentCompany.value || session.activeCompanyId;
    const managers = users().filter((user) => user.companyId === companyId && ["department_manager", "company_manager"].includes(user.role));
    const leaders = users().filter((user) => user.companyId === companyId && ["team_leader", "company_manager"].includes(user.role));
    el.departmentManager.innerHTML = option("", "None") + managers.map((user) => option(user.id, user.name)).join("");
    el.departmentTeamLeader.innerHTML = option("", "None") + leaders.map((user) => option(user.id, user.name)).join("");
  }

  function saveDepartment(event) {
    event.preventDefault();
    const existing = departmentById(el.departmentId.value);
    const id = existing?.id || makeId("dep");
    const companyManager = users().find((user) => user.companyId === el.departmentCompany.value && user.role === "company_manager");
      const department = {
      id,
      name: clean(el.departmentName.value),
      companyId: el.departmentCompany.value,
      adminOwnerId: companyById(el.departmentCompany.value)?.ownerAdminId || activeAdminId(),
      managerId: el.departmentManager.value || companyManager?.id || "",
      teamLeaderId: el.departmentTeamLeader.value || companyManager?.id || "",
      shiftHours: Number(el.departmentShiftHours.value || 8),
      workDays: selectedWorkDays(),
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (!department.name) return;
    if (existing) {
      db.departments = db.departments.map((item) => (item.id === id ? department : item));
      addLog("department", `Updated department ${department.name}: manager/team leader or shift settings changed`);
    } else {
      db.departments.push(department);
      addLog("department", `Created department ${department.name} for ${companyById(department.companyId)?.name || "company"}`);
    }
    saveDb();
    resetDepartmentForm();
    renderAll();
  }

  function editDepartment(id) {
    const department = departmentById(id);
    el.departmentId.value = department.id;
    el.departmentName.value = department.name;
    el.departmentCompany.value = department.companyId;
    fillDepartmentManagerOptions();
    el.departmentManager.value = department.managerId;
    el.departmentTeamLeader.value = department.teamLeaderId;
    el.departmentShiftHours.value = department.shiftHours;
    document.querySelectorAll("[name='workDay']").forEach((box) => {
      box.checked = department.workDays.includes(Number(box.value));
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteDepartment(id) {
    const department = departmentById(id);
    if (!window.confirm(`Delete department ${department.name}? Employees will keep no department until reassigned.`)) return;
    db.departments = db.departments.filter((item) => item.id !== id);
    db.users = db.users.map((user) => user.departmentId === id ? { ...user, departmentId: "", reportsToId: "", teamLeaderId: "" } : user);
    addLog("department", `Deleted department ${department.name}`);
    saveDb();
    renderAll();
  }

  function resetDepartmentForm() {
    el.departmentForm.reset();
    el.departmentId.value = "";
    document.querySelectorAll("[name='workDay']").forEach((box) => {
      box.checked = [1, 2, 3, 4, 5].includes(Number(box.value));
    });
    fillDepartmentFormOptions();
  }

  function departmentCard(department) {
    const days = department.workDays.map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).join(", ");
    return `<article class="directory-row">
      <div><strong>${escapeHtml(department.name)}</strong><span>${companyById(department.companyId)?.name || "No company"} - ${department.shiftHours}h - ${days}</span></div>
      <div><span>Manager: ${userById(department.managerId)?.name || "None"} | Leader: ${userById(department.teamLeaderId)?.name || "None"}</span></div>
      <div class="row-actions">
        <button type="button" class="secondary" data-edit-dept="${department.id}">Edit</button>
        <button type="button" class="danger" data-delete-dept="${department.id}">Delete</button>
      </div>
    </article>`;
  }

  function renderLogs() {
    const adminId = activeAdminId();
    el.companyLog.innerHTML = logHtml((db.logs.company || []).filter((item) => item.adminOwnerId === adminId));
    el.departmentLog.innerHTML = logHtml((db.logs.department || []).filter((item) => item.adminOwnerId === adminId));
  }

  function exportVisibleCsv() {
    const days = daysInMonth(session.month);
    const visible = visibleEmployees();
    const rows = [["Employee", "Email", "Identification Number", "Position", "Department", ...days.map((day) => day.iso), "Worked", "Norm", "Difference", "Overtime", "CO", "CM", "SE", "CO Left"]];
    visible.forEach((employee) => {
      const totals = totalsFor(employee, days);
      rows.push([
        employee.name,
        employee.email || "",
        employee.identificationNumber || "",
        employee.position || "",
        deptName(employee.departmentId),
        ...days.map((day) => {
          const entry = getEntry(employee.id, day.iso);
          return entry ? entry.hours ?? "" : "";
        }),
        formatHours(totals.worked),
        formatHours(totals.expected),
        formatSigned(totals.difference),
        formatHours(totals.overtime),
        totals.vacationDays,
        totals.medicalDays,
        totals.specialEventDays,
        formatHours(Math.max(0, Number(employee.coAvailable || 0) - totals.vacationDays))
      ]);
    });
    download(`tableshifts-${session.month}.csv`, rows.map((row) => row.map(csv).join(",")).join("\n"), "text/csv");
  }

  function getEntry(employeeId, iso) {
    return db.entries[session.activeCompanyId]?.[session.month]?.[employeeId]?.[iso] || null;
  }

  function setEntry(employeeId, iso, value) {
    db.entries[session.activeCompanyId] = db.entries[session.activeCompanyId] || {};
    db.entries[session.activeCompanyId][session.month] = db.entries[session.activeCompanyId][session.month] || {};
    db.entries[session.activeCompanyId][session.month][employeeId] = db.entries[session.activeCompanyId][session.month][employeeId] || {};
    db.entries[session.activeCompanyId][session.month][employeeId][iso] = value;
  }

  function deleteEntry(employeeId, iso) {
    const monthData = db.entries[session.activeCompanyId]?.[session.month]?.[employeeId];
    if (monthData) delete monthData[iso];
  }

  function loadDb() {
    const defaults = clone(window.TABLESHIFTS_DEFAULTS);
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!stored || !Array.isArray(stored.users)) return defaults;
      return migrate(stored);
    } catch (error) {
      return defaults;
    }
  }

  function migrate(value) {
    value.logs = value.logs || { company: [], department: [] };
    value.logs.company = value.logs.company || [];
    value.logs.department = value.logs.department || [];
    value.entries = value.entries || {};
    value.holidays = value.holidays || [];
    value.leaveRequests = value.leaveRequests || [];
    value.users = value.users || [];
    const firstAdminId = value.users.find((user) => user.role === "admin_account")?.id || "";
    value.companies = (value.companies || []).map((company) => ({
      ...company,
      logo: company.logo || null,
      ownerAdminId: company.ownerAdminId || firstAdminId,
      createdBy: company.createdBy || firstAdminId
    }));
    value.departments = (value.departments || []).map((department) => ({
      ...department,
      adminOwnerId: department.adminOwnerId || value.companies.find((company) => company.id === department.companyId)?.ownerAdminId || firstAdminId
    }));
    value.holidays = (value.holidays || []).map((holiday) => ({
      ...holiday,
      adminOwnerId: holiday.adminOwnerId || firstAdminId
    }));
    value.logs.company = (value.logs.company || []).map((item) => ({
      ...item,
      adminOwnerId: item.adminOwnerId || firstAdminId
    }));
    value.logs.department = (value.logs.department || []).map((item) => ({
      ...item,
      adminOwnerId: item.adminOwnerId || firstAdminId
    }));
    const allCompanyIds = value.companies.map((company) => company.id);
    value.users = (value.users || []).map((user) => ({
      ...user,
      email: user.email || demoEmailFor(user),
      identificationNumber: user.identificationNumber || demoIdentificationFor(user),
      position: user.position || defaultPositionFor(user),
      startDate: user.startDate || "2026-01-01",
      endDate: user.endDate || "",
      adminOwnerId: user.role === "admin_account" ? user.id : user.adminOwnerId || firstAdminId,
      permittedCompanyIds: user.role === "payroll_admin" ? user.permittedCompanyIds || allCompanyIds : user.permittedCompanyIds || []
    }));
    return value;
  }

  function demoEmailFor(user) {
    const domain = String(user.companyId || "company").replace(/^org-/, "").replace(/[^a-z0-9]+/gi, "") || "company";
    const local = clean(user.name).toLowerCase().replace(/[^a-z0-9]+/g, ".");
    return `${local}@${domain}.local`;
  }

  function demoIdentificationFor(user) {
    return `${(user.companyId || "global").slice(0, 3).toUpperCase()}-${user.id.replace(/[^a-z0-9]/gi, "").slice(-4).toUpperCase()}`;
  }

  function defaultPositionFor(user) {
    return ROLES[user.role] || "Employee";
  }

  function saveDb() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  function tabsForUser() {
    const tabs = [
      { id: "timesheet", label: "Timesheet" },
      { id: "leave", label: "Leave Requests" },
      { id: "charts", label: "Charts" }
    ];
    if (canManageSetup()) {
      tabs.push({ id: "companies", label: "Company Setup" });
      tabs.push({ id: "departments", label: "Department Setup" });
      tabs.push({ id: "holidays", label: "National Holidays" });
      tabs.push({ id: "users", label: "User Management" });
    }
    return tabs;
  }

  function tabTitle(id) {
    return tabsForUser().find((tab) => tab.id === id)?.label || "Timesheet";
  }

  function defaultDepartment(name, companyId) {
    const now = new Date().toISOString();
    const companyManager = users().find((user) => user.companyId === companyId && user.role === "company_manager");
    return {
      id: makeId("dep"),
      name,
      companyId,
      adminOwnerId: companyById(companyId)?.ownerAdminId || activeAdminId(),
      managerId: companyManager?.id || "",
      teamLeaderId: companyManager?.id || "",
      workDays: [1, 2, 3, 4, 5],
      shiftHours: 8,
      createdAt: now,
      updatedAt: now
    };
  }

  function selectedWorkDays() {
    const days = Array.from(document.querySelectorAll("[name='workDay']:checked")).map((box) => Number(box.value));
    return days.length ? days : [1, 2, 3, 4, 5];
  }

  function addLog(type, text) {
    db.logs[type].unshift({ id: makeId("log"), at: new Date().toISOString(), text, adminOwnerId: activeAdminId() });
  }

  function logHtml(items) {
    if (!items.length) return `<p class="hint">No activity yet.</p>`;
    return items.slice(0, 12).map((item) => `<div class="log-row"><time>${formatDateTime(item.at)}</time><span>${escapeHtml(item.text)}</span></div>`).join("");
  }

  function daysInMonth(month) {
    const [year, monthNumber] = month.split("-").map(Number);
    const date = new Date(year, monthNumber - 1, 1);
    const days = [];
    while (date.getMonth() === monthNumber - 1) {
      const day = date.getDate();
      days.push({
        date: new Date(date),
        day,
        iso: `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
        weekdayIndex: date.getDay()
      });
      date.setDate(day + 1);
    }
    return days;
  }

  function dayHeader(day) {
    return `<strong>${day.day}</strong><span>${day.weekday}</span>`;
  }

  function users() {
    return db.users || [];
  }

  function accessibleCompanies(user = currentUser()) {
    if (!user) return [];
    if (user.role === "admin_account") {
      return db.companies.filter((company) => company.ownerAdminId === user.id);
    }
    if (user.role === "payroll_admin") {
      const permitted = new Set([...(user.permittedCompanyIds || [])]);
      db.companies.forEach((company) => {
        if (company.createdBy === user.id) permitted.add(company.id);
      });
      return db.companies.filter((company) => permitted.has(company.id));
    }
    return db.companies.filter((company) => company.id === user.companyId);
  }

  function activeAdminId(user = currentUser()) {
    if (!user) return "";
    if (user.role === "admin_account") return user.id;
    return user.adminOwnerId || companyById(user.companyId)?.ownerAdminId || "root-admin";
  }

  function canManageSetup(user = currentUser()) {
    return ["admin_account", "payroll_admin"].includes(user?.role);
  }

  function departments() {
    const companyIds = new Set(accessibleCompanies().map((company) => company.id));
    return (db.departments || []).filter((department) => companyIds.has(department.companyId));
  }

  function allDepartments() {
    return db.departments || [];
  }

  function currentUser() {
    return userById(session.userId) || users()[0];
  }

  function isPayrollAdmin() {
    return canManageSetup();
  }

  function isTimesheetUser(user) {
    return !["admin_account", "payroll_admin", "company_manager"].includes(user.role);
  }

  function userById(id) {
    return users().find((user) => user.id === id);
  }

  function companyById(id) {
    return db.companies.find((company) => company.id === id);
  }

  function departmentById(id) {
    return allDepartments().find((department) => department.id === id);
  }

  function deptName(id) {
    return departmentById(id)?.name || "No department";
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function div(className) {
    const node = document.createElement("div");
    node.className = className;
    return node;
  }

  function option(value, label, selected) {
    return `<option value="${escapeAttr(value)}"${selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function clean(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function slug(value) {
    return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "file";
  }

  function same(a, b) {
    return clean(a).toLowerCase() === clean(b).toLowerCase();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  function todayIso() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  function parseIsoDate(value) {
    if (!value) return null;
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  }

  function datesBetween(startIso, endIso) {
    const start = parseIsoDate(startIso);
    const end = parseIsoDate(endIso);
    const dates = [];
    if (!start || !end) return dates;
    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      dates.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`);
    }
    return dates;
  }

  function isWeekday(date) {
    return date.getDay() >= 1 && date.getDay() <= 5;
  }

  function formatHours(value) {
    return Number(Number(value || 0).toFixed(2)).toString();
  }

  function formatSigned(value) {
    const number = Number(Number(value || 0).toFixed(2));
    return number > 0 ? `+${number}` : String(number);
  }

  function formatDateTime(value) {
    return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function csv(value) {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function readFileMeta(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl: reader.result
        });
      });
      reader.addEventListener("error", reject);
      reader.readAsDataURL(file);
    });
  }

  function flash(button, text) {
    const original = button.textContent;
    button.textContent = text;
    window.setTimeout(() => {
      button.textContent = original;
    }, 900);
  }
})();
