(function () {
  const STORAGE_KEY = "tableshifts.full.v2";
  const SESSION_KEY = "tableshifts.session.v2";
  const INDIVIDUAL_STORAGE_PREFIX = "tableshifts.individual.";
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
  const ENTRY_COLOR_FIELDS = [
    ["vacation", "CO", "#e4f7e8"],
    ["medical", "CM", "#ffe8e8"],
    ["overtime", "OT", "#fff0d8"],
    ["absence", "AB", "#1d2521"],
    ["special_event", "SE", "#eeeeef"],
    ["holiday", "Holiday", "#fff6d8"]
  ];
  const DEFAULT_ENTRY_COLORS = Object.fromEntries(ENTRY_COLOR_FIELDS.map(([key, , color]) => [key, color]));
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
  let individualTable = null;
  let individualMetaExpanded = false;
  let individualTotalsExpanded = false;
  let pendingIndividualHolidays = [];
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
    individualView: byId("individualView"),
    individualTableBtn: byId("individualTableBtn"),
    individualBackBtn: byId("individualBackBtn"),
    individualCopyLinkBtn: byId("individualCopyLinkBtn"),
    individualLinkLabel: byId("individualLinkLabel"),
    individualMonthPicker: byId("individualMonthPicker"),
    individualExportBtn: byId("individualExportBtn"),
    individualTemplateBtn: byId("individualTemplateBtn"),
    individualImportFile: byId("individualImportFile"),
    individualHolidayCountry: byId("individualHolidayCountry"),
    individualHolidayYear: byId("individualHolidayYear"),
    individualHolidayBtn: byId("individualHolidayBtn"),
    individualHolidayModal: byId("individualHolidayModal"),
    individualHolidaySubtitle: byId("individualHolidaySubtitle"),
    individualHolidayList: byId("individualHolidayList"),
    individualHolidayAddForm: byId("individualHolidayAddForm"),
    individualHolidayDate: byId("individualHolidayDate"),
    individualHolidayName: byId("individualHolidayName"),
    applyIndividualHolidaysBtn: byId("applyIndividualHolidaysBtn"),
    closeIndividualHolidayBtn: byId("closeIndividualHolidayBtn"),
    cancelIndividualHolidaysBtn: byId("cancelIndividualHolidaysBtn"),
    individualGrid: byId("individualGrid"),
    individualNewRowBtn: byId("individualNewRowBtn"),
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
    headerCompanySelect: byId("headerCompanySelect"),
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
    adminsTab: byId("adminsTab"),
    adminUserForm: byId("adminUserForm"),
    adminUserId: byId("adminUserId"),
    adminUserName: byId("adminUserName"),
    adminUserEmail: byId("adminUserEmail"),
    adminUserIdentification: byId("adminUserIdentification"),
    adminUserPosition: byId("adminUserPosition"),
    adminUserPassword: byId("adminUserPassword"),
    adminUserStartDate: byId("adminUserStartDate"),
    adminUserEndDate: byId("adminUserEndDate"),
    adminUserRole: byId("adminUserRole"),
    adminUserCompany: byId("adminUserCompany"),
    adminUserCompanyAccess: byId("adminUserCompanyAccess"),
    resetAdminUserFormBtn: byId("resetAdminUserFormBtn"),
    adminsList: byId("adminsList"),
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
    companyColorFields: byId("companyColorFields"),
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
    arrangeManagementPanels();
    bindLogin();
    bindApp();
    bindIndividual();
    if (individualIdFromUrl()) {
      await openIndividualTable(individualIdFromUrl());
      return;
    }
    await restoreSession();
  }

  function bindLogin() {
    el.loginBtn.addEventListener("click", login);
    el.showCreateAdminBtn.addEventListener("click", () => {
      el.createAdminForm.hidden = !el.createAdminForm.hidden;
    });
    el.individualTableBtn.addEventListener("click", () => openIndividualTable());
    el.createAdminForm.addEventListener("submit", createPayrollAdminFromLogin);
    el.loginEmail.addEventListener("keydown", (event) => {
      if (event.key === "Enter") login();
    });
    el.loginPassword.addEventListener("keydown", (event) => {
      if (event.key === "Enter") login();
    });
  }

  function bindIndividual() {
    el.individualBackBtn.addEventListener("click", () => {
      individualTable = null;
      history.replaceState(null, "", location.pathname);
      el.individualView.hidden = true;
      el.appView.hidden = true;
      el.loginView.hidden = false;
    });
    el.individualCopyLinkBtn.addEventListener("click", async () => {
      const link = individualShareLink();
      try {
        await navigator.clipboard.writeText(link);
        flash(el.individualCopyLinkBtn, "Copied");
      } catch (error) {
        window.prompt("Copy this link", link);
      }
    });
    el.individualMonthPicker.addEventListener("change", () => {
      if (!individualTable) return;
      individualTable.month = el.individualMonthPicker.value || getCurrentMonth();
      saveIndividualTable();
      renderIndividualTable();
    });
    el.individualExportBtn.addEventListener("click", exportIndividualCsv);
    el.individualTemplateBtn.addEventListener("click", downloadIndividualTemplate);
    el.individualImportFile.addEventListener("change", importIndividualCsv);
    el.individualHolidayBtn.addEventListener("click", fetchIndividualHolidays);
    el.individualHolidayAddForm.addEventListener("submit", addPendingIndividualHoliday);
    el.applyIndividualHolidaysBtn.addEventListener("click", applyIndividualHolidays);
    el.closeIndividualHolidayBtn.addEventListener("click", closeIndividualHolidayModal);
    el.cancelIndividualHolidaysBtn.addEventListener("click", closeIndividualHolidayModal);
    el.individualNewRowBtn.addEventListener("click", () => {
      ensureIndividualTable();
      const row = defaultIndividualRow();
      individualTable.rows.push(row);
      stampIndividualHolidaysForRow(row);
      saveIndividualTable();
      renderIndividualTable();
    });
    el.individualHolidayCountry.innerHTML = HOLIDAY_COUNTRIES.map(([code, name]) => option(code, `${name} (${code})`, code === "RO")).join("");
    el.individualHolidayYear.value = new Date().getFullYear();
  }

  function arrangeManagementPanels() {
    const usersSection = byId("usersTab");
    const companySection = byId("companiesTab");
    const departmentSection = byId("departmentsTab");
    if (!usersSection || !companySection || !departmentSection || companySection.dataset.arranged === "true") return;
    companySection.dataset.arranged = "true";
    companySection.querySelector(".section-head h2").textContent = "Companies";
    companySection.querySelector(".section-head p").textContent = "Create companies, expand them, and manage their departments.";
    usersSection.querySelector(".section-head h2").textContent = "Employees";
    usersSection.querySelector(".section-head p").textContent = "Employees, team leaders, department managers, passwords, and reporting lines.";

    const departmentBlock = document.createElement("section");
    departmentBlock.className = "management-block";
    departmentBlock.innerHTML = `<div class="section-head compact"><div><h2>Department inside company</h2><p>Create or edit a department for the selected company.</p></div></div>`;
    departmentBlock.appendChild(byId("departmentForm"));
    companySection.insertBefore(departmentBlock, byId("companiesList"));
    byId("companyLog").closest(".log-card").remove();
    byId("departmentLog").closest(".log-card").remove();
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
    el.headerCompanySelect.addEventListener("change", () => {
      session.activeCompanyId = el.headerCompanySelect.value;
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
    el.employeeRole.addEventListener("change", () => {
      syncCompanyAccessVisibility();
      prefillReporting();
    });
    el.employeeStartDate.addEventListener("change", updateCoEntitlementFromDates);
    el.employeeEndDate.addEventListener("change", updateCoEntitlementFromDates);
    el.adminUserForm.addEventListener("submit", saveAdminUser);
    el.resetAdminUserFormBtn.addEventListener("click", resetAdminUserForm);
    el.adminUserRole.addEventListener("change", syncAdminCompanyAccessVisibility);
    el.leaveRequestForm.addEventListener("submit", submitLeaveRequest);
    el.confirmLeavePreviewBtn.addEventListener("click", confirmLeaveRequestDraft);
    el.cancelLeavePreviewBtn.addEventListener("click", cancelLeaveRequestDraft);
    el.cancelLeavePreviewBottomBtn.addEventListener("click", cancelLeaveRequestDraft);
    el.companyForm.addEventListener("submit", createCompany);
    el.companyLogo.addEventListener("change", previewCompanyLogo);
    renderCompanyColorInputs();
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
    session.activeCompanyId = ["admin_account", "payroll_admin", "company_manager"].includes(user.role)
      ? accessibleCompanies(user)[0]?.id || ""
      : user.companyId;
    session.activeTab = "timesheet";
    session.month = getCurrentMonth();
    fillMonthSelect(el.monthPicker, session.month);
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
      fillMonthSelect(el.monthPicker, session.month);
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
        emailRedirectTo: window.location.origin,
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
    await loadSupabaseWorkspace(profile);
    const user = userById(profile.id) || profileToLocalUser(profile);
    if (!userById(user.id)) {
      db.users = db.users || [];
      db.users.push(user);
      saveDb();
    }
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

  async function loadSupabaseWorkspace(profile) {
    if (!useSupabaseAuth() || !profile?.environment_id) return;
    const environmentId = profile.environment_id;
    const [environmentResult, profilesResult, companiesResult, departmentsResult, accessResult, holidaysResult] = await Promise.all([
      supabase.from("admin_environments").select("*").eq("id", environmentId).maybeSingle(),
      supabase.from("profiles").select("*").eq("environment_id", environmentId),
      supabase.from("companies").select("*").eq("environment_id", environmentId),
      supabase.from("departments").select("*").eq("environment_id", environmentId),
      supabase.from("payroll_company_access").select("*").eq("environment_id", environmentId),
      supabase.from("national_holidays").select("*").eq("environment_id", environmentId)
    ]);
    [environmentResult, profilesResult, companiesResult, departmentsResult, accessResult, holidaysResult].forEach((result) => {
      if (result.error) throw result.error;
    });
    const ownerId = environmentResult.data?.owner_user_id || profile.id;
    const accessByUser = new Map();
    (accessResult.data || []).forEach((item) => {
      if (!accessByUser.has(item.payroll_user_id)) accessByUser.set(item.payroll_user_id, []);
      accessByUser.get(item.payroll_user_id).push(item.company_id);
    });
    db.users = (profilesResult.data || []).map((item) => profileToLocalUser(item, ownerId, accessByUser.get(item.id) || []));
    db.companies = (companiesResult.data || []).map((company) => ({
      id: company.id,
      name: company.name,
      logo: company.logo_path ? { path: company.logo_path, name: "Company logo" } : null,
      entryColors: normalizeEntryColors(company.entry_colors),
      ownerAdminId: ownerId,
      createdBy: company.created_by || ownerId,
      createdAt: company.created_at || new Date().toISOString()
    }));
    db.departments = (departmentsResult.data || []).map((department) => ({
      id: department.id,
      name: department.name,
      companyId: department.company_id,
      adminOwnerId: ownerId,
      managerId: department.manager_user_id || "",
      teamLeaderId: department.team_leader_user_id || "",
      shiftHours: Number(department.shift_hours || 8),
      workDays: department.work_days || [1, 2, 3, 4, 5],
      createdAt: department.created_at || new Date().toISOString(),
      updatedAt: department.updated_at || new Date().toISOString()
    }));
    db.holidays = (holidaysResult.data || []).map((holiday) => ({
      id: holiday.id,
      adminOwnerId: ownerId,
      companyId: holiday.company_id || "all",
      departmentId: holiday.department_id || "all",
      countryCode: holiday.country_code,
      date: holiday.holiday_date,
      name: holiday.name
    }));
    db.entries = db.entries || {};
    db.leaveRequests = db.leaveRequests || [];
    db.logs = db.logs || { company: [], department: [] };
    saveDb();
  }

  function profileToLocalUser(profile, environmentOwnerId = "", permittedCompanyIds = []) {
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
      adminOwnerId: profile.role === "admin_account" ? profile.id : environmentOwnerId,
      environmentId: profile.environment_id || "",
      permittedCompanyIds,
      createdAt: profile.created_at || new Date().toISOString()
    };
  }

  function startAuthenticatedSession(user) {
    session.userId = user.id;
    session.activeCompanyId = ["admin_account", "payroll_admin", "company_manager"].includes(user.role)
      ? accessibleCompanies(user)[0]?.id || ""
      : user.companyId;
    session.activeTab = "timesheet";
    session.month = getCurrentMonth();
    fillMonthSelect(el.monthPicker, session.month);
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

  async function currentAccessToken() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session?.access_token) throw new Error("Your session expired. Please log in again.");
    return data.session.access_token;
  }

  async function upsertSupabaseUser(user, password, permittedCompanyIds = []) {
    const token = await currentAccessToken();
    const response = await fetch("/api/upsert-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ user, password, permittedCompanyIds })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Could not save the Supabase account.");
    return profileToLocalUser(payload.profile, payload.environmentOwnerId, payload.permittedCompanyIds || []);
  }

  async function deleteSupabaseUser(userId) {
    if (!useSupabaseAuth()) return;
    const token = await currentAccessToken();
    const response = await fetch("/api/delete-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ userId })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Could not delete the Supabase account.");
  }

  async function saveCompanyToSupabase(company) {
    if (!useSupabaseAuth()) return;
    const { error } = await supabase.from("companies").upsert({
      id: company.id,
      environment_id: currentUser().environmentId,
      name: company.name,
      logo_path: company.logo?.path || null,
      entry_colors: normalizeEntryColors(company.entryColors),
      created_by: company.createdBy || currentUser().id
    }, { onConflict: "id" });
    if (error) throw error;
  }

  async function deleteCompanyFromSupabase(id) {
    if (!useSupabaseAuth()) return;
    const { error } = await supabase.from("companies").delete().eq("id", id);
    if (error) throw error;
  }

  async function saveDepartmentToSupabase(department) {
    if (!useSupabaseAuth()) return;
    const { error } = await supabase.from("departments").upsert({
      id: department.id,
      environment_id: currentUser().environmentId,
      company_id: department.companyId,
      name: department.name,
      manager_user_id: department.managerId || null,
      team_leader_user_id: department.teamLeaderId || null,
      shift_hours: department.shiftHours,
      work_days: department.workDays
    }, { onConflict: "id" });
    if (error) throw error;
  }

  async function deleteDepartmentFromSupabase(id) {
    if (!useSupabaseAuth()) return;
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) throw error;
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
      renderAdminsManagement();
    }
  }

  function renderShell() {
    const user = currentUser();
    const company = companyById(session.activeCompanyId);
    el.pageTitle.textContent = tabTitle(session.activeTab);
    fillHeaderCompanySelect(user);
    el.topIdentity.innerHTML = `<strong>${escapeHtml(user.name)}</strong><span>${ROLES[user.role]} - ${escapeHtml(user.email || "")}</span>`;
    const pendingCount = pendingApprovalsForCurrentUser().length;
    el.pendingApprovalsBtn.hidden = !["team_leader", "department_manager", "company_manager"].includes(user.role);
    el.pendingApprovalsBtn.textContent = pendingCount ? `${pendingCount} pending leave` : "No pending leave";
    el.pendingApprovalsBtn.classList.toggle("has-pending", pendingCount > 0);
    fillMonthSelect(el.monthPicker, session.month);
    el.tabs.innerHTML = navHtml();
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

  function fillHeaderCompanySelect(user = currentUser()) {
    const companies = accessibleCompanies(user);
    el.headerCompanySelect.hidden = !companies.length;
    el.headerCompanySelect.innerHTML = companies.map((company) => option(company.id, company.name, company.id === session.activeCompanyId)).join("");
    if (companies.length && !companies.some((company) => company.id === session.activeCompanyId)) {
      session.activeCompanyId = companies[0].id;
      el.headerCompanySelect.value = session.activeCompanyId;
      saveSession();
    }
  }

  function navHtml() {
    const tabs = tabsForUser();
    const plain = tabs.filter((tab) => !tab.group);
    const management = tabs.filter((tab) => tab.group === "management");
    return [
      ...plain.map((tab) => `<button class="${tab.id === session.activeTab ? "active" : ""}" data-tab="${tab.id}" type="button">${tab.label}</button>`),
      management.length ? `<details class="nav-group" open><summary>Management</summary>${management.map((tab) => `<button class="${tab.id === session.activeTab ? "active" : ""}" data-tab="${tab.id}" type="button">${tab.label}</button>`).join("")}</details>` : ""
    ].join("");
  }

  function showActiveTab() {
    ["timesheet", "leave", "charts", "companies", "departments", "holidays", "users", "admins"].forEach((tab) => {
      const panel = byId(`${tab}Tab`);
      if (panel) panel.hidden = session.activeTab !== tab;
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
    nameCell.innerHTML = `<strong>${escapeHtml(employee.name)}</strong><span>${escapeHtml(employee.position || "No position")}</span>`;
    el.timesheetGrid.appendChild(nameCell);

    days.forEach((day) => {
      const entry = getEntry(employee.id, day.iso);
      const cell = div(`day-cell ${editable ? "editable" : "locked"}`);
      const department = departmentById(employee.departmentId);
      const holiday = holidayForEmployee(employee, day.iso);
      const isWorkDay = isExpectedWorkDay(employee, day, department);
      cell.dataset.workday = isWorkDay ? "true" : "false";
      if (holiday) {
        cell.dataset.holiday = "true";
        applyTimesheetCellColor(cell, "holiday", employee.companyId);
        cell.title = holiday.name;
      }
      if (entry) {
        cell.dataset.entryType = entry.type;
        const parts = entryParts(entry, department);
        applyTimesheetCellColor(cell, entry.type, employee.companyId);
        cell.title = entryTooltip(entry, department, holiday);
        cell.innerHTML = `<strong>${ENTRY_LABELS[entry.type] || "N"}</strong><span>${parts}</span>`;
      } else if (pendingLeaveForEmployee(employee.id, day.iso)) {
        cell.innerHTML = `<strong>REQ</strong>`;
      } else {
        cell.innerHTML = `<span class="empty-cell">${holiday ? "H" : ""}</span>`;
      }
      if (editable) {
        cell.tabIndex = 0;
        cell.setAttribute("role", "button");
        cell.setAttribute("aria-label", cell.title || `Edit ${employee.name} on ${day.iso}`);
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
      const companyIds = companyIdsForUser(user);
      list = list.filter((item) => companyIds.has(item.companyId));
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
    if (["admin_account", "payroll_admin"].includes(user.role)) return false;
    if (user.role === "company_manager") return companyIdsForUser(user).has(employee.companyId);
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
    syncEntryTypeOptions(false);
    el.entryHours.value = entry.hours || "";
    el.entryFile.value = "";
    renderEntryAttachmentMeta(entry);
    updateEditorHelp();
    el.cellEditor.hidden = false;
  }

  function openIndividualEditor(rowId, iso) {
    const row = individualTable.rows.find((item) => item.id === rowId);
    const entry = normalizeIndividualEntry(individualTable.entries[rowId]?.[iso]) || { type: "normal", hours: 8 };
    session.editingEntry = { individual: true, rowId, iso };
    el.editorTitle.textContent = row?.name || "Individual row";
    el.editorSubtitle.textContent = iso;
    el.entryType.value = entry.type;
    syncEntryTypeOptions(true);
    el.entryHours.value = entry.hours || "";
    el.entryFile.value = "";
    renderEntryAttachmentMeta(null);
    updateEditorHelp();
    el.cellEditor.hidden = false;
  }

  function closeEditor() {
    session.editingEntry = null;
    el.cellEditor.hidden = true;
  }

  function syncEntryTypeOptions(isIndividual) {
    const holidayOption = el.entryType.querySelector("option[value='holiday']");
    if (holidayOption) holidayOption.hidden = !isIndividual;
  }

  function applyQuick(type) {
    const editing = session.editingEntry;
    if (!editing) return;
    if (editing.individual) {
      el.entryType.value = type;
      if (type === "normal" || type === "weekend") el.entryHours.value = 8;
      if (type === "overtime") el.entryHours.value = 10;
      if (type === "vacation" || type === "medical" || type === "special_event" || type === "absence" || type === "holiday") el.entryHours.value = 0;
      updateEditorHelp();
      return;
    }
    const employee = userById(editing.employeeId);
    const department = departmentById(employee.departmentId);
    const normalHours = department?.shiftHours || 8;
    el.entryType.value = type;
    if (type === "normal" || type === "weekend") el.entryHours.value = normalHours;
    if (type === "overtime") el.entryHours.value = normalHours + 2;
    if (type === "vacation" || type === "medical" || type === "special_event" || type === "absence" || type === "holiday") el.entryHours.value = 0;
    updateEditorHelp();
  }

  function updateEditorHelp() {
    const editing = session.editingEntry;
    if (!editing) return;
    if (editing.individual) {
      el.editorHelp.textContent = el.entryType.value === "overtime"
        ? "Overtime is normal shift plus extra time. In individual tables, 10h records 8h normal and 2h overtime."
        : "Normal shift for individual tables is 8h on weekdays.";
      el.entryFileWrap.hidden = true;
      el.entryFile.value = "";
      renderEntryAttachmentMeta(null);
      return;
    }
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
    if (editing.individual) {
      let hours = Number(el.entryHours.value || 0);
      if (!Number.isFinite(hours)) hours = 0;
      if (el.entryType.value === "overtime" && hours < 8) hours = 8;
      individualTable.entries[editing.rowId] = individualTable.entries[editing.rowId] || {};
      individualTable.entries[editing.rowId][editing.iso] = { type: el.entryType.value, hours };
      await saveIndividualTable();
      closeEditor();
      renderIndividualTable();
      return;
    }
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
    if (editing.individual) {
      if (individualTable.entries[editing.rowId]) delete individualTable.entries[editing.rowId][editing.iso];
      saveIndividualTable();
      closeEditor();
      renderIndividualTable();
      return;
    }
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
      return `${formatHours(normalHours)}h+${formatHours(Math.max(0, Number(entry.hours || 0) - normalHours))}h`;
    }
    if (entry.type === "vacation" || entry.type === "medical" || entry.type === "special_event") return "day";
    return `${formatHours(Number(entry.hours || 0))}h`;
  }

  function entryTooltip(entry, department, holiday) {
    const normalHours = department?.shiftHours || 8;
    if (entry.type === "overtime") {
      const extra = Math.max(0, Number(entry.hours || 0) - normalHours);
      return `Overtime of ${formatHours(extra)}h over normal shift of ${formatHours(normalHours)}h`;
    }
    if (entry.type === "holiday" && holiday?.name) return holiday.name;
    if (entry.type === "vacation") return "Vacation day";
    if (entry.type === "medical") return "Medical leave day";
    if (entry.type === "special_event") return "Special event day";
    if (entry.type === "absence") return "Absence";
    return `${ENTRY_LABELS[entry.type] || "Normal"} ${formatHours(Number(entry.hours || 0))}h`;
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
    const companyIds = new Set(accessibleCompanies().map((company) => company.id));
    const list = users().filter((user) => {
      if (user.role === "admin_account") return false;
      if (["payroll_admin", "company_manager"].includes(user.role)) return false;
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
    if (["admin_account", "payroll_admin"].includes(currentUser().role)) {
      window.alert("Admin Account and Payroll Admin users can view leave requests, but cannot create them.");
      return;
    }
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
    el.leaveRequestForm.hidden = ["admin_account", "payroll_admin"].includes(currentUser().role);
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
    if (["admin_account", "payroll_admin"].includes(user.role)) {
      const companyIds = new Set(accessibleCompanies(user).map((company) => company.id));
      const requests = (db.leaveRequests || [])
        .filter((request) => companyIds.has(request.companyId))
        .map((request) => ({ ...request, source: "request" }));
      return [...requests, ...visibleTimesheetLeaveEntries()]
        .sort((a, b) => String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date)));
    }
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
    if (["admin_account", "payroll_admin"].includes(user.role)) return false;
    if (user.role === "company_manager") return companyIdsForUser(user).has(employee.companyId);
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
      ? ["employee", "team_leader", "department_manager"]
      : ["employee", "team_leader", "department_manager"];
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
    el.employeeTeamLeader.closest(".field").hidden = ["team_leader", "department_manager"].includes(el.employeeRole.value);
    if (isPayroll && !selectedCompanyAccess().length && el.employeeCompany.value) {
      el.employeeCompanyAccess.querySelectorAll("input").forEach((input) => {
        input.checked = input.value === el.employeeCompany.value;
      });
    }
  }

  function renderAdminsManagement() {
    fillAdminFormOptions();
    el.adminDangerZone.hidden = currentUser().role !== "admin_account";
    const companyIds = new Set(accessibleCompanies().map((company) => company.id));
    const list = users().filter((user) => {
      if (!["payroll_admin", "company_manager"].includes(user.role)) return false;
      if (currentUser().role === "admin_account" && user.role === "payroll_admin") return user.adminOwnerId === currentUser().id;
      return user.role === "payroll_admin"
        ? user.adminOwnerId === activeAdminId()
        : [...companyIdsForUser(user)].some((companyId) => companyIds.has(companyId));
    });
    el.adminsList.innerHTML = list.length ? list.map((user) => adminUserCard(user)).join("") : `<p class="hint">No admin users yet.</p>`;
    el.adminsList.querySelectorAll("[data-edit-user]").forEach((button) => {
      button.addEventListener("click", () => editAdminUser(button.dataset.editUser));
    });
    el.adminsList.querySelectorAll("[data-delete-user]").forEach((button) => {
      button.addEventListener("click", () => deleteEmployee(button.dataset.deleteUser));
    });
  }

  function fillAdminFormOptions() {
    const roleChoices = currentUser().role === "admin_account" ? ["payroll_admin", "company_manager"] : ["company_manager"];
    el.adminUserRole.innerHTML = roleChoices.map((role) => option(role, ROLES[role])).join("");
    const companies = accessibleCompanies();
    el.adminUserCompany.innerHTML = companies.map((company) => option(company.id, company.name, company.id === session.activeCompanyId)).join("");
    el.adminUserCompanyAccess.innerHTML = companies.map((company) => `
      <label>
        <input type="checkbox" value="${escapeAttr(company.id)}" />
        <span>${escapeHtml(company.name)}</span>
      </label>
    `).join("");
    syncAdminCompanyAccessVisibility();
  }

  function syncAdminCompanyAccessVisibility() {
    const usesCompanyAccess = ["payroll_admin", "company_manager"].includes(el.adminUserRole.value);
    el.adminUserCompany.closest(".field").hidden = usesCompanyAccess;
    el.adminUserCompanyAccess.closest(".field").hidden = !usesCompanyAccess;
    el.adminUserPosition.closest(".field").hidden = usesCompanyAccess;
    el.adminUserPosition.required = !usesCompanyAccess;
    if (usesCompanyAccess) {
      el.adminUserPosition.value = ROLES[el.adminUserRole.value];
    }
    if (usesCompanyAccess && !selectedAdminCompanyAccess().length && session.activeCompanyId) {
      el.adminUserCompanyAccess.querySelectorAll("input").forEach((input) => {
        input.checked = input.value === session.activeCompanyId;
      });
    }
  }

  function selectedAdminCompanyAccess() {
    return Array.from(el.adminUserCompanyAccess.querySelectorAll("input:checked")).map((input) => input.value);
  }

  async function saveAdminUser(event) {
    event.preventDefault();
    const id = el.adminUserId.value || "";
    const existing = userById(id);
    const role = el.adminUserRole.value;
    const user = {
      id,
      name: clean(el.adminUserName.value),
      email: clean(el.adminUserEmail.value).toLowerCase(),
      identificationNumber: clean(el.adminUserIdentification.value),
      position: ["payroll_admin", "company_manager"].includes(role) ? ROLES[role] : clean(el.adminUserPosition.value),
      password: el.adminUserPassword.value,
      startDate: el.adminUserStartDate.value,
      endDate: el.adminUserEndDate.value,
      role,
      companyId: role === "company_manager" ? selectedAdminCompanyAccess()[0] || el.adminUserCompany.value : "",
      departmentId: "",
      reportsToId: "",
      teamLeaderId: "",
      coAvailable: 0,
      adminOwnerId: activeAdminId(),
      permittedCompanyIds: ["payroll_admin", "company_manager"].includes(role) ? selectedAdminCompanyAccess() : [],
      createdAt: existing?.createdAt || new Date().toISOString()
    };
    if (!user.name || !user.email || !user.identificationNumber || !user.password || !user.startDate) {
      window.alert("Name, email, identification number, password, and start date are required.");
      return;
    }
    if (["payroll_admin", "company_manager"].includes(role) && !user.permittedCompanyIds.length) {
      window.alert("Select at least one company for this admin user.");
      return;
    }
    const emailTaken = users().some((item) => item.id !== id && clean(item.email).toLowerCase() === user.email);
    if (emailTaken) {
      window.alert("That email is already used by another user.");
      return;
    }
    try {
      const savedUser = useSupabaseAuth()
        ? await upsertSupabaseUser(user, user.password, user.permittedCompanyIds)
        : { ...user, id: user.id || makeId("u") };
      if (existing) {
        db.users = db.users.map((item) => (item.id === savedUser.id ? { ...item, ...savedUser } : item));
      } else {
        db.users.push(savedUser);
      }
    } catch (error) {
      window.alert(error.message || "Could not save account.");
      return;
    }
    saveDb();
    resetAdminUserForm();
    renderAll();
  }

  function editAdminUser(id) {
    const user = userById(id);
    el.adminUserId.value = user.id;
    el.adminUserName.value = user.name;
    el.adminUserEmail.value = user.email || "";
    el.adminUserIdentification.value = user.identificationNumber || "";
    el.adminUserPosition.value = user.position || "";
    el.adminUserPassword.value = user.password || "";
    el.adminUserStartDate.value = user.startDate || todayIso();
    el.adminUserEndDate.value = user.endDate || "";
    el.adminUserRole.value = user.role;
    fillAdminFormOptions();
    el.adminUserRole.value = user.role;
    el.adminUserCompany.value = user.companyId || user.permittedCompanyIds?.[0] || session.activeCompanyId;
    el.adminUserCompanyAccess.querySelectorAll("input").forEach((input) => {
      input.checked = (user.permittedCompanyIds || []).includes(input.value);
    });
    syncAdminCompanyAccessVisibility();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetAdminUserForm() {
    el.adminUserForm.reset();
    el.adminUserId.value = "";
    fillAdminFormOptions();
    el.adminUserStartDate.value = todayIso();
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
    const role = el.employeeRole.value;
    const managerRoles = role === "team_leader" ? ["department_manager"] : ["department_manager", "company_manager"];
    let managers = users().filter((user) => managerRoles.includes(user.role) && companyIdsForUser(user).has(companyId));
    if (departmentId && role !== "department_manager") {
      managers = managers.filter((user) => user.role === "company_manager" || user.departmentId === departmentId);
    }
    const leaders = users()
      .filter((user) => user.role === "team_leader" && user.companyId === companyId)
      .filter((user) => !departmentId || user.departmentId === departmentId);
    el.employeeReportsTo.innerHTML = option("", "None") + managers.map((user) => option(user.id, user.name)).join("");
    el.employeeTeamLeader.innerHTML = option("", "None") + leaders.map((user) => option(user.id, user.name)).join("");
  }

  function prefillReporting() {
    fillReportingOptions();
    const role = el.employeeRole.value;
    const department = departmentById(el.employeeDepartment.value);
    const companyManager = users().find((user) => user.role === "company_manager" && companyIdsForUser(user).has(el.employeeCompany.value));
    if (role === "department_manager") {
      el.employeeReportsTo.value = companyManager?.id || "";
      el.employeeTeamLeader.value = "";
      return;
    }
    if (!department) {
      el.employeeReportsTo.value = "";
      el.employeeTeamLeader.value = "";
      return;
    }
    if (role === "team_leader") {
      el.employeeReportsTo.value = department.managerId || "";
      el.employeeTeamLeader.value = "";
      return;
    }
    el.employeeReportsTo.value = department.managerId || "";
    const leaders = users().filter((user) => user.role === "team_leader" && user.companyId === el.employeeCompany.value && user.departmentId === department.id);
    el.employeeTeamLeader.value = leaders.length === 1 ? leaders[0].id : "";
  }

  async function saveEmployee(event) {
    event.preventDefault();
    const id = el.employeeId.value || "";
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
    try {
      const savedUser = useSupabaseAuth()
        ? await upsertSupabaseUser(user, user.password, user.permittedCompanyIds)
        : { ...user, id: user.id || makeId("u") };
      if (existing) {
        db.users = db.users.map((item) => (item.id === savedUser.id ? { ...item, ...savedUser } : item));
      } else {
        db.users.push(savedUser);
      }
    } catch (error) {
      window.alert(error.message || "Could not save employee.");
      return;
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

  async function deleteEmployee(id) {
    const user = userById(id);
    if (!window.confirm(`Delete employee ${user.name}? This also removes timesheet entries.`)) return;
    try {
      await deleteSupabaseUser(id);
    } catch (error) {
      window.alert(error.message || "Could not delete account from Supabase.");
      return;
    }
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

  function adminUserCard(user) {
    const companies = accessibleCompanyNamesForUser(user);
    return `<article class="directory-row">
      <div><strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(user.email || "")} - ${escapeHtml(user.identificationNumber || "")}</span></div>
      <div><span>${ROLES[user.role]} - ${companies || "No companies assigned"}</span></div>
      <div class="row-actions">
        <button type="button" class="secondary" data-edit-user="${user.id}">Edit</button>
        <button type="button" class="danger" data-delete-user="${user.id}">Delete</button>
      </div>
    </article>`;
  }

  function accessibleCompanyNamesForUser(user) {
    const companyIds = companyIdsForUser(user);
    return db.companies
      .filter((company) => companyIds.has(company.id))
      .map((company) => escapeHtml(company.name))
      .join(", ");
  }

  function renderCompanySetup() {
    el.companiesList.innerHTML = accessibleCompanies().map((company) => {
      const companyDepartments = departments().filter((department) => department.companyId === company.id);
      const companyUsers = users().filter((user) => user.companyId === company.id);
      return `<details class="hierarchy-company">
        <summary>
          <span class="expand-indicator" aria-hidden="true"></span>
          <span class="company-row-title">
            ${company.logo?.dataUrl ? `<img src="${escapeAttr(company.logo.dataUrl)}" alt="${escapeAttr(company.name)} logo" />` : ""}
            <span><strong>${escapeHtml(company.name)}</strong><em>${companyDepartments.length} departments - ${companyUsers.length} users</em></span>
          </span>
          <span class="row-actions">
            <button type="button" class="secondary mini" data-add-dept-company="${company.id}">Add department</button>
            <button type="button" class="danger mini" data-delete-company="${company.id}">Delete</button>
          </span>
        </summary>
        <div class="hierarchy-children">
          ${companyColorEditor(company)}
          ${companyDepartments.length ? companyDepartments.map((department) => hierarchyDepartmentRow(department)).join("") : `<p class="hint">No departments yet.</p>`}
        </div>
      </details>`;
    }).join("");
    el.companiesList.querySelectorAll("[data-delete-company]").forEach((button) => {
      button.addEventListener("click", () => deleteCompany(button.dataset.deleteCompany));
    });
    el.companiesList.querySelectorAll("[data-add-dept-company]").forEach((button) => {
      button.addEventListener("click", () => {
        resetDepartmentForm();
        el.departmentCompany.value = button.dataset.addDeptCompany;
        fillDepartmentManagerOptions();
        el.departmentName.focus();
      });
    });
    el.companiesList.querySelectorAll("[data-edit-dept]").forEach((button) => {
      button.addEventListener("click", () => editDepartment(button.dataset.editDept));
    });
    el.companiesList.querySelectorAll("[data-delete-dept]").forEach((button) => {
      button.addEventListener("click", () => deleteDepartment(button.dataset.deleteDept));
    });
    el.companiesList.querySelectorAll("[data-company-color]").forEach((input) => {
      input.addEventListener("change", () => saveCompanyColors(input.dataset.companyColor));
    });
    renderLogs();
  }

  function companyColorEditor(company) {
    const colors = normalizeEntryColors(company.entryColors);
    return `<div class="company-color-panel">
      <strong>Timesheet colors</strong>
      <div class="color-grid compact-colors">
        ${ENTRY_COLOR_FIELDS.map(([key, label]) => `
          <label>
            ${escapeHtml(label)}
            <input type="color" data-company-color="${company.id}" data-color-key="${key}" value="${escapeAttr(colors[key])}" />
          </label>
        `).join("")}
      </div>
    </div>`;
  }

  async function saveCompanyColors(companyId) {
    const company = companyById(companyId);
    if (!company) return;
    company.entryColors = normalizeEntryColors(Object.fromEntries(
      Array.from(el.companiesList.querySelectorAll("[data-company-color]"))
        .filter((input) => input.dataset.companyColor === companyId)
        .map((input) => [input.dataset.colorKey, input.value])
    ));
    saveDb();
    try {
      await saveCompanyToSupabase(company);
    } catch (error) {
      console.warn("Could not save company colors", error);
    }
    renderTimesheet();
  }

  function renderCompanyColorInputs(colors = DEFAULT_ENTRY_COLORS) {
    el.companyColorFields.innerHTML = ENTRY_COLOR_FIELDS.map(([key, label]) => `
      <label>
        ${escapeHtml(label)}
        <input type="color" data-new-company-color="${key}" value="${escapeAttr(normalizeEntryColors(colors)[key])}" />
      </label>
    `).join("");
  }

  function companyFormColors() {
    return normalizeEntryColors(Object.fromEntries(
      Array.from(el.companyColorFields.querySelectorAll("[data-new-company-color]"))
        .map((input) => [input.dataset.newCompanyColor, input.value])
    ));
  }

  function hierarchyDepartmentRow(department) {
    const people = users().filter((user) => user.departmentId === department.id);
    return `<details class="hierarchy-department">
      <summary>
        <span class="expand-indicator" aria-hidden="true"></span>
        <span><strong>${escapeHtml(department.name)}</strong><em>${people.length} users - ${department.shiftHours}h shift</em></span>
        <span class="row-actions">
          <button type="button" class="secondary mini" data-edit-dept="${department.id}">Edit</button>
          <button type="button" class="danger mini" data-delete-dept="${department.id}">Delete</button>
        </span>
      </summary>
      <div class="hierarchy-people">
        ${people.length ? people.map((user) => `<span>${escapeHtml(user.name)} <em>${ROLES[user.role]}</em></span>`).join("") : `<p class="hint">No users assigned.</p>`}
      </div>
    </details>`;
  }

  async function createCompany(event) {
    event.preventDefault();
    const name = clean(el.companyName.value);
    if (!name) return;
    const logo = el.companyLogo.files[0] ? await readFileMeta(el.companyLogo.files[0]) : null;
    const company = {
      id: recordId("org"),
      name,
      logo,
      entryColors: companyFormColors(),
      ownerAdminId: activeAdminId(),
      createdBy: currentUser().id,
      createdAt: new Date().toISOString()
    };
    try {
      await saveCompanyToSupabase(company);
    } catch (error) {
      window.alert(error.message || "Could not save company to Supabase.");
      return;
    }
    db.companies.push(company);
    if (currentUser().role === "payroll_admin") {
      currentUser().permittedCompanyIds = Array.from(new Set([...(currentUser().permittedCompanyIds || []), company.id]));
    }
    const newDepartments = [];
    addLog("company", `Created company ${name}`);
    clean(el.companyDepartments.value)
      .split(",")
      .map(clean)
      .filter(Boolean)
      .forEach((departmentName) => {
        const department = defaultDepartment(departmentName, company.id);
        db.departments.push(department);
        newDepartments.push(department);
        addLog("company", `Added department ${departmentName} to ${name}`);
      });
    try {
      await Promise.all(newDepartments.map((department) => saveDepartmentToSupabase(department)));
    } catch (error) {
      window.alert(error.message || "Company was saved, but one or more departments could not be saved to Supabase.");
    }
    el.companyForm.reset();
    el.companyLogoPreview.innerHTML = "";
    renderCompanyColorInputs();
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

  async function deleteCompany(id) {
    const company = companyById(id);
    const childDepartments = allDepartments().filter((department) => department.companyId === id);
    if (childDepartments.length) {
      window.alert(`Delete the departments inside ${company.name} before deleting the company.`);
      return;
    }
    const companyUsers = users().filter((user) => user.companyId === id);
    if (companyUsers.length) {
      window.alert(`Move or delete the employees inside ${company.name} before deleting the company.`);
      return;
    }
    if (!window.confirm(`Delete company ${company.name}?`)) return;
    try {
      await deleteCompanyFromSupabase(id);
    } catch (error) {
      window.alert(error.message || "Could not delete company from Supabase.");
      return;
    }
    db.companies = db.companies.filter((item) => item.id !== id);
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
    const managers = users().filter((user) => ["department_manager", "company_manager"].includes(user.role) && companyIdsForUser(user).has(companyId));
    const leaders = users().filter((user) => ["team_leader", "company_manager"].includes(user.role) && companyIdsForUser(user).has(companyId));
    el.departmentManager.innerHTML = option("", "None") + managers.map((user) => option(user.id, user.name)).join("");
    el.departmentTeamLeader.innerHTML = option("", "None") + leaders.map((user) => option(user.id, user.name)).join("");
  }

  async function saveDepartment(event) {
    event.preventDefault();
    const existing = departmentById(el.departmentId.value);
    const id = existing?.id || recordId("dep");
    const companyManager = users().find((user) => user.role === "company_manager" && companyIdsForUser(user).has(el.departmentCompany.value));
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
    try {
      await saveDepartmentToSupabase(department);
    } catch (error) {
      window.alert(error.message || "Could not save department to Supabase.");
      return;
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

  async function deleteDepartment(id) {
    const department = departmentById(id);
    const assigned = users().filter((user) => user.departmentId === id);
    if (assigned.length) {
      window.alert(`Move or delete the employees in ${department.name} before deleting the department.`);
      return;
    }
    if (!window.confirm(`Delete department ${department.name}?`)) return;
    try {
      await deleteDepartmentFromSupabase(id);
    } catch (error) {
      window.alert(error.message || "Could not delete department from Supabase.");
      return;
    }
    db.departments = db.departments.filter((item) => item.id !== id);
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

  async function openIndividualTable(id = "") {
    const tableId = id || makeId("table");
    individualTable = await loadIndividualTable(tableId);
    el.loginView.hidden = true;
    el.appView.hidden = true;
    el.individualView.hidden = false;
    history.replaceState(null, "", `${location.pathname}?table=${encodeURIComponent(individualTable.id)}`);
    fillMonthSelect(el.individualMonthPicker, individualTable.month);
    el.individualHolidayYear.value = individualTable.month.slice(0, 4);
    renderIndividualTable();
    saveIndividualTable();
  }

  async function loadIndividualTable(id) {
    if (supabaseState.configured && supabase) {
      const { data, error } = await supabase.rpc("get_individual_table", { token_value: id });
      if (!error && data) {
        return migrateIndividualTable({ ...data, id });
      }
    }
    try {
      const stored = JSON.parse(localStorage.getItem(`${INDIVIDUAL_STORAGE_PREFIX}${id}`));
      if (stored) return migrateIndividualTable(stored);
    } catch (error) {
      // Local fallback starts with a clean table.
    }
    return migrateIndividualTable({ id, month: getCurrentMonth(), rows: [defaultIndividualRow()], entries: {} });
  }

  function migrateIndividualTable(table) {
    return {
      id: table.id || makeId("table"),
      month: table.month || getCurrentMonth(),
      rows: Array.isArray(table.rows) && table.rows.length ? table.rows.map((row) => ({
        id: row.id || makeId("row"),
        name: row.name || "",
        company: row.company || "",
        department: row.department || "",
        identificationNumber: row.identificationNumber || "",
        position: row.position || ""
      })) : [defaultIndividualRow()],
      entries: table.entries || {},
      holidays: Array.isArray(table.holidays) ? table.holidays : []
    };
  }

  function defaultIndividualRow() {
    return {
      id: makeId("row"),
      name: "",
      company: "",
      department: "",
      identificationNumber: "",
      position: ""
    };
  }

  async function saveIndividualTable() {
    if (!individualTable) return;
    localStorage.setItem(`${INDIVIDUAL_STORAGE_PREFIX}${individualTable.id}`, JSON.stringify(individualTable));
    if (supabaseState.configured && supabase) {
      await supabase.rpc("save_individual_table", {
        token_value: individualTable.id,
        data_value: individualTable
      });
    }
  }

  function ensureIndividualTable() {
    if (!individualTable) individualTable = migrateIndividualTable({ id: makeId("table") });
  }

  function renderIndividualTable() {
    ensureIndividualTable();
    const days = daysInMonth(individualTable.month);
    fillMonthSelect(el.individualMonthPicker, individualTable.month);
    if (!el.individualHolidayYear.value) el.individualHolidayYear.value = individualTable.month.slice(0, 4);
    el.individualLinkLabel.textContent = individualShareLink();
    el.individualGrid.style.setProperty("--days", days.length);
    el.individualGrid.classList.toggle("meta-expanded", individualMetaExpanded);
    el.individualGrid.classList.toggle("totals-expanded", individualTotalsExpanded);
    const individualShell = el.individualGrid.closest(".individual-sheet-shell");
    individualShell?.classList.toggle("individual-expanded", individualMetaExpanded || individualTotalsExpanded);
    individualShell?.style.setProperty("--individual-rows", String((individualTable.rows?.length || 0) + 1));
    el.individualGrid.replaceChildren();
    const metaHeaders = ["Company", "Department", "ID", "Position"];
    const detailHeaders = ["Norm", "Diff", "OT", "CO", "CM", "SE"];
    const headers = [
      "Employee",
      "More",
      ...(individualMetaExpanded ? metaHeaders : []),
      ...days.map((day) => dayHeader(day)),
      "Worked",
      ...detailHeaders,
      "More",
      ...(individualTotalsExpanded ? ["Fill", "Clear"] : [])
    ];
    headers.forEach((header, index) => {
      const cell = div("sheet-header");
      if (index === 0) cell.classList.add("sticky-name");
      if (metaHeaders.includes(header)) cell.classList.add("manual-meta");
      if (detailHeaders.includes(header)) cell.classList.add("detail-total");
      if (header === "More") {
        const isStartMore = index === 1;
        cell.classList.add(isStartMore ? "manual-more" : "toggle-total-cell");
        cell.innerHTML = `<button type="button" class="mini toggle-totals" data-individual-more="${isStartMore ? "meta" : "totals"}" aria-expanded="${isStartMore ? individualMetaExpanded : individualTotalsExpanded}">${isStartMore ? (individualMetaExpanded ? "Less" : "More") : (individualTotalsExpanded ? "Less" : "More")}</button>`;
      } else {
        cell.innerHTML = header;
      }
      el.individualGrid.appendChild(cell);
    });
    el.individualGrid.querySelectorAll("[data-individual-more]").forEach((button) => {
      button.addEventListener("click", () => {
        if (button.dataset.individualMore === "meta") {
          individualMetaExpanded = !individualMetaExpanded;
        } else {
          individualTotalsExpanded = !individualTotalsExpanded;
        }
        renderIndividualTable();
      });
    });
    individualTable.rows.forEach((row) => renderIndividualRow(row, days));
  }

  function renderIndividualRow(row, days) {
    const nameCell = div("name-cell sticky-name");
    nameCell.innerHTML = `<input class="inline-cell-input strong-input" data-row-field="${row.id}:name" value="${escapeAttr(row.name)}" placeholder="Employee name" />`;
    el.individualGrid.appendChild(nameCell);

    const moreCell = div("total-cell manual-more");
    moreCell.textContent = individualMetaExpanded ? "<" : "...";
    el.individualGrid.appendChild(moreCell);

    if (individualMetaExpanded) {
      ["company", "department", "identificationNumber", "position"].forEach((field) => {
        const cell = div("total-cell manual-meta");
        cell.innerHTML = `<input class="inline-cell-input" data-row-field="${row.id}:${field}" value="${escapeAttr(row[field])}" placeholder="${escapeAttr(individualFieldLabel(field))}" />`;
        el.individualGrid.appendChild(cell);
      });
    }

    days.forEach((day) => {
      const holiday = individualHolidayOn(day.iso);
      const entry = normalizeIndividualEntry(individualTable.entries[row.id]?.[day.iso]) || (holiday ? { type: "holiday", hours: 0, name: holiday.name } : null);
      const cell = div("day-cell editable manual-day");
      cell.dataset.workday = isWeekday(day.date) && !holiday ? "true" : "false";
      if (holiday) cell.dataset.holiday = "true";
      if (entry) {
        cell.dataset.entryType = entry.type;
        cell.innerHTML = `<strong>${ENTRY_LABELS[entry.type] || "N"}</strong><span>${individualEntryParts(entry)}</span>`;
      } else {
        cell.innerHTML = `<span class="empty-cell"></span>`;
      }
      cell.tabIndex = 0;
      cell.setAttribute("role", "button");
      cell.addEventListener("click", () => openIndividualEditor(row.id, day.iso));
      cell.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openIndividualEditor(row.id, day.iso);
        }
      });
      el.individualGrid.appendChild(cell);
    });

    const totals = individualTotals(row, days);
    addIndividualTotalCell(`${formatHours(totals.worked)}h`);
    addIndividualTotalCell(`${formatHours(totals.expected)}h`, "detail-total");
    addIndividualTotalCell(`${formatSigned(totals.difference)}h`, `detail-total ${totals.difference < 0 ? "negative" : totals.difference > 0 ? "positive" : ""}`);
    addIndividualTotalCell(`${formatHours(totals.overtime)}h`, "detail-total");
    addIndividualTotalCell(`${totals.co}d`, "detail-total");
    addIndividualTotalCell(`${totals.cm}d`, "detail-total");
    addIndividualTotalCell(`${totals.se}d`, "detail-total");
    const endMoreCell = div("total-cell toggle-total-cell");
    endMoreCell.textContent = individualTotalsExpanded ? "<" : "...";
    el.individualGrid.appendChild(endMoreCell);
    if (individualTotalsExpanded) {
      const fillCell = div("total-cell");
      fillCell.innerHTML = `<button type="button" class="mini" data-individual-fill="${row.id}">Fill</button>`;
      el.individualGrid.appendChild(fillCell);
      const clearCell = div("total-cell");
      clearCell.innerHTML = `<button type="button" class="mini danger" data-individual-clear="${row.id}">Clear</button>`;
      el.individualGrid.appendChild(clearCell);
    }

    el.individualGrid.querySelectorAll(`[data-row-field^="${row.id}:"]`).forEach((input) => {
      input.addEventListener("change", handleIndividualRowChange);
      input.addEventListener("blur", handleIndividualRowChange);
    });
    el.individualGrid.querySelector(`[data-individual-fill="${row.id}"]`)?.addEventListener("click", () => fillIndividualRow(row, days));
    el.individualGrid.querySelector(`[data-individual-clear="${row.id}"]`)?.addEventListener("click", () => clearIndividualRow(row));
  }

  function addIndividualTotalCell(text, extraClass) {
    const cell = div(`total-cell ${extraClass || ""}`);
    cell.textContent = text;
    el.individualGrid.appendChild(cell);
  }

  function handleIndividualRowChange(event) {
    const [rowId, field] = event.target.dataset.rowField.split(":");
    const row = individualTable.rows.find((item) => item.id === rowId);
    if (!row) return;
    row[field] = clean(event.target.value);
    if (field === "name" && !row.name) {
      if (window.confirm("Delete this row?")) {
        individualTable.rows = individualTable.rows.filter((item) => item.id !== rowId);
        delete individualTable.entries[rowId];
        saveIndividualTable();
        renderIndividualTable();
        return;
      }
    }
    saveIndividualTable();
  }

  function individualTotals(row, days) {
    return days.reduce((acc, day) => {
      const holiday = individualHolidayOn(day.iso);
      if (isWeekday(day.date) && !holiday) acc.expected += 8;
      const entry = normalizeIndividualEntry(individualTable.entries[row.id]?.[day.iso]);
      if (!entry) return acc;
      if (entry.type === "vacation") {
        acc.co += 1;
        if (isWeekday(day.date)) acc.worked += 8;
      } else if (entry.type === "medical") {
        acc.cm += 1;
        if (isWeekday(day.date)) acc.worked += 8;
      } else if (entry.type === "special_event") {
        acc.se += 1;
        if (isWeekday(day.date)) acc.worked += 8;
      } else if (entry.type === "absence") {
        return acc;
      } else if (entry.type === "holiday") {
        return acc;
      } else {
        const hours = Number(entry.hours || 0);
        acc.worked += hours;
        if (entry.type === "overtime") acc.overtime += Math.max(0, hours - 8);
      }
      acc.difference = acc.worked - acc.expected;
      return acc;
    }, { expected: 0, worked: 0, difference: 0, overtime: 0, co: 0, cm: 0, se: 0 });
  }

  function normalizeIndividualEntry(value) {
    if (!value) return null;
    if (typeof value === "object") return { type: value.type || "normal", hours: Number(value.hours || 0) };
    const raw = clean(value).toUpperCase();
    if (!raw) return null;
    if (raw === "CO") return { type: "vacation", hours: 0 };
    if (raw === "CM") return { type: "medical", hours: 0 };
    if (raw === "SE") return { type: "special_event", hours: 0 };
    if (raw === "AB") return { type: "absence", hours: 0 };
    if (raw === "H") return { type: "holiday", hours: 0 };
    if (raw === "OT") return { type: "overtime", hours: 10 };
    if (raw.includes("+")) {
      const [base, extra] = raw.split("+").map(Number);
      return { type: "overtime", hours: Number(base || 0) + Number(extra || 0) };
    }
    if (raw === "N") return { type: "normal", hours: 8 };
    if (/^\d+(\.\d+)?$/.test(raw)) return { type: "normal", hours: Number(raw) };
    return null;
  }

  function individualEntryParts(entry) {
    if (entry.type === "overtime") return `8+${formatHours(Math.max(0, Number(entry.hours || 0) - 8))}`;
    if (entry.type === "vacation" || entry.type === "medical" || entry.type === "special_event") return "day";
    if (entry.type === "holiday") return "";
    return formatHours(Number(entry.hours || 0));
  }

  async function fillIndividualRow(row, days) {
    individualTable.entries[row.id] = individualTable.entries[row.id] || {};
    days.forEach((day) => {
      if (isWeekday(day.date) && !individualHolidayOn(day.iso) && !individualTable.entries[row.id][day.iso]) {
        individualTable.entries[row.id][day.iso] = { type: "normal", hours: 8 };
      }
    });
    await saveIndividualTable();
    renderIndividualTable();
  }

  async function clearIndividualRow(row) {
    if (!window.confirm(`Clear all entries for ${row.name || "this row"} in ${individualTable.month}?`)) return;
    delete individualTable.entries[row.id];
    await saveIndividualTable();
    renderIndividualTable();
  }

  function individualHolidayOn(iso) {
    return (individualTable?.holidays || []).find((holiday) => holiday.date === iso);
  }

  async function fetchIndividualHolidays() {
    ensureIndividualTable();
    const year = Number(el.individualHolidayYear.value || individualTable.month.slice(0, 4));
    const countryCode = el.individualHolidayCountry.value || "RO";
    if (!year || year < 2000 || year > 2100) {
      window.alert("Choose a valid holiday year.");
      return;
    }
    el.individualHolidayBtn.disabled = true;
    el.individualHolidayBtn.textContent = "Fetching...";
    try {
      const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`);
      if (!response.ok) throw new Error("Holiday request failed");
      const holidays = await response.json();
      pendingIndividualHolidays = holidays.map((holiday) => ({
        id: makeId("ihol"),
        date: holiday.date,
        name: holiday.localName || holiday.name || "Public holiday",
        countryCode
      }));
      openIndividualHolidayModal(countryCode, year);
    } catch (error) {
      pendingIndividualHolidays = [];
      openIndividualHolidayModal(countryCode, year);
      window.alert("Could not fetch public holidays. You can add them manually in the preview.");
    } finally {
      el.individualHolidayBtn.disabled = false;
      el.individualHolidayBtn.textContent = "Add Public Holidays";
    }
  }

  function openIndividualHolidayModal(countryCode, year) {
    el.individualHolidaySubtitle.textContent = `${countryCode} ${year} - remove rows or add another before applying`;
    renderPendingIndividualHolidays();
    el.individualHolidayModal.hidden = false;
  }

  function closeIndividualHolidayModal() {
    pendingIndividualHolidays = [];
    el.individualHolidayModal.hidden = true;
    el.individualHolidayAddForm.reset();
  }

  function renderPendingIndividualHolidays() {
    el.individualHolidayList.innerHTML = pendingIndividualHolidays.length
      ? pendingIndividualHolidays
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((holiday) => `<div class="holiday-preview-row">
          <input type="date" value="${escapeAttr(holiday.date)}" data-holiday-date="${holiday.id}" />
          <input type="text" value="${escapeAttr(holiday.name)}" data-holiday-name="${holiday.id}" />
          <button type="button" class="danger mini" data-remove-individual-holiday="${holiday.id}">Remove</button>
        </div>`)
        .join("")
      : `<p class="hint">No holidays loaded yet. Add one manually below.</p>`;
    el.individualHolidayList.querySelectorAll("[data-remove-individual-holiday]").forEach((button) => {
      button.addEventListener("click", () => {
        pendingIndividualHolidays = pendingIndividualHolidays.filter((holiday) => holiday.id !== button.dataset.removeIndividualHoliday);
        renderPendingIndividualHolidays();
      });
    });
    el.individualHolidayList.querySelectorAll("[data-holiday-date]").forEach((input) => {
      input.addEventListener("change", () => {
        const holiday = pendingIndividualHolidays.find((item) => item.id === input.dataset.holidayDate);
        if (holiday) holiday.date = input.value;
      });
    });
    el.individualHolidayList.querySelectorAll("[data-holiday-name]").forEach((input) => {
      input.addEventListener("change", () => {
        const holiday = pendingIndividualHolidays.find((item) => item.id === input.dataset.holidayName);
        if (holiday) holiday.name = clean(input.value);
      });
    });
  }

  function addPendingIndividualHoliday(event) {
    event.preventDefault();
    const date = el.individualHolidayDate.value;
    const name = clean(el.individualHolidayName.value);
    if (!date || !name) {
      window.alert("Add both holiday date and name.");
      return;
    }
    pendingIndividualHolidays.push({
      id: makeId("ihol"),
      date,
      name,
      countryCode: el.individualHolidayCountry.value || "Manual"
    });
    el.individualHolidayAddForm.reset();
    renderPendingIndividualHolidays();
  }

  async function applyIndividualHolidays() {
    ensureIndividualTable();
    const valid = pendingIndividualHolidays
      .map((holiday) => ({ ...holiday, date: clean(holiday.date), name: clean(holiday.name) }))
      .filter((holiday) => holiday.date && holiday.name);
    const byDate = new Map((individualTable.holidays || []).map((holiday) => [holiday.date, holiday]));
    valid.forEach((holiday) => byDate.set(holiday.date, {
      date: holiday.date,
      name: holiday.name,
      countryCode: holiday.countryCode || el.individualHolidayCountry.value || ""
    }));
    individualTable.holidays = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    individualTable.rows.forEach((row) => stampIndividualHolidaysForRow(row));
    await saveIndividualTable();
    closeIndividualHolidayModal();
    renderIndividualTable();
  }

  function stampIndividualHolidaysForRow(row) {
    individualTable.entries[row.id] = individualTable.entries[row.id] || {};
    (individualTable.holidays || []).forEach((holiday) => {
      individualTable.entries[row.id][holiday.date] = { type: "holiday", hours: 0, name: holiday.name };
    });
  }

  function exportIndividualCsv() {
    ensureIndividualTable();
    const days = daysInMonth(individualTable.month);
    const rows = [["Employee", "Company", "Department", "Identification Number", "Position", ...days.map((day) => day.iso), "Worked", "Norm", "Difference", "OT", "CO", "CM", "SE"]];
    individualTable.rows.forEach((row) => {
      const totals = individualTotals(row, days);
      rows.push([
        row.name,
        row.company,
        row.department,
        row.identificationNumber,
        row.position,
        ...days.map((day) => individualExportCell(individualTable.entries[row.id]?.[day.iso])),
        formatHours(totals.worked),
        formatHours(totals.expected),
        formatSigned(totals.difference),
        formatHours(totals.overtime),
        totals.co,
        totals.cm,
        totals.se
      ]);
    });
    download(`individual-tableshifts-${individualTable.month}.csv`, rows.map((row) => row.map(csv).join(",")).join("\n"), "text/csv");
  }

  function individualExportCell(value) {
    const entry = normalizeIndividualEntry(value);
    if (!entry) return "";
    if (entry.type === "normal") return formatHours(entry.hours);
    if (entry.type === "overtime") return formatHours(entry.hours);
    return ENTRY_LABELS[entry.type] || "";
  }

  function downloadIndividualTemplate() {
    const rows = [
      ["Employee", "Company", "Department", "Identification Number", "Position"],
      ["Jane Example", "Example Company", "Operations", "EMP-001", "Operator"]
    ];
    download("individual-tableshifts-import-template.csv", rows.map((row) => row.map(csv).join(",")).join("\n"), "text/csv");
  }

  async function importIndividualCsv() {
    const file = el.individualImportFile.files[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    const [, ...dataRows] = rows;
    dataRows.forEach((cells) => {
      if (!clean(cells[0])) return;
    individualTable.rows.push({
        id: makeId("row"),
        name: clean(cells[0]),
        company: clean(cells[1]),
        department: clean(cells[2]),
        identificationNumber: clean(cells[3]),
        position: clean(cells[4])
      });
    });
    individualTable.rows.forEach((row) => stampIndividualHolidaysForRow(row));
    el.individualImportFile.value = "";
    saveIndividualTable();
    renderIndividualTable();
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const char = text[index];
      const next = text[index + 1];
      if (char === '"' && quoted && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
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
    if (row.some((value) => value !== "")) rows.push(row);
    return rows;
  }

  function individualFieldLabel(field) {
    return {
      company: "Company",
      department: "Department",
      identificationNumber: "ID",
      position: "Position"
    }[field] || field;
  }

  function individualShareLink() {
    return `${location.origin}${location.pathname}?table=${encodeURIComponent(individualTable?.id || "")}`;
  }

  function individualIdFromUrl() {
    return new URLSearchParams(location.search).get("table") || "";
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
      entryColors: normalizeEntryColors(company.entryColors),
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
      tabs.push({ id: "companies", label: "Companies", group: "management" });
      tabs.push({ id: "admins", label: "Admins", group: "management" });
      tabs.push({ id: "users", label: "Employees", group: "management" });
      tabs.push({ id: "holidays", label: "National Holidays" });
    }
    return tabs;
  }

  function tabTitle(id) {
    return tabsForUser().find((tab) => tab.id === id)?.label || "Timesheet";
  }

  function defaultDepartment(name, companyId) {
    const now = new Date().toISOString();
    const companyManager = users().find((user) => user.role === "company_manager" && companyIdsForUser(user).has(companyId));
    return {
      id: recordId("dep"),
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

  function fillMonthSelect(select, selectedMonth) {
    if (!select) return;
    const selected = selectedMonth || getCurrentMonth();
    const [selectedYear, selectedNumber] = selected.split("-").map(Number);
    const center = selectedYear && selectedNumber ? new Date(selectedYear, selectedNumber - 1, 1) : new Date();
    const months = [];
    for (let offset = -18; offset <= 18; offset += 1) {
      const date = new Date(center.getFullYear(), center.getMonth() + offset, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      months.push({ value, label: date.toLocaleDateString(undefined, { month: "long", year: "numeric" }) });
    }
    if (!months.some((month) => month.value === selected)) {
      months.push({ value: selected, label: selected });
      months.sort((a, b) => a.value.localeCompare(b.value));
    }
    select.innerHTML = months.map((month) => option(month.value, month.label, month.value === selected)).join("");
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
    if (user.role === "company_manager") {
      const permitted = companyIdsForUser(user);
      return db.companies.filter((company) => permitted.has(company.id));
    }
    return db.companies.filter((company) => company.id === user.companyId);
  }

  function companyIdsForUser(user) {
    return new Set([user.companyId, ...(user.permittedCompanyIds || [])].filter(Boolean));
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

  function normalizeEntryColors(colors = {}) {
    return Object.fromEntries(ENTRY_COLOR_FIELDS.map(([key, , fallback]) => [key, validHex(colors[key]) || fallback]));
  }

  function validHex(value) {
    const text = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(text) ? text : "";
  }

  function entryColor(type, companyId = session.activeCompanyId) {
    const colors = normalizeEntryColors(companyById(companyId)?.entryColors);
    return colors[type] || DEFAULT_ENTRY_COLORS[type] || "";
  }

  function applyTimesheetCellColor(cell, type, companyId = session.activeCompanyId) {
    const color = entryColor(type, companyId);
    if (!color) return;
    cell.style.setProperty("--cell-bg", color);
    if (type === "absence") {
      cell.style.setProperty("--cell-fg", readableTextColor(color));
    }
  }

  function readableTextColor(hex) {
    const value = validHex(hex);
    if (!value) return "";
    const r = parseInt(value.slice(1, 3), 16);
    const g = parseInt(value.slice(3, 5), 16);
    const b = parseInt(value.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 135 ? "#ffffff" : "#1d2521";
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

  function recordId(prefix) {
    return useSupabaseAuth() && window.crypto?.randomUUID ? window.crypto.randomUUID() : makeId(prefix);
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
