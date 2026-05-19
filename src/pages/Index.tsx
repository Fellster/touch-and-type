import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Settings, LogOut } from "lucide-react";
import { toast } from "sonner";
import SEO from "@/components/SEO";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  designers: string[];
  shoe_size: number | null;
  width: string | null;
  looking_for: string[];
  typed_notes: string | null;
  custom_data: Record<string, any>;
  updated_at: string;
};

type CustomField = { id: string; key: string; label: string; field_type: string };

export default function Index() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [drawingsText, setDrawingsText] = useState<Record<string, string>>({});
  const [fields, setFields] = useState<CustomField[]>([]);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState("name_asc");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [c, f, d] = await Promise.all([
      supabase.from("customers").select("*"),
      supabase.from("custom_fields").select("*").order("sort_order"),
      supabase.from("drawings").select("customer_id, ocr_text"),
    ]);
    if (c.error) toast.error(c.error.message);
    setCustomers((c.data ?? []) as Customer[]);
    setFields((f.data ?? []) as CustomField[]);
    const map: Record<string, string> = {};
    (d.data ?? []).forEach((r: any) => {
      if (r.ocr_text) map[r.customer_id] = (map[r.customer_id] ?? "") + " " + r.ocr_text;
    });
    setDrawingsText(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sortOptions = useMemo(() => {
    const base = [
      { v: "name_asc", l: "Name A–Z" },
      { v: "name_desc", l: "Name Z–A" },
      { v: "designer", l: "Designer" },
      { v: "size", l: "Shoe size" },
      { v: "looking", l: "Looking for" },
      { v: "updated", l: "Recently updated" },
    ];
    fields.forEach((f) => base.push({ v: `cf:${f.key}`, l: f.label }));
    return base;
  }, [fields]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = customers;
    if (needle) {
      list = list.filter((c) => {
        const blob = [
          c.name,
          c.phone ?? "",
          c.email ?? "",
          c.designers.join(" "),
          c.looking_for.join(" "),
          c.typed_notes ?? "",
          drawingsText[c.id] ?? "",
          JSON.stringify(c.custom_data ?? {}),
        ].join(" ").toLowerCase();
        return blob.includes(needle);
      });
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "name_desc": return b.name.localeCompare(a.name);
        case "designer": return (a.designers[0] ?? "").localeCompare(b.designers[0] ?? "");
        case "size": return (a.shoe_size ?? 0) - (b.shoe_size ?? 0);
        case "looking": return (a.looking_for[0] ?? "").localeCompare(b.looking_for[0] ?? "");
        case "updated": return b.updated_at.localeCompare(a.updated_at);
        default:
          if (sortBy.startsWith("cf:")) {
            const k = sortBy.slice(3);
            const av = String(a.custom_data?.[k] ?? "");
            const bv = String(b.custom_data?.[k] ?? "");
            const an = Number(av), bn = Number(bv);
            if (!isNaN(an) && !isNaN(bn) && av !== "" && bv !== "") return an - bn;
            return av.localeCompare(bv);
          }
          return a.name.localeCompare(b.name);
      }
    });
    return sorted;
  }, [customers, q, sortBy, drawingsText]);

  const newCustomer = async () => {
    const { data, error } = await supabase
      .from("customers")
      .insert({ user_id: user!.id, name: "New customer" })
      .select().single();
    if (error) return toast.error(error.message);
    nav(`/c/${data!.id}`);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    nav("/auth");
  };

  return (
    <main className="min-h-screen pb-24">
      <SEO
        title="Atelier — Private Customer Notebook"
        description="Search and manage your women's footwear customer notes — designers, sizes, wishlists, photos, and handwriting."
        path="/"
      />
      <header className="px-5 pt-8 pb-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-4xl font-serif">Atelier — Customer Notebook</h1>
            <img src="/favicon.png" alt="Atelier logo" className="h-10 w-10 object-contain shrink-0" />
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => nav("/fields")} aria-label="Manage custom fields">
              <Settings className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{customers.length} customers</p>
      </header>

      <section className="px-5 max-w-3xl mx-auto space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            id="customer-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone, designer, notes…"
            aria-label="Search customers"
            className="pl-9 h-11"
          />
        </div>
        <div className="flex gap-2">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="flex-1" aria-label="Sort customers"><SelectValue /></SelectTrigger>
            <SelectContent>
              {sortOptions.map((o) => <SelectItem key={o.v} value={o.v}>{o.l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={newCustomer}><Plus className="h-4 w-4 mr-1" />New</Button>
        </div>
      </section>

      <section className="px-5 max-w-3xl mx-auto mt-5 space-y-2">
        {loading ? (
          <p className="text-center text-muted-foreground py-12">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            {customers.length === 0 ? "Tap New to add your first customer." : "No matches."}
          </p>
        ) : filtered.map((c) => (
          <Link key={c.id} to={`/c/${c.id}`}>
            <Card className="p-4 hover:bg-secondary/40 transition cursor-pointer">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <h2 className="font-serif text-xl truncate">{c.name || "Untitled"}</h2>
                  <p className="text-sm text-muted-foreground truncate">
                    {[c.designers.join(", "), c.shoe_size ? `Size ${c.shoe_size}` : null].filter(Boolean).join(" · ")}
                  </p>
                  {c.looking_for.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      Looking for: {c.looking_for.join(", ")}
                    </p>
                  )}
                </div>
                {c.phone && <span className="text-xs text-muted-foreground whitespace-nowrap">{c.phone}</span>}
              </div>
            </Card>
          </Link>
        ))}
      </section>
    </main>
  );
}
