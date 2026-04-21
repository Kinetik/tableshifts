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

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
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

async function profile(userId) {
  const rows = await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`);
  return rows?.[0] || null;
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
    const callerProfile = await profile(caller.id);
    const body = await readBody(req);
    if (body.confirm !== "DELETE TABLESHIFTS") throw new Error("Confirmation text did not match.");
    if (callerProfile?.role !== "admin_account") throw new Error("Only Admin Accounts can delete their environment.");
    await supabaseFetch(`/auth/v1/admin/users/${encodeURIComponent(caller.id)}`, { method: "DELETE" });
    return send(res, 200, { ok: true });
  } catch (error) {
    return send(res, 400, { error: error.message || "Could not delete Admin Account." });
  }
};
