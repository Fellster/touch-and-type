import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronDown, Plus, ShieldCheck, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import SEO from "@/components/SEO";

type Filter = "all" | "personal" | "johnson" | "lakeview";
type TeamAction = "create" | "join" | null;

const filters: { id: Filter; name: string; detail: string }[] = [
  { id: "all", name: "All Workspaces", detail: "Personal and every team" },
  { id: "personal", name: "Personal", detail: "Private · Only you" },
  { id: "johnson", name: "Johnson Shoes", detail: "Team · Administrator" },
  { id: "lakeview", name: "Lakeview Sales", detail: "Team · Member" },
];

const customers = [
  { name: "Jamie Smith", phone: "(847) 555-0188", workspace: "Personal", filter: "personal", color: "bg-secondary text-secondary-foreground" },
  { name: "Marcia Woodward", phone: "(630) 640-3515", workspace: "Johnson Shoes", filter: "johnson", color: "bg-primary text-primary-foreground" },
  { name: "Jarlath Hayes", phone: "(630) 802-7875", workspace: "Lakeview Sales", filter: "lakeview", color: "bg-accent text-accent-foreground" },
];

const todos = [
  { task: "Call Jamie about fall order", due: "Today · 2:00 PM", workspace: "Personal", filter: "personal" },
  { task: "Confirm Marcia's trunk show", due: "Tomorrow", workspace: "Johnson Shoes", filter: "johnson" },
  { task: "Send Jarlath updated pricing", due: "Friday", workspace: "Lakeview Sales", filter: "lakeview" },
];

