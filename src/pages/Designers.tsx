import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Search, Tag } from "lucide-react";
import SEO from "@/components/SEO";
import { useLabels } from "@/hooks/useSettings";

type Customer = {
  id: string;
  name: string;
  designers: string[];
  shoe_size: number | null;
  looking_for: string[];
};

export default function Designers() {
  const labels = useLabels();
  const { user } = useAuth();
  const nav = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("customers")
        .select("id,name,designers,shoe_size,looking_for")
        .order("name", { ascending: true });
      setCustomers((data as Customer[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const groups = useMemo(() => {
    const map = new Map<string, Customer[]>();
    for (const c of customers) {
      for (const d of c.designers ?? []) {
        const key = d.trim();
        if (!key) continue;
        const arr = map.get(key) ?? [];
        arr.push(c);
        map.set(key, arr);
      }
    }
    const term = q.trim().toLowerCase();
    return Array.from(map.entries())
      .filter(([d, list]) =>
        !term ||
        d.toLowerCase().includes(term) ||
        list.some((c) => c.name.toLowerCase().includes(term)),
      )
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [customers, q]);

  return (
    <main className="min-h-screen bg-background pb-24">
      <SEO
        title="Designers — Noted"
        description="Browse every designer your customers are interested in."
        path="/designers"
      />
      <header className="px-5 pt-6 max-w-2xl mx-auto flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav("/")} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-serif text-2xl">{labels.designers}</h1>
      </header>

      <section className="px-5 max-w-2xl mx-auto mt-4">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search designers…"
            aria-label="Search designers"
            className="pl-9 h-11"
          />
        </div>
      </section>

      <section className="px-5 max-w-2xl mx-auto mt-6 space-y-4">
        {loading ? (
          <p className="text-center text-muted-foreground py-12">Loading…</p>
        ) : groups.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            No designers yet. Add designers on a customer page.
          </p>
        ) : (
          groups.map(([designer, list]) => (
            <Card key={designer} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-serif text-lg">{designer}</h2>
                <span className="text-xs text-muted-foreground ml-auto">
                  {list.length} {list.length === 1 ? "customer" : "customers"}
                </span>
              </div>
              <ul className="space-y-1">
                {list.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => nav(`/c/${c.id}`)}
                      className="text-left w-full py-1 hover:underline"
                    >
                      <span className="text-foreground">{c.name}</span>
                      {(c.shoe_size || (c.looking_for?.length ?? 0) > 0) && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {[
                            c.shoe_size ? `Size ${c.shoe_size}` : null,
                            c.looking_for?.length ? c.looking_for.join(", ") : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ))
        )}
      </section>
    </main>
  );
}
