import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, ShieldCheck, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

export default function Workspaces() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [teamName, setTeamName] = useState("");
  const db = supabase as any;

  const loadTeams = async () => {
    setLoading(true);
    const { data, error } = await db
      .from("team_members")
      .select("team_id,role,teams(id,name,created_by)")
      .order("joined_at", { ascending: true });
    if (error) toast.error(error.message);
    setMemberships((data ?? []) as Membership[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) loadTeams();
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

  return (
    <main className="min-h-screen bg-background pb-24">
      <SEO title="Workspaces — Noted" description="Manage Personal and Team customer workspaces." path="/workspaces" />
      <header className="px-5 pt-6 max-w-2xl mx-auto flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav("/settings")} aria-label="Back to settings">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-serif text-2xl">Workspaces</h1>
          <p className="text-xs text-muted-foreground">Customer ownership and access</p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" />Create team</Button>
      </header>

      <section className="px-5 max-w-2xl mx-auto mt-6 space-y-3">
        <Card className="p-4 flex items-start gap-3 border-primary/30">
          <UserRound className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h2 className="font-medium">Personal</h2>
            <p className="text-sm text-muted-foreground mt-1">Your private customer workspace. Existing customers stay here automatically.</p>
          </div>
        </Card>

        <div className="pt-3 flex items-center justify-between">
          <h2 className="font-serif text-xl">Your teams</h2>
          <span className="text-xs text-muted-foreground">{memberships.length} total</span>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-8">Loading…</p>
        ) : memberships.length === 0 ? (
          <Card className="p-6 text-center">
            <Users className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="font-medium mt-3">You are not on a team yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create a team or accept an invitation from an administrator.</p>
          </Card>
        ) : (
          memberships.map((membership) => (
            <Card key={membership.team_id} className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center"><Users className="h-5 w-5" /></div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{membership.teams?.name ?? "Team"}</p>
                <p className="text-xs text-muted-foreground capitalize">{membership.role}</p>
              </div>
              {membership.role === "admin" && <ShieldCheck className="h-5 w-5 text-primary" aria-label="Administrator" />}
            </Card>
          ))
        )}

        <Card className="p-4 mt-5">
          <h2 className="font-medium">Invitations</h2>
          <p className="text-sm text-muted-foreground mt-1">Secure email links and temporary codes are being connected next. Invitation tokens will never be stored in readable form.</p>
        </Card>
      </section>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create a team</DialogTitle>
            <DialogDescription>You will become the first administrator. Customers added to the team belong to the team.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createTeam} className="space-y-4">
            <Input value={teamName} onChange={(event) => setTeamName(event.target.value)} placeholder="Team name" aria-label="Team name" autoFocus maxLength={100} />
            <Card className="p-3 text-sm text-muted-foreground">Personal customers remain private. Creating a team does not move existing customers.</Card>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
              <Button type="submit" disabled={!teamName.trim()}>Create team</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
