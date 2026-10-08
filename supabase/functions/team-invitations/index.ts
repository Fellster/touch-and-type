import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const uuidPattern = /^[0-9a-f-]{36}$/i;

const hash = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
};

const randomCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes).map((byte) => alphabet[byte % alphabet.length]).join("");
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
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Unauthorized" }, 401);

    const user = authData.user;
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    if (action === "list_members") {
      const teamId = String(body?.team_id ?? "");
      if (!uuidPattern.test(teamId)) return json({ error: "Invalid team" }, 400);
      const [{ data: team, error: teamError }, { data: membership, error: membershipError }] = await Promise.all([
        admin.from("teams").select("created_by").eq("id", teamId).maybeSingle(),
        admin.from("team_members").select("role").eq("team_id", teamId).eq("user_id", user.id).maybeSingle(),
      ]);
      if (teamError || membershipError) return json({ error: "Could not verify Team permissions." }, 500);
      if (!team) return json({ error: "Team not found." }, 404);
      if (team.created_by !== user.id && membership?.role !== "admin") {
        return json({ error: "Only a Team administrator can view the member list." }, 403);
      }
      const { data: rows, error: membersError } = await admin
        .from("team_members")
        .select("user_id,role,joined_at")
        .eq("team_id", teamId)
        .order("joined_at", { ascending: true });
      if (membersError) return json({ error: membersError.message }, 500);
      const members = await Promise.all((rows ?? []).map(async (row) => {
        const { data } = await admin.auth.admin.getUserById(row.user_id);
        const fullName = typeof data.user?.user_metadata?.full_name === "string"
          ? data.user.user_metadata.full_name.trim().slice(0, 100)
          : "";
        return { user_id: row.user_id, name: fullName, email: data.user?.email ?? "Unknown member", role: row.role, joined_at: row.joined_at };
      }));
      return json({ members });
    }

    if (action === "remove_member") {
      const teamId = String(body?.team_id ?? "");
      const memberId = String(body?.user_id ?? "");
      if (!uuidPattern.test(teamId) || !uuidPattern.test(memberId)) return json({ error: "Invalid Team member" }, 400);
      const [{ data: team, error: teamError }, { data: membership, error: membershipError }] = await Promise.all([
        admin.from("teams").select("created_by").eq("id", teamId).maybeSingle(),
        admin.from("team_members").select("role").eq("team_id", teamId).eq("user_id", user.id).maybeSingle(),
      ]);
      if (teamError || membershipError) return json({ error: "Could not verify Team permissions." }, 500);
      if (!team) return json({ error: "Team not found." }, 404);
      if (team.created_by !== user.id && membership?.role !== "admin") {
        return json({ error: "Only a Team administrator can remove members." }, 403);
      }
      if (memberId === user.id) return json({ error: "You cannot remove yourself here." }, 400);
      if (memberId === team.created_by) return json({ error: "The Team creator cannot be removed." }, 400);

      const revokePersonalShares = body?.revoke_personal_shares !== false;
      let revokedPersonalShares = 0;

      // Membership is the source of truth for all Team-customer access. The database
      // trigger also removes any redundant per-customer Team grants on deletion.
      const { error: removeError } = await admin.from("team_members").delete().eq("team_id", teamId).eq("user_id", memberId);
      if (removeError) return json({ error: removeError.message }, 500);

      if (revokePersonalShares) {
        // Revoke only Personal customers owned by the administrator performing this
        // removal. Do not touch shares from other owners or any other Team.
        const { data: personalCustomers, error: personalCustomerError } = await admin
          .from("customers")
          .select("id")
          .eq("user_id", user.id)
          .is("team_id", null);
        if (personalCustomerError) return json({ error: personalCustomerError.message }, 500);

        const personalCustomerIds = (personalCustomers ?? []).map((row) => row.id);
        if (personalCustomerIds.length > 0) {
          const { data: revokedRows, error: revokeError } = await admin
            .from("customer_shares")
            .delete()
            .eq("recipient_user_id", memberId)
            .in("customer_id", personalCustomerIds)
            .select("id");
          if (revokeError) return json({ error: revokeError.message }, 500);
          revokedPersonalShares = revokedRows?.length ?? 0;
        }
      }

      return json({ ok: true, revoked_personal_shares: revokedPersonalShares });
    }

    if (action === "delete_team") {
      const teamId = String(body?.team_id ?? "");
      if (!uuidPattern.test(teamId)) return json({ error: "Invalid Team" }, 400);

      const { data: team, error: teamError } = await admin
        .from("teams")
        .select("id,name,created_by")
        .eq("id", teamId)
        .maybeSingle();
      if (teamError) return json({ error: "Could not verify Team ownership." }, 500);
      if (!team) return json({ error: "Team not found." }, 404);
      if (team.created_by !== user.id) {
        return json({ error: "Only the person who created this Team can delete it." }, 403);
      }

      const { count: customerCount, error: customerError } = await admin
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("team_id", teamId);
      if (customerError) return json({ error: customerError.message }, 500);
      if ((customerCount ?? 0) > 0) {
        return json({ error: "Move or delete this Team's customers before deleting the Team." }, 409);
      }

      // Memberships and pending invitations cascade. The customer foreign key
      // uses RESTRICT, providing a final database safeguard against data loss.
      const { error: deleteError } = await admin.from("teams").delete().eq("id", teamId);
      if (deleteError) return json({ error: deleteError.message }, 500);
      return json({ ok: true, deleted_team: team.name });
    }

    if (action === "create") {
      const teamId = String(body?.team_id ?? "");
      const email = String(body?.email ?? "").trim().toLowerCase();
      const role = body?.role === "admin" ? "admin" : "member";
      if (!uuidPattern.test(teamId)) return json({ error: "Invalid team" }, 400);
      if (!emailPattern.test(email)) return json({ error: "Enter a valid email address" }, 400);
      if (email === (user.email ?? "").toLowerCase()) return json({ error: "That is your own account." }, 400);

      const [{ data: team, error: teamError }, { data: membership, error: membershipError }] = await Promise.all([
        admin.from("teams").select("created_by").eq("id", teamId).maybeSingle(),
        admin.from("team_members").select("role").eq("team_id", teamId).eq("user_id", user.id).maybeSingle(),
      ]);
      if (teamError || membershipError) return json({ error: "Could not verify Team permissions." }, 500);
      if (!team) return json({ error: "Team not found." }, 404);
      if (team.created_by !== user.id && membership?.role !== "admin") {
        return json({ error: "Only a Team administrator can invite members." }, 403);
      }

      const token = randomToken();
      const code = randomCode();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: invitation, error } = await admin.from("team_invitations").insert({
        team_id: teamId,
        email,
        role,
        token_hash: await hash(token),
        code_hash: await hash(code),
        invited_by: user.id,
        expires_at: expiresAt,
      }).select("id").single();
      if (error) return json({ error: error.message }, 500);

      const origin = typeof body?.origin === "string" && body.origin.startsWith("https://") ? body.origin : "https://notedcustomers.netlify.app";
      return json({
        invitation_id: invitation.id,
        link: origin + "/team-invite?token=" + encodeURIComponent(token),
        code,
        expires_at: expiresAt,
      });
    }

    if (action === "accept") {
      const token = typeof body?.token === "string" ? body.token.trim() : "";
      const code = typeof body?.code === "string" ? body.code.trim().toUpperCase() : "";
      if (!token && !code) return json({ error: "Enter an invitation code or open the invitation link." }, 400);
      const column = token ? "token_hash" : "code_hash";
      const value = await hash(token || code);

      const { data: invitation, error } = await admin
        .from("team_invitations")
        .select("id,team_id,email,role,expires_at,accepted_at,revoked_at")
        .eq(column, value)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!invitation || invitation.revoked_at || invitation.accepted_at || new Date(invitation.expires_at) <= new Date()) {
        return json({ error: "This invitation is invalid or has expired." }, 410);
      }
      if ((user.email ?? "").toLowerCase() !== invitation.email.toLowerCase()) {
        return json({ error: "Sign in with the email address that received this invitation." }, 403);
      }

      const { error: memberError } = await admin.from("team_members").upsert({
        team_id: invitation.team_id,
        user_id: user.id,
        role: invitation.role,
      }, { onConflict: "team_id,user_id" });
      if (memberError) return json({ error: memberError.message }, 500);
      const { error: acceptedError } = await admin.from("team_invitations").update({ accepted_at: new Date().toISOString() }).eq("id", invitation.id);
      if (acceptedError) return json({ error: acceptedError.message }, 500);
      return json({ team_id: invitation.team_id });
    }

    if (action === "revoke") {
      const invitationId = String(body?.invitation_id ?? "");
      if (!uuidPattern.test(invitationId)) return json({ error: "Invalid invitation" }, 400);
      const { data: invitation } = await admin.from("team_invitations").select("team_id").eq("id", invitationId).maybeSingle();
      if (!invitation) return json({ error: "Invitation not found" }, 404);
      const [{ data: team }, { data: membership }] = await Promise.all([
        admin.from("teams").select("created_by").eq("id", invitation.team_id).maybeSingle(),
        admin.from("team_members").select("role").eq("team_id", invitation.team_id).eq("user_id", user.id).maybeSingle(),
      ]);
      if (team?.created_by !== user.id && membership?.role !== "admin") return json({ error: "Only a Team administrator can revoke invitations." }, 403);
      const { error } = await admin.from("team_invitations").update({ revoked_at: new Date().toISOString() }).eq("id", invitationId);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
