import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, LogOut, RotateCcw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import SEO from "@/components/SEO";
import { useAuth } from "@/hooks/useAuth";
import {
  ACCENTS,
  DEFAULT_LABELS,
  THEMES,
  useSettings,
  type AccentKey,
  type FieldKey,
  type ThemeKey,
} from "@/hooks/useSettings";

const FIELD_KEYS = Object.keys(DEFAULT_LABELS) as FieldKey[];

export default function Settings() {
  const nav = useNavigate();
  const { signOut } = useAuth();
  const { theme, accent, labels, setTheme, setAccent, setLabel, resetLabels } = useSettings();

  const handleSignOut = async () => {
    await signOut();
    nav("/auth");
  };

  const handleShare = async () => {
    const shareData = {
      title: "Noted",
      text: "Try Noted for keeping track of customers.",
      url: "https://touch-and-type.lovable.app",
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          toast.error("Could not open share sheet.");
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareData.url);
        toast.success("Link copied to clipboard");
      } catch {
        toast.error("Could not copy link.");
      }
    }
  };

  return (
    <main className="min-h-screen bg-background pb-24">
      <SEO
        title="Settings — Noted"
        description="Choose a theme, change highlight colors and rename the customer fields to match how you work."
        path="/settings"
      />
      <header className="px-5 pt-6 max-w-2xl mx-auto flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => nav("/")} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="font-serif text-2xl">Settings</h1>
      </header>

      <section className="px-5 max-w-2xl mx-auto mt-6">
        <h2 className="font-serif text-xl mb-1">Theme</h2>
        <p className="text-sm text-muted-foreground mb-3">Changes the overall look — colors, corners and fonts.</p>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(THEMES) as ThemeKey[]).map((k) => {
            const t = THEMES[k];
            const active = theme === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTheme(k)}
                aria-pressed={active}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  active ? "border-primary bg-accent" : "border-border hover:bg-muted"
                }`}
              >
                <div className="flex gap-1 mb-2">
                  {["--background", "--card", "--foreground", "--primary"].map((v) => (
                    <span
                      key={v}
                      className="h-6 flex-1 rounded border border-border"
                      style={{ background: `hsl(${t.vars[v]})` }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium flex-1">{t.label}</span>
                  {active && <Check className="h-4 w-4 text-primary shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="px-5 max-w-2xl mx-auto mt-8">
        <h2 className="font-serif text-xl mb-1">Highlight color</h2>
        <p className="text-sm text-muted-foreground mb-3">Used for buttons, links and selections.</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setAccent("theme")}
            aria-pressed={accent === "theme"}
            className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors col-span-2 ${
              accent === "theme" ? "border-primary bg-accent" : "border-border hover:bg-muted"
            }`}
          >
            <span
              className="h-6 w-6 rounded-full border border-border shrink-0"
              style={{ background: `hsl(${THEMES[theme].vars["--primary"]})` }}
            />
            <span className="flex-1">Use theme's own accent</span>
            {accent === "theme" && <Check className="h-4 w-4 text-primary" />}
          </button>
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

      <section className="px-5 max-w-2xl mx-auto mt-10">
        <h2 className="font-serif text-xl mb-1">Share Noted</h2>
        <p className="text-sm text-muted-foreground mb-3">Send a copy of Noted to someone else.</p>
        <Button variant="outline" className="w-full" onClick={handleShare}>
          <Share2 className="h-4 w-4 mr-2" />
          Send a link
        </Button>
      </section>

      <section className="px-5 max-w-2xl mx-auto mt-10">
        <h2 className="font-serif text-xl mb-1">Account</h2>
        <p className="text-sm text-muted-foreground mb-3">Sign out of Noted on this device.</p>
        <Button variant="outline" className="w-full" onClick={handleSignOut}>
          <LogOut className="h-4 w-4 mr-2" />
          Log out
        </Button>
      </section>
    </main>
  );
}
