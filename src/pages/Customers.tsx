import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus, Search, User } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  updated_at: string;
};

export default function Customers() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("customers")
      .select("id,name,phone,email,updated_at")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    setCustomers((data ?? []) as Customer[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        (c.phone ?? "").toLowerCase().includes(s) ||
        (c.email ?? "").toLowerCase().includes(s),
    );
  }, [customers, q]);

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
            placeholder="Search by name, phone, or email"
            className="h-11 pl-9"
            aria-label="Search customers"
          />
        </div>
      </section>

      <section className="px-5 max-w-2xl mx-auto mt-4 space-y-2">
        {loading ? (
          <p className="text-center text-muted-foreground py-12">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            {customers.length === 0 ? "No customers yet." : "No matches."}
          </p>
        ) : (
          filtered.map((c) => (
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
                  {c.phone || c.email || "—"}
                </div>
              </div>
            </Card>
          ))
        )}
      </section>
    </main>
  );
}
