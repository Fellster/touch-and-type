import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowUpDown, Pencil, Plus, Search, User } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { useLabels } from "@/hooks/useSettings";
import VoiceCapture, { type ParsedResult } from "@/components/VoiceCapture";

type SortOption = "updated_desc" | "customer_asc" | "customer_desc";
type Workspace = { id: string; name: string; role: "admin" | "member" };
type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  designers: string[];
  looking_for: string[];
  shoe_size: number | null;
  updated_at: string;
  user_id: string;
  team_id: string | null;
  workspace_name: string;
  shared?: "view" | "edit";
};

export default function Customers() {
  return <CustomersInner />;
}

function CustomerRow({ c, onOpen, onRename }: { c: Customer; onOpen: () => void; onRename: (name: string) => void | Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.name);
  const labels = useLabels();
  const commit = () => {
    setEditing(false);
    const value = draft.trim();
    if (value && value !== c.name) onRename(value);
    else setDraft(c.name);
  };

  return (
    <Card onClick={() => !editing && onOpen()} className="p-3 flex items-center gap-3 cursor-pointer hover:bg-accent transition-colors">
      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center"><User className="h-4 w-4 text-muted-foreground" /></div>
      <div className="flex-1 min-w-0" onClick={(event) => editing && event.stopPropagation()}>
        {editing && c.shared !== "view" ? (
          <Input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => {
            if (event.key === "Enter") { event.preventDefault(); commit(); }
            if (event.key === "Escape") { setDraft(c.name); setEditing(false); }
          }} className="h-8 text-sm" aria-label="Edit customer name" />
        ) : (
          <div className="font-medium truncate flex items-center gap-2">
            <span className="truncate">{c.name}</span>
          </div>
        )}
        <div className="text-xs text-muted-foreground truncate">
          {[c.designers?.length ? c.designers.join(" · ") : null, c.looking_for?.length ? `${labels.looking_for}: ${c.looking_for.join(" · ")}` : null, c.shoe_size ? `Size ${c.shoe_size}` : null, c.phone || c.email || "—"].filter(Boolean).join(" · ")}
        </div>
      </div>
      {c.shared !== "view" && <Button variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); onOpen(); }} aria-label="Edit customer"><Pencil className="h-4 w-4" /></Button>}
    </Card>
  );
}

