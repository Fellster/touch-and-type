import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import SEO from "@/components/SEO";
import { ACCENTS, DEFAULT_LABELS, useSettings, type AccentKey, type FieldKey } from "@/hooks/useSettings";

const FIELD_KEYS = Object.keys(DEFAULT_LABELS) as FieldKey[];

export default function Settings() {
  const nav = useNavigate();
  const { accent, labels, setAccent, setLabel, resetLabels } = useSettings();

  return (
    <main className="min-h-screen bg-background pb-24">
      <SEO
        title="Settings — Noted"
        description="Change highlight colors and rename the customer fields to match how you work."
        path="/settings"
      />
      <header className="px-5 pt-6 max-w-2xl mx-auto flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav("/")} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-serif text-2xl">Settings</h1>
      </header>

      <section className="px-5 max-w-2xl mx-auto mt-6">
        <h2 className="font-serif text-xl mb-1">Highlight color</h2>
        <p className="text-sm text-muted-foreground mb-3">Used for buttons, links and selections.</p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(ACCENTS) as AccentKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setAccent(k)}
              aria-pressed={accent === k}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${
                accent === k ? "border-primary bg-accent" : "border-border hover:bg-muted"
              }`}
            >
              <span
                className="h-6 w-6 rounded-full border border-border shrink-0"
                style={{ background: `hsl(${ACCENTS[k].swatch})` }}
              />
              <span className="flex-1">{ACCENTS[k].label}</span>
              {accent === k && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      </section>

      <section className="px-5 max-w-2xl mx-auto mt-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-serif text-xl">Field names</h2>
          <Button variant="ghost" size="sm" onClick={resetLabels}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Rename the built-in customer fields to anything you like. Saved data is kept.
        </p>
        <Card className="p-4 space-y-3">
          {FIELD_KEYS.map((k) => (
            <div key={k}>
              <Label htmlFor={`field-${k}`} className="text-xs text-muted-foreground">
                Default: {DEFAULT_LABELS[k]}
              </Label>
              <Input
                id={`field-${k}`}
                value={labels[k]}
                maxLength={40}
                placeholder={DEFAULT_LABELS[k]}
                onChange={(e) => setLabel(k, e.target.value)}
              />
            </div>
          ))}
        </Card>
        <p className="text-xs text-muted-foreground mt-3">
          Need more than these? Add your own on the{" "}
          <button className="underline" onClick={() => nav("/fields")}>
            custom fields
          </button>{" "}
          page.
        </p>
      </section>
    </main>
  );
}
