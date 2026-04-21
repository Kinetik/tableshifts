const SUPABASE_URL = process.env.SUPABASE_URL || process.env.tableshifts_dbSUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.tableshifts_dbSUPABASE_ANON_KEY || process.env.tableshifts_dbSUPABASE_PUBLISHABLE_KEY;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function bearerToken(req) {
  const header = req.headers.authorization || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7) : "";
}

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.error_description || data?.error || response.statusText;
    throw new Error(message);
  }
  return data;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function getCaller(jwt) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${jwt}`
    }
  });
  if (!response.ok) throw new Error("Your session expired. Please log in again.");
  return response.json();
}

async function findProfile(userId) {
  const rows = await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`);
  return rows?.[0] || null;
}

async function findEnvironment(environmentId) {
  const rows = await supabaseFetch(`/rest/v1/admin_environments?id=eq.${encodeURIComponent(environmentId)}&select=*`);
  return rows?.[0] || null;
}

async function canCallerUseCompany(callerProfile, companyId) {
  if (!companyId) return true;
  if (callerProfile.role === "admin_account") {
    const rows = await supabaseFetch(`/rest/v1/companies?id=eq.${encodeURIComponent(companyId)}&environment_id=eq.${encodeURIComponent(callerProfile.environment_id)}&select=id`);
    return rows.length > 0;
  }
  const owned = await supabaseFetch(`/rest/v1/companies?id=eq.${encodeURIComponent(companyId)}&created_by=eq.${encodeURIComponent(callerProfile.id)}&select=id`);
  if (owned.length) return true;
  const access = await supabaseFetch(`/rest/v1/payroll_company_access?payroll_user_id=eq.${encodeURIComponent(callerProfile.id)}&company_id=eq.${encodeURIComponent(companyId)}&select=company_id`);
  return access.length > 0;
}

function requireValidRole(callerRole, targetRole) {
  if (targetRole === "admin_account") throw new Error("Admin Accounts must be created from the login page.");
  if (callerRole === "payroll_admin" && targetRole === "payroll_admin") {
    throw new Error("Payroll Admins cannot create other Payroll Admin accounts.");
  }
  if (!["admin_account", "payroll_admin"].includes(callerRole)) {
    throw new Error("You do not have permission to manage accounts.");
  }
}

async function createOrUpdateAuthUser(user, password) {
  const metadata = {
    full_name: user.name,
    account_type: user.role
  };
  if (user.id) {
    const body = {
      email: user.email,
      user_metadata: metadata
    };
    if (password) body.password = password;
    return supabaseFetch(`/auth/v1/admin/users/${encodeURIComponent(user.id)}`, {
      method: "PUT",
      body: JSON.stringify(body)
    });
  }
  return supabaseFetch("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({
      email: user.email,
      password,
      email_confirm: true,
      user_metadata: metadata
    })
  });
}

async function replacePayrollAccess(environmentId, payrollUserId, companyIds, grantedBy) {
  await supabaseFetch(`/rest/v1/payroll_company_access?environment_id=eq.${encodeURIComponent(environmentId)}&payroll_user_id=eq.${encodeURIComponent(payrollUserId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  });
  if (!companyIds.length) return;
  await supabaseFetch("/rest/v1/payroll_company_access", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(companyIds.map((companyId) => ({
      environment_id: environmentId,
      payroll_user_id: payrollUserId,
      company_id: companyId,
      granted_by: grantedBy
    })))
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return send(res, 500, { error: "Supabase server environment is not configured." });
  }

  try {
    const jwt = bearerToken(req);
    if (!jwt) throw new Error("Missing session token.");
    const caller = await getCaller(jwt);
    const callerProfile = await findProfile(caller.id);
    if (!callerProfile?.environment_id) throw new Error("Your TableShifts profile is not ready.");
    const environment = await findEnvironment(callerProfile.environment_id);
    if (!environment) throw new Error("Admin environment not found.");

    const body = await readBody(req);
    const { user = {}, password = "", permittedCompanyIds = [] } = body || {};
    const role = user.role || "employee";
    requireValidRole(callerProfile.role, role);
    if (!user.name || !user.email || !role) throw new Error("Name, email, and role are required.");
    if (!user.id && !password) throw new Error("A temporary password is required for new accounts.");
    if (user.companyId && !(await canCallerUseCompany(callerProfile, user.companyId))) {
      throw new Error("You cannot assign this company.");
    }
    for (const companyId of permittedCompanyIds || []) {
      if (!(await canCallerUseCompany(callerProfile, companyId))) throw new Error("You cannot grant access to one of the selected companies.");
    }

    const authUser = await createOrUpdateAuthUser(user, password);
    const userId = authUser.id || authUser.user?.id;
    if (!userId) throw new Error("Supabase did not return the created user id.");
    const profilePayload = {
      id: userId,
      environment_id: callerProfile.environment_id,
      email: String(user.email).toLowerCase(),
      full_name: user.name,
      role,
      identification_number: user.identificationNumber || null,
      position: user.position || null,
      company_id: role === "payroll_admin" ? null : user.companyId || permittedCompanyIds?.[0] || null,
      department_id: ["company_manager", "payroll_admin"].includes(role) ? null : user.departmentId || null,
      reports_to_user_id: user.reportsToId || null,
      team_leader_user_id: user.teamLeaderId || null,
      start_date: user.startDate || null,
      end_date: user.endDate || null,
      co_available: Number(user.coAvailable || 0),
      created_by: caller.id
    };
    const profiles = await supabaseFetch("/rest/v1/profiles?on_conflict=id&select=*", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(profilePayload)
    });
    await replacePayrollAccess(
      callerProfile.environment_id,
      userId,
      ["payroll_admin", "company_manager"].includes(role) ? Array.from(new Set(permittedCompanyIds || [])) : [],
      caller.id
    );
    const access = ["payroll_admin", "company_manager"].includes(role)
      ? await supabaseFetch(`/rest/v1/payroll_company_access?payroll_user_id=eq.${encodeURIComponent(userId)}&select=company_id`)
      : [];
    return send(res, 200, {
      profile: profiles[0],
      environmentOwnerId: environment.owner_user_id,
      permittedCompanyIds: access.map((item) => item.company_id)
    });
  } catch (error) {
    return send(res, 400, { error: error.message || "Could not save account." });
  }
};
