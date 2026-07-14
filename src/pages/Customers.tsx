import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ArrowUpDown, Plus, Search, User } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";

type SortOption =
  | "updated_desc"
  | "designer_asc"
  | "designer_desc"
  | "shoe_size_asc"
  | "shoe_size_desc";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  designers: string[];
  looking_for: string[];
  shoe_size: number | null;
  updated_at: string;
};

export default function Customers() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortOption>("updated_desc");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(sp.get("add") === "1");
  const [newName, setNewName] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("id,name,phone,email,designers,looking_for,shoe_size,updated_at")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setCustomers((data ?? []) as Customer[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s
      ? customers.filter((c) =>
          [
            c.name,
            c.phone ?? "",
            c.email ?? "",
            (c.designers ?? []).join(" "),
            (c.looking_for ?? []).join(" "),
          ]
            .join(" ")
            .toLowerCase()
            .includes(s),
        )
      : [...customers];

    const firstDesigner = (c: Customer) => (c.designers?.[0] ?? "").toLowerCase();

    switch (sort) {
      case "designer_asc":
        list.sort((a, b) => firstDesigner(a).localeCompare(firstDesigner(b)) || a.name.localeCompare(b.name));
        break;
      case "designer_desc":
        list.sort((a, b) => firstDesigner(b).localeCompare(firstDesigner(a)) || a.name.localeCompare(b.name));
        break;
      case "shoe_size_asc":
        list.sort((a, b) => (a.shoe_size ?? Infinity) - (b.shoe_size ?? Infinity) || a.name.localeCompare(b.name));
        break;
      case "shoe_size_desc":
        list.sort((a, b) => (b.shoe_size ?? -Infinity) - (a.shoe_size ?? -Infinity) || a.name.localeCompare(b.name));
        break;
      case "updated_desc":
      default:
        list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
    }
    return list;
  }, [customers, q, sort]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !user) return;
    const { data, error } = await supabase
      .from("customers")
      .insert({ user_id: user.id, name: newName.trim() })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    setNewName("");
    setAdding(false);
    nav(`/c/${data.id}`);
  };

  return (
    <main className="min-h-screen pb-24">
      <SEO title="Customers — Atelier" description="Search and add customer records." path="/customers" />
      <header className="px-5 pt-8 pb-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <Button variant="ghost" size="icon" onClick={() => nav("/")} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Button size="sm" onClick={() => setAdding((v) => !v)}>
            <Plus className="h-4 w-4 mr-1" />
            Add customer
          </Button>
        </div>
        <h1 className="font-serif text-3xl">Customers</h1>
        <p className="text-sm text-muted-foreground mt-1">{customers.length} total</p>
      </header>

      <section className="px-5 max-w-2xl mx-auto space-y-3">
        {adding && (
          <form onSubmit={add} className="flex gap-2">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Customer name"
              className="h-11"
              aria-label="New customer name"
            />
            <Button type="submit" className="h-11">Create</Button>
          </form>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone, email, designer, or looking for"
            className="h-11 pl-9"
            aria-label="Search customers"
          />
        </div>
      </section>

      <section className="px-5 max-w-2xl mx-auto mt-4 space-y-2">
        {loading ? (
          <p className="text-center text-muted-foreground py-12">Loading…</p>
        ) : results.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            {customers.length === 0 ? "No customers yet." : "No matches."}
          </p>
        ) : (
          results.map((c) => (
            <Card
              key={c.id}
              onClick={() => nav(`/c/${c.id}`)}
              className="p-3 flex items-center gap-3 cursor-pointer hover:bg-accent transition-colors"
            >
              <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{c.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {[
                    c.designers?.length ? c.designers.join(" · ") : null,
                    c.looking_for?.length ? `Looking for: ${c.looking_for.join(" · ")}` : null,
                    c.shoe_size ? `Size ${c.shoe_size}` : null,
                    c.phone || c.email || "—",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
            </Card>
          ))
        )}
      </section>
    </main>
  );
}