function CustomersInner() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [filter, setFilter] = useState("all");
  const [destination, setDestination] = useState("personal");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortOption>("updated_desc");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(searchParams.get("add") === "1");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [duplicate, setDuplicate] = useState<Customer | null>(null);
  const db = supabase as any;

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: membershipData, error: membershipError }, { data: customerData, error: customerError }, { data: personalShares }, { data: teamAccess }] = await Promise.all([
      db.from("team_members").select("team_id,role,teams(id,name)").order("joined_at"),
      db.from("customers").select("id,name,phone,email,designers,looking_for,shoe_size,updated_at,user_id,team_id,teams(name)").order("updated_at", { ascending: false }),
      db.from("customer_shares").select("customer_id,permission").eq("recipient_user_id", user.id),
      db.from("team_customer_access").select("customer_id,permission").eq("user_id", user.id),
    ]);
    if (membershipError) toast.error(membershipError.message);
    if (customerError) toast.error(customerError.message);

    const memberships: Workspace[] = (membershipData ?? []).map((row: any) => ({ id: row.team_id, name: row.teams?.name ?? "Team", role: row.role }));
    setWorkspaces(memberships);
    const admins = new Set(memberships.filter((item) => item.role === "admin").map((item) => item.id));
    const personalMap = new Map((personalShares ?? []).map((row: any) => [row.customer_id, row.permission]));
    const teamMap = new Map((teamAccess ?? []).map((row: any) => [row.customer_id, row.permission]));

    const list: Customer[] = (customerData ?? []).map((row: any) => {
      let permission: "view" | "edit" | undefined;
      if (row.team_id) {
        if (row.user_id !== user.id && !admins.has(row.team_id)) permission = teamMap.get(row.id) === "edit" ? "edit" : "view";
      } else if (row.user_id !== user.id) {
        permission = personalMap.get(row.id) === "edit" ? "edit" : "view";
      }
      return { ...row, workspace_name: row.team_id ? (row.teams?.name ?? "Team") : "Personal", shared: permission };
    });
    setCustomers(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const results = useMemo(() => {
    const search = q.trim().toLowerCase();
    const list = customers.filter((customer) => {
      const inWorkspace = filter === "all" || (filter === "personal" ? !customer.team_id : customer.team_id === filter);
      const matches = !search || [customer.name, customer.phone ?? "", customer.email ?? "", (customer.designers ?? []).join(" "), (customer.looking_for ?? []).join(" ")].join(" ").toLowerCase().includes(search);
      return inWorkspace && matches;
    });
    list.sort((a, b) => sort === "customer_asc" ? a.name.localeCompare(b.name) : sort === "customer_desc" ? b.name.localeCompare(a.name) : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    return list;
  }, [customers, q, sort, filter]);

  const destinationName = destination === "personal" ? "Personal" : workspaces.find((workspace) => workspace.id === destination)?.name ?? "Team";

  const reviewAdd = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    const normalizedPhone = newPhone.replace(/\D/g, "");
    const match = customers.find((customer) => customer.name.trim().toLowerCase() === newName.trim().toLowerCase() || (normalizedPhone.length >= 7 && customer.phone?.replace(/\D/g, "") === normalizedPhone));
    if (match && !duplicate) { setDuplicate(match); return; }
    void saveCustomer();
  };

  const saveCustomer = async () => {
    if (!user) return;
    const { data, error } = await db.from("customers").insert({
      user_id: user.id,
      team_id: destination === "personal" ? null : destination,
      name: newName.trim(),
      phone: newPhone.trim() || null,
      email: newEmail.trim() || null,
    }).select("id").single();
    if (error) return toast.error(error.message);
    toast.success(newName.trim() + " added to " + destinationName);
    setNewName(""); setNewPhone(""); setNewEmail(""); setDuplicate(null); setAdding(false);
    nav(`/c/${data.id}`);
  };

  const createFromVoice = async (result: ParsedResult): Promise<void> => {
    if (!user) return;
    const customer = result.customer;
    const name = customer?.name || result.transcript.trim();
    if (!name) return;
    const { data, error } = await db.from("customers").insert({
      user_id: user.id,
      team_id: destination === "personal" ? null : destination,
      name,
      phone: customer?.phone ?? null,
      email: customer?.email ?? null,
      designers: customer?.designers ?? [],
      looking_for: customer?.looking_for ?? [],
      shoe_size: customer?.shoe_size ?? null,
      width: customer?.width ?? null,
      typed_notes: customer?.notes ?? null,
    }).select("id").single();
    if (error) return toast.error(error.message);
    toast.success("Customer added to " + destinationName);
    nav(`/c/${data.id}`);
  };

  return (
    <main className="min-h-screen pb-24">
      <SEO title="Noted" description="Search and add customer records." path="/customers" />
      <header className="px-5 pt-8 pb-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="icon" onClick={() => nav("/")} aria-label="Back"><ArrowLeft className="h-5 w-5" /></Button>
          <div className="flex gap-1">
            <VoiceCapture context="customer" onCommit={createFromVoice} variant="outline" size="sm" title={"Add customer by voice to " + destinationName} />
            <Button size="sm" onClick={() => { setAdding((value) => !value); setDuplicate(null); }}><Plus className="h-4 w-4 mr-1" />Add customer</Button>
          </div>
        </div>
        <h1 className="font-serif text-3xl">Customers</h1>
        <p className="text-sm text-muted-foreground mt-1">{customers.length} accessible · {destinationName} selected for new customers</p>
      </header>

      <section className="px-5 max-w-2xl mx-auto space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-11" aria-label="Filter workspace"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All Workspaces</SelectItem><SelectItem value="personal">Personal</SelectItem>{workspaces.map((workspace) => <SelectItem key={workspace.id} value={workspace.id}>{workspace.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={destination} onValueChange={setDestination}>
            <SelectTrigger className="h-11" aria-label="New customer destination"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="personal">Add to Personal</SelectItem>{workspaces.map((workspace) => <SelectItem key={workspace.id} value={workspace.id}>Add to {workspace.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {adding && (
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Saving to</p>
            <p className="font-medium mt-1">{destinationName}</p>
            <form onSubmit={reviewAdd} className="space-y-3 mt-3">
              <Input autoFocus value={newName} onChange={(event) => { setNewName(event.target.value); setDuplicate(null); }} placeholder="Customer name *" />
              <Input value={newPhone} onChange={(event) => { setNewPhone(event.target.value); setDuplicate(null); }} placeholder="Phone" inputMode="tel" />
              <Input value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="Email" inputMode="email" />
              {duplicate && (
                <Card className="p-3 border-amber-500/50">
                  <p className="font-medium">Possible duplicate in {duplicate.workspace_name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{duplicate.name} · {duplicate.phone || duplicate.email || "No contact information"}</p>
                  <div className="grid grid-cols-2 gap-2 mt-3"><Button type="button" variant="outline" onClick={() => nav(`/c/${duplicate.id}`)}>Open existing</Button><Button type="button" onClick={saveCustomer}>Keep separate</Button></div>
                </Card>
              )}
              {!duplicate && <div className="grid grid-cols-2 gap-2"><Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button><Button type="submit">Review and save</Button></div>}
            </form>
          </Card>
        )}

        <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search name, phone, email, designer, or looking for" className="h-11 pl-9" /></div>
        <div className="flex items-center gap-2"><ArrowUpDown className="h-4 w-4 text-muted-foreground" /><Select value={sort} onValueChange={(value) => setSort(value as SortOption)}><SelectTrigger className="h-10 flex-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="updated_desc">Recently Updated</SelectItem><SelectItem value="customer_asc">Customers A–Z</SelectItem><SelectItem value="customer_desc">Customers Z–A</SelectItem></SelectContent></Select></div>
      </section>

      <section className="px-5 max-w-2xl mx-auto mt-4 space-y-2">
        {loading ? <p className="text-center text-muted-foreground py-12">Loading…</p> : results.length === 0 ? <p className="text-center text-muted-foreground py-12">{customers.length === 0 ? "No customers yet." : "No matches."}</p> : results.map((customer) => (
          <CustomerRow key={customer.id} c={customer} onOpen={() => nav(`/c/${customer.id}`)} onRename={async (name) => {
            const previous = customers;
            setCustomers((items) => items.map((item) => item.id === customer.id ? { ...item, name } : item));
            const { error } = await db.from("customers").update({ name }).eq("id", customer.id);
            if (error) { toast.error(error.message); setCustomers(previous); }
          }} />
        ))}
      </section>
    </main>
  );
}
