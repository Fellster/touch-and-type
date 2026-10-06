import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const uuidPattern = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);
    const userId = authData.user.id;
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json().catch(() => ({}));
    const customerId = String(body?.customer_id ?? "");
    if (!uuidPattern.test(customerId)) return json({ error: "Invalid customer" }, 400);

    const { data: customer } = await admin.from("customers").select("id,user_id,team_id").eq("id", customerId).maybeSingle();
    if (!customer?.team_id) return json({ error: "This is not a Team customer." }, 400);
    const { data: caller } = await admin.from("team_members").select("role").eq("team_id", customer.team_id).eq("user_id", userId).maybeSingle();
    if (caller?.role !== "admin") return json({ error: "Only a Team administrator can manage customer access." }, 403);

    const list = async () => {
      const [{ data: members, error: memberError }, { data: access, error: accessError }] = await Promise.all([
        admin.from("team_members").select("user_id,role,joined_at").eq("team_id", customer.team_id).order("joined_at"),
        admin.from("team_customer_access").select("user_id,permission").eq("customer_id", customerId),
      ]);
      if (memberError) throw new Error(memberError.message);
      if (accessError) throw new Error(accessError.message);
      const accessMap = new Map((access ?? []).map((row) => [row.user_id, row.permission]));
      const output = [];
      for (const member of members ?? []) {
        const { data } = await admin.auth.admin.getUserById(member.user_id);
        output.push({
          user_id: member.user_id,
          email: data.user?.email ?? "(unknown user)",
          role: member.role,
          permission: member.role === "admin" || member.user_id === customer.user_id ? "edit" : (accessMap.get(member.user_id) ?? "none"),
          locked: member.role === "admin" || member.user_id === customer.user_id,
        });
      }
      return output;
    };

    const action = String(body?.action ?? "");
    if (action === "list") return json({ members: await list() });

    if (action === "set") {
      const targetUserId = String(body?.user_id ?? "");
      const permission = String(body?.permission ?? "");
      if (!uuidPattern.test(targetUserId) || !["none", "view", "edit"].includes(permission)) return json({ error: "Invalid access setting" }, 400);
      const { data: target } = await admin.from("team_members").select("role").eq("team_id", customer.team_id).eq("user_id", targetUserId).maybeSingle();
      if (!target) return json({ error: "That person is no longer a Team member." }, 404);
      if (target.role === "admin" || targetUserId === customer.user_id) return json({ error: "Administrators and the customer creator always have Edit access." }, 400);

      if (permission === "none") {
        const { error } = await admin.from("team_customer_access").delete().eq("customer_id", customerId).eq("user_id", targetUserId);
        if (error) return json({ error: error.message }, 500);
      } else {
        const { error } = await admin.from("team_customer_access").upsert({
          customer_id: customerId,
          user_id: targetUserId,
          permission,
          granted_by: userId,
        }, { onConflict: "customer_id,user_id" });
        if (error) return json({ error: error.message }, 500);
      }
      return json({ members: await list() });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
