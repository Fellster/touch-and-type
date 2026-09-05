import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const isUuid = (v: unknown) => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");
    const customerId = body?.customer_id;
    if (!isUuid(customerId)) return json({ error: "Invalid customer_id" }, 400);

    const admin = createClient(url, service, { auth: { persistSession: false } });

    const { data: customer, error: cErr } = await admin
      .from("customers").select("id,user_id").eq("id", customerId).maybeSingle();
    if (cErr) return json({ error: cErr.message }, 500);
    if (!customer) return json({ error: "Not found" }, 404);
    if (customer.user_id !== userId) return json({ error: "Only the owner can manage sharing" }, 403);

    const listShares = async () => {
      const { data, error } = await admin
        .from("customer_shares")
        .select("id,recipient_user_id,permission,created_at")
        .eq("customer_id", customerId)
        .order("created_at");
      if (error) throw new Error(error.message);
      const shares = data ?? [];
      const out = [];
      for (const s of shares) {
        const { data: u } = await admin.auth.admin.getUserById(s.recipient_user_id);
        out.push({ ...s, email: u?.user?.email ?? "(unknown user)" });
      }
      return out;
    };

    const findUserByEmail = async (email: string) => {
      const target = email.trim().toLowerCase();
      for (let page = 1; page <= 20; page++) {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw new Error(error.message);
        const hit = (data.users ?? []).find((u) => (u.email ?? "").toLowerCase() === target);
        if (hit) return hit;
        if (!data.users || data.users.length < 200) return null;
      }
      return null;
    };

    if (action === "list") return json({ shares: await listShares() });

    if (action === "add") {
      const email = typeof body?.email === "string" ? body.email.trim() : "";
      const permission = body?.permission === "edit" ? "edit" : "view";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Enter a valid email address" }, 400);

      const target = await findUserByEmail(email);
      if (!target) return json({ error: "No Noted account uses that email address." }, 404);
      if (target.id === userId) return json({ error: "That is your own account." }, 400);

      const { error } = await admin
        .from("customer_shares")
        .upsert(
          { customer_id: customerId, recipient_user_id: target.id, permission, granted_by: userId },
          { onConflict: "customer_id,recipient_user_id" },
        );
      if (error) return json({ error: error.message }, 500);
      return json({ shares: await listShares() });
    }

    if (action === "update") {
      const shareId = body?.share_id;
      const permission = body?.permission === "edit" ? "edit" : "view";
      if (!isUuid(shareId)) return json({ error: "Invalid share_id" }, 400);
      const { error } = await admin
        .from("customer_shares")
        .update({ permission, updated_at: new Date().toISOString() })
        .eq("id", shareId).eq("customer_id", customerId);
      if (error) return json({ error: error.message }, 500);
      return json({ shares: await listShares() });
    }

    if (action === "revoke") {
      const shareId = body?.share_id;
      if (!isUuid(shareId)) return json({ error: "Invalid share_id" }, 400);
      const { error } = await admin
        .from("customer_shares").delete().eq("id", shareId).eq("customer_id", customerId);
      if (error) return json({ error: error.message }, 500);
      return json({ shares: await listShares() });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
