(function () {
  const env = window.TABLESHIFTS_ENV || {};
  const url = env.SUPABASE_URL || "";
  const key = env.SUPABASE_ANON_KEY || "";
  const sdk = window.supabase;

  const configured = Boolean(url && key && sdk?.createClient);
  const client = configured
    ? sdk.createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      })
    : null;

  window.TableShiftsSupabase = {
    configured,
    client,
    mode: configured ? "supabase" : "local"
  };
})();
