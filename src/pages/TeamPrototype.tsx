import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, Merge, Plus, ShieldCheck, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import SEO from "@/components/SEO";

type Workspace = "personal" | "team";
type Permission = "No access" | "View" | "Edit";

const members = [
  { id: "keith", name: "Keith Fell", role: "Administrator" },
  { id: "marcia", name: "Marcia Woodward", role: "Member" },
  { id: "alex", name: "Alex Morgan", role: "Member" },
];

export default function TeamPrototype() {
  const nav = useNavigate();
  const [workspace, setWorkspace] = useState<Workspace>("team");
  const [menuOpen, setMenuOpen] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, Permission>>({ marcia: "Edit", alex: "View" });
  const [duplicateResolved, setDuplicateResolved] = useState(false);

  const chooseWorkspace = (next: Workspace) => {
    setWorkspace(next);
    setMenuOpen(false);
  };

  const setAccess = (memberId: string, permission: Permission) => {
    setPermissions((current) => ({ ...current, [memberId]: permission }));
    toast.success("Access changed to " + permission);
  };

  return (
    <main className="min-h-screen bg-background pb-24">
      <SEO title="Workspace prototype — Noted" description="Preview Personal and Team workspaces." path="/team-prototype" />
      <header className="px-5 pt-6 max-w-2xl mx-auto flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav("/settings")} aria-label="Back to settings">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-serif text-2xl">Workspace prototype</h1>
          <p className="text-xs text-muted-foreground">No real customer data will change</p>
        </div>
      </header>

      <section className="px-5 max-w-2xl mx-auto mt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">Current workspace</p>
        <div className="relative">
          <button type="button" className="w-full min-h-12 rounded-lg border bg-card px-4 py-3 flex items-center gap-3 text-left" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
            {workspace === "team" ? <Users className="h-5 w-5 text-primary" /> : <UserRound className="h-5 w-5 text-primary" />}
            <span className="flex-1">
              <span className="block font-medium">{workspace === "team" ? "Johnson Shoes" : "Personal"}</span>
              <span className="block text-xs text-muted-foreground">{workspace === "team" ? "Team workspace · You are administrator" : "Private · Only you"}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          {menuOpen && (
            <Card className="absolute z-20 top-full left-0 right-0 mt-2 p-1 shadow-lg">
              <button type="button" onClick={() => chooseWorkspace("personal")} className="w-full rounded-md px-3 py-3 flex items-center gap-3 text-left hover:bg-muted">
                <UserRound className="h-5 w-5" /><span className="flex-1"><span className="block font-medium">Personal</span><span className="block text-xs text-muted-foreground">Only you can see these customers</span></span>
                {workspace === "personal" && <Check className="h-4 w-4 text-primary" />}
              </button>
              <button type="button" onClick={() => chooseWorkspace("team")} className="w-full rounded-md px-3 py-3 flex items-center gap-3 text-left hover:bg-muted">
                <Users className="h-5 w-5" /><span className="flex-1"><span className="block font-medium">Johnson Shoes</span><span className="block text-xs text-muted-foreground">Team workspace</span></span>
                {workspace === "team" && <Check className="h-4 w-4 text-primary" />}
              </button>
            </Card>
          )}
        </div>
      </section>

      {workspace === "personal" ? (
        <section className="px-5 max-w-2xl mx-auto mt-6 space-y-5">
          <Card className="p-4 flex items-start gap-3">
            <UserRound className="h-5 w-5 text-primary mt-0.5" />
            <div><h2 className="font-medium">Personal workspace</h2><p className="text-sm text-muted-foreground mt-1">Customers added here belong only to you. Team administrators cannot see them.</p></div>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">New customer destination</p>
            <p className="font-medium mt-1">Personal</p>
            <Button className="w-full mt-4" onClick={() => toast.info("Prototype only — no customer was added")}><Plus className="h-4 w-4" />Add personal customer</Button>
          </Card>
          <div>
            <h2 className="font-serif text-xl mb-3">Your customers</h2>
            <Card className="p-4 flex items-center gap-3"><div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center font-medium">JS</div><div><p className="font-medium">Jamie Smith</p><p className="text-xs text-muted-foreground">Personal customer</p></div></Card>
          </div>
        </section>
      ) : (
        <section className="px-5 max-w-2xl mx-auto mt-6 space-y-7">
          <Card className="p-4 border-primary/40 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
            <div><h2 className="font-medium">Johnson Shoes — Team workspace</h2><p className="text-sm text-muted-foreground mt-1">Customers added here belong to Johnson Shoes. Only administrators manage access.</p></div>
          </Card>
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">New customer destination</p>
            <p className="font-medium mt-1">Johnson Shoes</p>
            <Button className="w-full mt-4" onClick={() => toast.info("Prototype only — no customer was added")}><Plus className="h-4 w-4" />Add team customer</Button>
          </Card>
          <div>
            <div className="flex items-center justify-between gap-3 mb-3"><h2 className="font-serif text-xl">Team members</h2><Button variant="outline" size="sm" onClick={() => toast.info("Invitation screen would open here")}><Plus className="h-4 w-4" />Invite</Button></div>
            <div className="space-y-2">
              {members.map((member) => (
                <Card key={member.id} className="p-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center text-sm font-medium">{member.name.split(" ").map((part) => part[0]).join("")}</div>
                  <div className="flex-1"><p className="font-medium">{member.name}</p><p className="text-xs text-muted-foreground">{member.role}</p></div>
                  {member.role === "Administrator" && <ShieldCheck className="h-4 w-4 text-primary" />}
                </Card>
              ))}
            </div>
          </div>
          <div>
            <h2 className="font-serif text-xl mb-1">Customer access</h2>
            <p className="text-sm text-muted-foreground mb-3">Marcia Woodward · Added by Keith Fell</p>
            <Card className="divide-y">
              {members.slice(1).map((member) => (
                <div key={member.id} className="p-3">
                  <p className="font-medium mb-2">{member.name}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["No access", "View", "Edit"] as Permission[]).map((permission) => (
                      <button key={permission} type="button" onClick={() => setAccess(member.id, permission)} className={"min-h-10 rounded-md border px-2 text-sm " + (permissions[member.id] === permission ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background")}>{permission}</button>
                    ))}
                  </div>
                </div>
              ))}
            </Card>
          </div>
          <div>
            <h2 className="font-serif text-xl mb-3">Possible duplicates</h2>
            {duplicateResolved ? (
              <Card className="p-4 flex items-center gap-3"><Check className="h-5 w-5 text-primary" /><div><p className="font-medium">Duplicate reviewed</p><p className="text-xs text-muted-foreground">The administrator’s decision is recorded.</p></div></Card>
            ) : (
              <Card className="p-4">
                <p className="font-medium">Jane Miller may already exist</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-muted p-3"><p className="font-medium">Jane Miller</p><p className="text-muted-foreground mt-1">(847) 555-0132</p><p className="text-xs text-muted-foreground mt-2">Added by Marcia</p></div>
                  <div className="rounded-md bg-muted p-3"><p className="font-medium">Janie Miller</p><p className="text-muted-foreground mt-1">(847) 555-0132</p><p className="text-xs text-muted-foreground mt-2">Added by Alex</p></div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3"><Button variant="outline" onClick={() => setDuplicateResolved(true)}>Keep separate</Button><Button onClick={() => setDuplicateResolved(true)}><Merge className="h-4 w-4" />Merge</Button></div>
              </Card>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
