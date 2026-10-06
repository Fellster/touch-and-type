import type { Handler } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const json = (statusCode: number, body: Record<string, unknown>) => ({
  statusCode,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify(body),
});

const normalizeEmail = (value: unknown) => String(value ?? "").trim().toLowerCase();

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!gmailUser || !gmailPassword || !supabaseUrl || !supabaseKey) {
    return json(500, { error: "Email delivery is not configured yet." });
  }

  const authorization = event.headers.authorization;
  const accessToken = authorization?.replace(/^Bearer\s+/i, "");
  if (!accessToken) return json(401, { error: "Please sign in again." });

  let input: { team_id?: string; email?: string; link?: string; code?: string };
  try { input = JSON.parse(event.body ?? "{}"); }
  catch { return json(400, { error: "Invalid request." }); }

  const teamId = String(input.team_id ?? "");
  const email = normalizeEmail(input.email);
  const code = String(input.code ?? "").trim().toUpperCase();
  let inviteUrl: URL;
  try { inviteUrl = new URL(String(input.link ?? "")); }
  catch { return json(400, { error: "Invalid invitation link." }); }
  const rawToken = inviteUrl.searchParams.get("token") ?? "";
  if (!teamId || !/^\S+@\S+\.\S+$/.test(email) || !rawToken || !/^[A-Z0-9]{8}$/.test(code)) {
    return json(400, { error: "Invitation information is incomplete." });
  }
  if (!/^(notedcustomers\.netlify\.app|deploy-preview-\d+--notedcustomers\.netlify\.app)$/.test(inviteUrl.hostname)) {
    return json(400, { error: "Invalid invitation destination." });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData.user) return json(401, { error: "Please sign in again." });

  const [{ data: team }, { data: membership }, tokenHash] = await Promise.all([
    supabase.from("teams").select("name,created_by").eq("id", teamId).maybeSingle(),
    supabase.from("team_members").select("role").eq("team_id", teamId).eq("user_id", userData.user.id).maybeSingle(),
    sha256(rawToken),
  ]);
  if (!team || (team.created_by !== userData.user.id && membership?.role !== "admin")) {
    return json(403, { error: "Only a Team administrator can email invitations." });
  }

  const { data: invitation } = await supabase
    .from("team_invitations")
    .select("id")
    .eq("team_id", teamId)
    .eq("email", email)
    .eq("invited_by", userData.user.id)
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!invitation) return json(403, { error: "This invitation could not be verified." });

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: gmailPassword.replace(/\s/g, "") },
  });
  const safeTeamName = String(team.name ?? "a team").replace(/[\r\n]/g, " ").slice(0, 100);
  try {
    await transporter.sendMail({
      from: `Noted <${gmailUser}>`,
      to: email,
      subject: `Join ${safeTeamName} in Noted`,
      text: `You have been invited to join ${safeTeamName} in Noted.\n\nOpen this secure link:\n${inviteUrl.toString()}\n\nOr enter this temporary code: ${code}\n\nThis invitation expires in 7 days.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#241f1b"><h2>Join ${safeTeamName.replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!))} in Noted</h2><p>You have been invited to join this Team workspace.</p><p><a href="${inviteUrl.toString().replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" style="display:inline-block;background:#241f1b;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none">Accept invitation</a></p><p>Temporary code: <strong style="letter-spacing:2px">${code}</strong></p><p style="color:#6b625c;font-size:13px">This invitation expires in 7 days.</p></div>`,
    });
    return json(200, { sent: true });
  } catch (error) {
    console.error("Team invitation email failed", error);
    return json(502, { error: "The invitation was created, but Gmail could not send it." });
  }
};
