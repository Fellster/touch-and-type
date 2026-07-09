import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Pencil, Camera, Sparkles, Lock } from "lucide-react";
import SEO from "@/components/SEO";

type SampleCustomer = {
  id: string;
  name: string;
  designers: string[];
  shoe_size: number;
  width: string;
  looking_for: string[];
  notes: string;
  drawing: string; // inline SVG data
};

const SAMPLES: SampleCustomer[] = [
  {
    id: "sample-1",
    name: "A. Laurent",
    designers: ["Manolo Blahnik", "Aquazzura"],
    shoe_size: 37.5,
    width: "Narrow",
    looking_for: ["Ivory satin pump", "Ankle strap"],
    notes: "Prefers a 90mm heel. Allergic to nickel buckles. Wedding in June.",
    drawing: "pump",
  },
  {
    id: "sample-2",
    name: "M. Okafor",
    designers: ["Jimmy Choo", "Gianvito Rossi"],
    shoe_size: 39,
    width: "Medium",
    looking_for: ["Block heel sandal", "Metallic"],
    notes: "Loves warm gold tones. Comfortable for long evenings.",
    drawing: "sandal",
  },
  {
    id: "sample-3",
    name: "S. Yamamoto",
    designers: ["Chanel", "Roger Vivier"],
    shoe_size: 36,
    width: "Medium",
    looking_for: ["Ballet flat", "Cap toe"],
    notes: "Two-tone cap toe, small bow. Size up half for suede.",
    drawing: "flat",
  },
  {
    id: "sample-4",
    name: "E. Rossi",
    designers: ["Alaïa", "The Row"],
    shoe_size: 38,
    width: "Wide",
    looking_for: ["Knee boot", "Almond toe"],
    notes: "Autumn order. Prefers vegetable-tanned leather.",
    drawing: "boot",
  },
];

function SampleDrawing({ kind }: { kind: string }) {
  const stroke = "hsl(var(--foreground))";
  const common = { fill: "none", stroke, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 160 100" className="w-full h-24 bg-white rounded-md border" aria-hidden="true">
      {kind === "pump" && (
        <g {...common}>
          <path d="M20 75 Q40 72 70 70 Q110 68 135 55 Q140 52 138 60 L128 78 Q120 82 90 82 Q45 82 22 80 Z" />
          <path d="M135 55 L138 30 Q139 20 132 22 L128 34" />
          <path d="M40 82 L42 90" /><path d="M115 82 L118 90" />
        </g>
      )}
      {kind === "sandal" && (
        <g {...common}>
          <path d="M25 78 Q80 74 130 72" />
          <path d="M28 82 Q80 80 130 78" />
          <path d="M55 74 L48 55 L70 55" />
          <path d="M95 73 L88 55 L108 55" />
          <path d="M130 72 L138 62 L138 80 Z" />
        </g>
      )}
      {kind === "flat" && (
        <g {...common}>
          <path d="M25 72 Q60 68 105 68 Q135 68 140 76 Q140 82 120 84 Q70 86 30 82 Z" />
          <path d="M105 68 Q108 74 115 76" />
        </g>
      )}
      {kind === "boot" && (
        <g {...common}>
          <path d="M40 82 L40 25 L70 25 L70 68 Q90 68 120 68 Q135 68 138 78 Q138 84 118 86 Q60 88 40 84 Z" />
          <path d="M40 40 L70 40" />
        </g>
      )}
    </svg>
  );
}

export default function Preview() {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return SAMPLES;
    return SAMPLES.filter((c) =>
      [c.name, c.designers.join(" "), c.looking_for.join(" "), c.notes, c.width, String(c.shoe_size)]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [q]);

  return (
    <main className="min-h-screen pb-24">
      <SEO
        title="Atelier — Preview the Customer Notebook for Boutiques"
        description="See how Atelier tracks women's footwear clients: designers, sizes, wishlists, drawings, and searchable notes. Public preview with sample data."
        path="/preview"
      />

      <header className="px-5 pt-10 pb-6 max-w-3xl mx-auto text-center">
        <img src="/favicon.png" alt="Atelier logo" className="h-24 w-24 object-contain mx-auto mb-4" />
        <h1 className="font-serif text-4xl mb-3">A private notebook for footwear boutiques</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Atelier helps sales associates remember every client: preferred designers, exact sizes, wishlists, sketches
          from the fitting room, and handwritten notes — all searchable in seconds.
        </p>
        <div className="flex gap-2 justify-center mt-5">
          <Button asChild><Link to="/auth">Sign in</Link></Button>
          <Button asChild variant="outline"><Link to="/auth">Create an account</Link></Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1">
          <Lock className="h-3 w-3" /> Sample data below — no real customer information is shown.
        </p>
      </header>

      <section className="px-5 max-w-3xl mx-auto grid sm:grid-cols-3 gap-3 mb-8">
        <Card className="p-4">
          <Pencil className="h-5 w-5 mb-2" />
          <h2 className="font-serif text-lg mb-1">Sketch on the spot</h2>
          <p className="text-sm text-muted-foreground">Draw the shoe your client asked for while they describe it.</p>
        </Card>
        <Card className="p-4">
          <Camera className="h-5 w-5 mb-2" />
          <h2 className="font-serif text-lg mb-1">Snap reference photos</h2>
          <p className="text-sm text-muted-foreground">Attach photos of the pair they loved, or the outfit it must match.</p>
        </Card>
        <Card className="p-4">
          <Sparkles className="h-5 w-5 mb-2" />
          <h2 className="font-serif text-lg mb-1">Transcribe handwriting</h2>
          <p className="text-sm text-muted-foreground">Scribbled notes and sketches become searchable text automatically.</p>
        </Card>
      </section>

      <section className="px-5 max-w-3xl mx-auto space-y-3">
        <h2 className="font-serif text-2xl">Try the search</h2>
        <p className="text-sm text-muted-foreground">
          Search by designer, size, style, or anything in the notes — try "Manolo", "size 38", or "boot".
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search sample customers…"
            aria-label="Search sample customers"
            className="pl-9 h-11"
          />
        </div>

        <div className="space-y-3 mt-2">
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No matches in the sample set.</p>
          ) : (
            filtered.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex gap-4">
                  <div className="w-40 shrink-0 hidden sm:block">
                    <SampleDrawing kind={c.drawing} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between items-start gap-3">
                      <h3 className="font-serif text-xl">{c.name}</h3>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        Size {c.shoe_size} · {c.width}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {c.designers.join(", ")}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.looking_for.map((l) => (
                        <Badge key={l} variant="secondary">{l}</Badge>
                      ))}
                    </div>
                    <p className="text-sm mt-2">{c.notes}</p>
                    <div className="sm:hidden mt-3">
                      <SampleDrawing kind={c.drawing} />
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </section>

      <section className="px-5 max-w-3xl mx-auto mt-12 text-center">
        <h2 className="font-serif text-2xl mb-2">Ready to keep your own notebook?</h2>
        <p className="text-muted-foreground mb-4">Your data stays private to your account — no client information is ever shared.</p>
        <Button asChild size="lg"><Link to="/auth">Get started</Link></Button>
      </section>
    </main>
  );
}
