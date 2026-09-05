import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const customerId = typeof body?.customer_id === "string" ? body.customer_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(customerId)) return json({ error: "Invalid customer_id" }, 400);

    const admin = createClient(url, service, { auth: { persistSession: false } });

    // Only the owner may delete.
    const { data: customer, error: cErr } = await admin
      .from("customers").select("id,user_id").eq("id", customerId).maybeSingle();
    if (cErr) return json({ error: cErr.message }, 500);
    if (!customer) return json({ error: "Not found" }, 404);
    if (customer.user_id !== userId) return json({ error: "Forbidden" }, 403);

    const [{ data: photos }, { data: drawings }] = await Promise.all([
      admin.from("photos").select("storage_path").eq("customer_id", customerId),
      admin.from("drawings").select("storage_path").eq("customer_id", customerId),
    ]);

    const photoPaths = (photos ?? []).map((p) => p.storage_path).filter(Boolean);
    const drawingPaths = (drawings ?? []).map((d) => d.storage_path).filter(Boolean);

    if (photoPaths.length) await admin.storage.from("photos").remove(photoPaths);
    if (drawingPaths.length) await admin.storage.from("drawings").remove(drawingPaths);

    const { error: delErr } = await admin.from("customers").delete().eq("id", customerId);
    if (delErr) return json({ error: delErr.message }, 500);

    return json({ ok: true, removed_files: photoPaths.length + drawingPaths.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, 500);
  }
});
