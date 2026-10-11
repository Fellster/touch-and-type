import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authorization = req.headers.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "Please sign in again." }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authorization } } });
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return json({ error: "Please sign in again." }, 401);
    const body = await req.json();
    const ids = body.customer_ids;
    const destination = body.destination_team_id ?? null;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || ids.some((id) => typeof id !== "string" || !uuid.test(id)) || new Set(ids).size !== ids.length || !uuid.test(body.source_team_id ?? "") || !uuid.test(body.owner_id ?? "") || (destination !== null && !uuid.test(destination))) return json({ error: "Invalid customer move." }, 400);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.rpc("move_team_customers", { _actor: auth.user.id, _source: body.source_team_id, _ids: ids, _destination: destination, _owner: body.owner_id });
    if (error) return json({ error: error.message }, 400);
    return json({ moved: data });
  } catch { return json({ error: "Could not move customers. Refresh and try again." }, 500); }
});
