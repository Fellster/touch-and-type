import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Copy, Mail, Plus, ShieldCheck, Trash2, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Membership = {
  team_id: string;
  role: "admin" | "member";
  teams: { id: string; name: string; created_by: string } | null;
};

type InviteResult = { link: string; code: string; expires_at: string; emailSent?: boolean };
type TeamMember = { user_id: string; name: string; email: string; role: "admin" | "member"; joined_at: string };

export default function Workspaces() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [teamMembers, setTeamMembers] = useState<Record<string, TeamMember[]>>({});
  const [removeMember, setRemoveMember] = useState<{ team_id: string; member: TeamMember } | null>(null);
  const [revokePersonalShares, setRevokePersonalShares] = useState(true);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [inviteTeam, setInviteTeam] = useState<Membership | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [working, setWorking] = useState(false);
  const acceptedToken = useRef<string | null>(null);
  const db = supabase as any;

  const functionErrorMessage = async (error: any, data: any, fallback: string) => {
    if (data?.error) return String(data.error);
    const response = error?.context;
    if (response && typeof response.clone === "function") {
      try {
        const body = await response.clone().json();
        if (body?.error) return String(body.error);
      } catch {
        // Keep the friendly fallback when the response is not JSON.
      }
    }
    return error?.message && error.message !== "Edge Function returned a non-2xx status code"
      ? String(error.message)
      : fallback;
  };

  const loadTeams = async () => {
    setLoading(true);
    const { data, error } = await db
      .from("team_members")
      .select("team_id,role,teams(id,name,created_by)")
      .order("joined_at", { ascending: true });
    if (error) toast.error(error.message);
    const nextMemberships = (data ?? []) as Membership[];
    setMemberships(nextMemberships);
    const adminTeams = nextMemberships.filter((membership) => membership.role === "admin");
    const memberResults = await Promise.all(adminTeams.map(async (membership) => {
      const result = await supabase.functions.invoke("team-invitations", {
        body: { action: "list_members", team_id: membership.team_id },
      });
      return [membership.team_id, (result.data?.members ?? []) as TeamMember[]] as const;
    }));
    setTeamMembers(Object.fromEntries(memberResults));
    setLoading(false);
  };

  const acceptInvitation = async (input: { token?: string; code?: string }) => {
    setWorking(true);
    const { data, error } = await supabase.functions.invoke("team-invitations", {
      body: { action: "accept", ...input },
    });
    setWorking(false);
    if (error || data?.error) return toast.error(await functionErrorMessage(error, data, "Could not accept this invitation."));
    toast.success("Team joined");
    setJoinCode("");
    nav("/workspaces", { replace: true });
    await loadTeams();
  };

  useEffect(() => {
    if (!user) return;
    loadTeams();
    const token = searchParams.get("token");
    if (token && acceptedToken.current !== token) {
      acceptedToken.current = token;
      acceptInvitation({ token });
    }
  }, [user?.id]);

  const createTeam = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = teamName.trim();
    if (!name || !user) return;
    const { error } = await db.from("teams").insert({ name, created_by: user.id });
    if (error) return toast.error(error.message);
    setTeamName("");
    setCreating(false);
    toast.success(name + " created");
    await loadTeams();
  };

  const createInvitation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteTeam || !inviteEmail.trim()) return;
    setWorking(true);
    const { data, error } = await supabase.functions.invoke("team-invitations", {
      body: {
        action: "create",
        team_id: inviteTeam.team_id,
        email: inviteEmail.trim(),
        role: "member",
        origin: window.location.origin,
      },
    });
    setWorking(false);
    if (error || data?.error) return toast.error(await functionErrorMessage(error, data, "Could not create this invitation."));
    const result = data as InviteResult;
    setInviteResult(result);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) return toast.error("Invitation created, but the email could not be sent. Copy the link or code instead.");

    try {
      const emailResponse = await fetch("/.netlify/functions/send-team-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          team_id: inviteTeam.team_id,
          email: inviteEmail.trim(),
          link: result.link,
          code: result.code,
        }),
      });
      const emailData = await emailResponse.json().catch(() => ({}));
      if (!emailResponse.ok) throw new Error(emailData?.error || "Email could not be sent");
      setInviteResult({ ...result, emailSent: true });
      toast.success("Invitation emailed");
    } catch (emailError) {
      toast.error(emailError instanceof Error ? emailError.message : "Invitation created, but the email could not be sent.");
    }
  };

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(label + " copied");
  };

  const confirmRemoveMember = async () => {
    if (!removeMember) return;
    setWorking(true);
    const { data, error } = await supabase.functions.invoke("team-invitations", {
      body: {
        action: "remove_member",
        team_id: removeMember.team_id,
        user_id: removeMember.member.user_id,
        revoke_personal_shares: revokePersonalShares,
      },
    });
    setWorking(false);
    if (error || data?.error) return toast.error(await functionErrorMessage(error, data, "Could not remove this Team member."));
    const revokedCount = Number(data?.revoked_personal_shares ?? 0);
    toast.success((removeMember.member.name || removeMember.member.email) + " removed" + (revokedCount > 0 ? `; ${revokedCount} Personal share${revokedCount === 1 ? "" : "s"} revoked` : ""));
    setRemoveMember(null);
    await loadTeams();
  };

  const emailInvitation = () => {
    if (!inviteResult || !inviteTeam) return;
    const subject = encodeURIComponent("Join " + (inviteTeam.teams?.name ?? "my team") + " in Noted");
    const body = encodeURIComponent("You have been invited to join " + (inviteTeam.teams?.name ?? "a team") + " in Noted.\n\nOpen this secure link:\n" + inviteResult.link + "\n\nOr enter this temporary code: " + inviteResult.code + "\n\nThis invitation expires in 7 days.");
    window.location.href = "mailto:" + encodeURIComponent(inviteEmail) + "?subject=" + subject + "&body=" + body;
  };

  const closeInvitation = () => {
    setInviteTeam(null);
    setInviteEmail("");
    setInviteResult(null);
  };

  return (
    <main className="min-h-screen bg-background pb-24">
      <SEO title="Workspaces — Noted" description="Manage Personal and Team customer workspaces." path="/workspaces" />
      <header className="px-5 pt-6 max-w-2xl mx-auto flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav("/settings")} aria-label="Back to settings"><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1"><h1 className="font-serif text-2xl">Workspaces</h1><p className="text-xs text-muted-foreground">Customer ownership and access</p></div>
        <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" />Create team</Button>
      </header>

      <section className="px-5 max-w-2xl mx-auto mt-6 space-y-3">
        <Card className="p-4 flex items-start gap-3 border-primary/30">
          <UserRound className="h-5 w-5 text-primary mt-0.5" />
          <div><h2 className="font-medium">Personal</h2><p className="text-sm text-muted-foreground mt-1">Your private customer workspace. Existing customers stay here automatically.</p></div>
        </Card>

        <div className="pt-3 flex items-center justify-between"><h2 className="font-serif text-xl">Your teams</h2><span className="text-xs text-muted-foreground">{memberships.length} total</span></div>
        {loading ? <p className="text-center text-muted-foreground py-8">Loading…</p> : memberships.length === 0 ? (
          <Card className="p-6 text-center"><Users className="h-8 w-8 mx-auto text-muted-foreground" /><p className="font-medium mt-3">You are not on a team yet</p><p className="text-sm text-muted-foreground mt-1">Create a team or accept an invitation.</p></Card>
        ) : memberships.map((membership) => (
          <Card key={membership.team_id} className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center"><Users className="h-5 w-5" /></div>
              <div className="flex-1 min-w-0"><p className="font-medium truncate">{membership.teams?.name ?? "Team"}</p><p className="text-xs text-muted-foreground capitalize">{membership.role}</p></div>
              {membership.role === "admin" && (
                <><ShieldCheck className="h-5 w-5 text-primary" aria-label="Administrator" /><Button variant="outline" size="sm" onClick={() => setInviteTeam(membership)}>Invite</Button></>
              )}
            </div>
            {membership.role === "admin" && teamMembers[membership.team_id] && (
              <div className="mt-4 border-t pt-3 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Members</p>
                {teamMembers[membership.team_id].map((member) => (
                  <div key={member.user_id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{member.name || member.email.split("@")[0]}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                    <span className="text-xs text-muted-foreground capitalize shrink-0">{member.role}</span>
                    {member.user_id !== user?.id && member.user_id !== membership.teams?.created_by && (
                      <Button variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => { setRevokePersonalShares(true); setRemoveMember({ team_id: membership.team_id, member }); }} aria-label={`Remove ${member.name || member.email}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}

        <Card className="p-4 mt-5">
          <h2 className="font-medium">Join with a temporary code</h2>
          <p className="text-sm text-muted-foreground mt-1">Use the single-use code supplied by a Team administrator.</p>
          <div className="flex gap-2 mt-3">
            <Input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="Invitation code" aria-label="Invitation code" maxLength={8} />
            <Button disabled={working || !joinCode.trim()} onClick={() => acceptInvitation({ code: joinCode })}>Join</Button>
          </div>
        </Card>
      </section>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create a team</DialogTitle><DialogDescription>You become the first administrator. Team customers belong to the Team.</DialogDescription></DialogHeader>
          <form onSubmit={createTeam} className="space-y-4">
            <Input value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Team name" aria-label="Team name" autoFocus maxLength={100} />
            <Card className="p-3 text-sm text-muted-foreground">Personal customers remain private. Creating a team does not move existing customers.</Card>
            <DialogFooter><Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button><Button type="submit" disabled={!teamName.trim()}>Create team</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(inviteTeam)} onOpenChange={(open) => !open && closeInvitation()}>
        <DialogContent className="max-w-md">
          {!inviteResult ? (
            <>
              <DialogHeader><DialogTitle>Invite to {inviteTeam?.teams?.name ?? "Team"}</DialogTitle><DialogDescription>The invitation works only for this email address and expires after seven days.</DialogDescription></DialogHeader>
              <form onSubmit={createInvitation} className="space-y-4">
                <Input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="member@example.com" aria-label="Member email" inputMode="email" autoFocus />
                <DialogFooter><Button type="button" variant="ghost" onClick={closeInvitation}>Cancel</Button><Button type="submit" disabled={working || !inviteEmail.trim()}>{working ? "Creating…" : "Create invitation"}</Button></DialogFooter>
              </form>
            </>
          ) : (
            <>
              <DialogHeader><DialogTitle>{inviteResult.emailSent ? "Invitation sent" : "Invitation ready"}</DialogTitle><DialogDescription>{inviteResult.emailSent ? `An email was sent to ${inviteEmail}.` : "The email could not be sent automatically. Copy the secure link or temporary code instead."}</DialogDescription></DialogHeader>
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">Temporary code</p>
                <div className="flex items-center gap-2 mt-1"><p className="font-mono text-xl font-semibold tracking-wider flex-1">{inviteResult.code}</p><Button size="icon" variant="ghost" onClick={() => copy(inviteResult.code, "Code")}><Copy className="h-4 w-4" /></Button></div>
              </Card>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => copy(inviteResult.link, "Link")}><Copy className="h-4 w-4 mr-2" />Copy link</Button>
                {!inviteResult.emailSent && <Button onClick={emailInvitation}><Mail className="h-4 w-4 mr-2" />Open email</Button>}
              </div>
              <p className="text-xs text-muted-foreground">For security, Noted will not show this code again after you close this window.</p>
              <Button variant="ghost" onClick={closeInvitation}>Done</Button>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(removeMember)} onOpenChange={(open) => !open && !working && setRemoveMember(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Team member?</DialogTitle>
            <DialogDescription>
              {removeMember?.member.name || removeMember?.member.email} will immediately lose access to this Team and its customers. Their Personal customers and other Teams will not be affected.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-3 rounded-lg border p-3 text-sm cursor-pointer">
            <Checkbox
              checked={revokePersonalShares}
              onCheckedChange={(checked) => setRevokePersonalShares(checked === true)}
              disabled={working}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium block">Also remove my Personal customer shares</span>
              <span className="text-muted-foreground">Revokes every Personal customer that you shared directly with this person. Customers owned by other people are not affected.</span>
            </span>
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={working} onClick={() => setRemoveMember(null)}>Cancel</Button>
            <Button type="button" variant="destructive" disabled={working} onClick={confirmRemoveMember}>{working ? "Removing…" : "Remove member"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