export default function TeamPrototype() {
  const nav = useNavigate();
  const [hasTeams, setHasTeams] = useState(false);
  const [filter, setFilter] = useState<Filter>("personal");
  const [menuOpen, setMenuOpen] = useState(false);
  const [teamAction, setTeamAction] = useState<TeamAction>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [destination, setDestination] = useState<Exclude<Filter, "all">>("personal");
  const [tab, setTab] = useState<"customers" | "todos">("customers");

  const visibleFilters = hasTeams ? filters : filters.filter((item) => item.id === "personal");
  const current = filters.find((item) => item.id === filter) ?? filters[0];
  const visibleCustomers = customers.filter((item) => filter === "all" || item.filter === filter);
  const visibleTodos = todos.filter((item) => filter === "all" || item.filter === filter);

  const activateTeams = (message: string) => {
    setHasTeams(true);
    setFilter("all");
    setDestination("johnson");
    setTeamAction(null);
    toast.success(message);
  };

  const chooseFilter = (next: Filter) => {
    setFilter(next);
    setMenuOpen(false);
    if (next !== "all") setDestination(next);
  };

  return (
    <main className="min-h-screen bg-background pb-24">
      <SEO title="Workspace prototype — Noted" description="Preview a unified Personal and Team workspace." path="/team-prototype" />
      <header className="px-5 pt-6 max-w-2xl mx-auto flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav("/settings")} aria-label="Back to settings">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-serif text-2xl">Workspace prototype</h1>
          <p className="text-xs text-muted-foreground">Visual preview · No real data will change</p>
        </div>
      </header>

      <section className="px-5 max-w-2xl mx-auto mt-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-2">
          {hasTeams ? "Show" : "Current workspace"}
        </p>
        <div className="relative">
          <button type="button" className="w-full min-h-12 rounded-lg border bg-card px-4 py-3 flex items-center gap-3 text-left" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen}>
            {filter === "personal" ? <UserRound className="h-5 w-5 text-primary" /> : <Users className="h-5 w-5 text-primary" />}
            <span className="flex-1">
              <span className="block font-medium">{current.name}</span>
              <span className="block text-xs text-muted-foreground">{current.detail}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
          {menuOpen && (
            <Card className="absolute z-20 top-full left-0 right-0 mt-2 p-1 shadow-lg">
              {visibleFilters.map((item) => (
                <button key={item.id} type="button" onClick={() => chooseFilter(item.id)} className="w-full rounded-md px-3 py-3 flex items-center gap-3 text-left hover:bg-muted">
                  {item.id === "personal" ? <UserRound className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                  <span className="flex-1"><span className="block font-medium">{item.name}</span><span className="block text-xs text-muted-foreground">{item.detail}</span></span>
                  {filter === item.id && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
            </Card>
          )}
        </div>
        {hasTeams && <p className="text-xs text-muted-foreground mt-2">This selector filters the lists. It does not move or change ownership.</p>}
      </section>

      {!hasTeams ? (
        <section className="px-5 max-w-2xl mx-auto mt-6 space-y-5">
          <Card className="p-4 flex items-start gap-3">
            <UserRound className="h-5 w-5 text-primary mt-0.5" />
            <div><h2 className="font-medium">Personal starts as your default</h2><p className="text-sm text-muted-foreground mt-1">Your customers and to-dos are private until you create or join a team.</p></div>
          </Card>
          <Card className="p-4">
            <h2 className="font-medium">Work with a team</h2>
            <p className="text-sm text-muted-foreground mt-1">After joining, All Workspaces combines everything you are allowed to see.</p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Button variant="outline" onClick={() => setTeamAction("join")}>Join a team</Button>
              <Button onClick={() => setTeamAction("create")}>Create a team</Button>
            </div>
          </Card>
        </section>
      ) : (
        <section className="px-5 max-w-2xl mx-auto mt-6">
          <Card className="p-4 border-primary/40 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
            <div><h2 className="font-medium">Everything together, ownership separate</h2><p className="text-sm text-muted-foreground mt-1">Customers and to-dos from Personal and both teams appear together. Labels show where each item belongs.</p></div>
          </Card>
        </section>
      )}

      <section className="px-5 max-w-2xl mx-auto mt-6">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setTab("customers")} className={"min-h-11 rounded-md border text-sm font-medium " + (tab === "customers" ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>Customers</button>
          <button type="button" onClick={() => setTab("todos")} className={"min-h-11 rounded-md border text-sm font-medium " + (tab === "todos" ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>To-Dos</button>
        </div>
      </section>

      <section className="px-5 max-w-2xl mx-auto mt-5">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Save new {tab === "customers" ? "customer" : "to-do"} to</p>
          <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: hasTeams ? "repeat(3, minmax(0, 1fr))" : "1fr" }}>
            {(hasTeams ? filters.filter((item) => item.id !== "all") : filters.filter((item) => item.id === "personal")).map((item) => (
              <button key={item.id} type="button" onClick={() => setDestination(item.id as Exclude<Filter, "all">)} className={"min-h-10 rounded-md border px-2 text-xs " + (destination === item.id ? "border-primary bg-primary text-primary-foreground" : "bg-background")}>{item.name}</button>
            ))}
          </div>
          <Button className="w-full mt-3" onClick={() => toast.info("Prototype only — saved destination would be " + filters.find((item) => item.id === destination)?.name)}>
            <Plus className="h-4 w-4" />Add {tab === "customers" ? "customer" : "to-do"}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">The destination is confirmed before saving and cannot be changed by switching the filter.</p>
        </Card>
      </section>

      <section className="px-5 max-w-2xl mx-auto mt-6">
        <div className="flex items-end justify-between gap-3 mb-3">
          <h2 className="font-serif text-xl">{tab === "customers" ? "Customers" : "To-Dos"}</h2>
          <span className="text-xs text-muted-foreground">{filter === "all" ? "All Workspaces" : current.name}</span>
        </div>
        {tab === "customers" ? (
          <div className="space-y-2">
            {visibleCustomers.map((customer) => (
              <Card key={customer.name} className="p-4 flex items-center gap-3">
                <div className={"h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium " + customer.color}>{customer.name.split(" ").map((part) => part[0]).join("")}</div>
                <div className="min-w-0 flex-1"><p className="font-medium">{customer.name}</p><p className="text-sm text-muted-foreground">{customer.phone}</p></div>
                <span className="rounded-full border px-2 py-1 text-[11px] whitespace-nowrap">{customer.workspace}</span>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {visibleTodos.map((todo) => (
              <Card key={todo.task} className="p-4">
                <div className="flex items-start gap-3"><div className="h-5 w-5 rounded-full border mt-0.5" /><div className="min-w-0 flex-1"><p className="font-medium">{todo.task}</p><p className="text-sm text-muted-foreground mt-1">{todo.due}</p></div><span className="rounded-full border px-2 py-1 text-[11px] whitespace-nowrap">{todo.workspace}</span></div>
              </Card>
            ))}
          </div>
        )}
        {(tab === "customers" ? visibleCustomers : visibleTodos).length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">Nothing in this workspace yet.</Card>}
      </section>

      {hasTeams && (
        <section className="px-5 max-w-2xl mx-auto mt-6">
          <Card className="p-4">
            <h2 className="font-medium">Possible match across workspaces</h2>
            <p className="text-sm text-muted-foreground mt-1">Before adding “Jane Miller,” Noted found a similar customer in Johnson Shoes. You can review it, but only a Johnson Shoes administrator can merge that team’s records.</p>
            <Button variant="outline" className="w-full mt-3" onClick={() => toast.info("A comparison screen would open here")}>Review possible duplicate</Button>
          </Card>
        </section>
      )}

      <Dialog open={teamAction === "create"} onOpenChange={(open) => !open && setTeamAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create a team</DialogTitle><DialogDescription>You become its first administrator. Team customers belong to the team.</DialogDescription></DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); if (!newTeamName.trim()) return toast.error("Enter a team name"); activateTeams(newTeamName.trim() + " created"); setNewTeamName(""); }} className="space-y-4">
            <Input value={newTeamName} onChange={(event) => setNewTeamName(event.target.value)} placeholder="Team name" aria-label="Team name" autoFocus />
            <div className="rounded-md bg-muted p-3 text-sm">This preview also adds a second sample team so you can test the combined All Workspaces view.</div>
            <DialogFooter><Button type="button" variant="ghost" onClick={() => setTeamAction(null)}>Cancel</Button><Button type="submit">Create team</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={teamAction === "join"} onOpenChange={(open) => !open && setTeamAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Join a team</DialogTitle><DialogDescription>Use a secure email invitation or a single-use temporary code.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <Card className="p-4">
              <p className="font-medium">Invitation from Keith Fell</p>
              <p className="text-sm text-muted-foreground mt-1">Johnson Shoes · Member</p>
              <p className="text-xs text-muted-foreground mt-2">Customers added to this workspace belong to Johnson Shoes.</p>
              <Button className="w-full mt-3" variant="outline" onClick={() => activateTeams("Team invitation accepted")}>Accept invitation</Button>
            </Card>
            <Card className="p-4">
              <p className="font-medium">Temporary invitation code</p>
              <Input className="mt-3" value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="Example: JSHOES-4827" aria-label="Invitation code" />
              <Button className="w-full mt-3" onClick={() => { if (!inviteCode.trim()) return toast.error("Enter an invitation code"); setInviteCode(""); activateTeams("Joined team with code"); }}>Join with code</Button>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
