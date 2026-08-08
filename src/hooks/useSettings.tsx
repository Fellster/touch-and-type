import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type AccentKey = "black" | "blue" | "green" | "red";
export type AccentSetting = AccentKey | "theme";

export const ACCENTS: Record<AccentKey, { label: string; swatch: string; vars: Record<string, string> }> = {
  black: {
    label: "Black highlights",
    swatch: "25 15% 12%",
    vars: {
      "--primary": "25 15% 12%",
      "--primary-foreground": "36 33% 97%",
      "--ring": "25 15% 12%",
      "--accent": "30 8% 86%",
      "--accent-foreground": "25 20% 18%",
    },
  },
  blue: {
    label: "Blue highlights",
    swatch: "215 75% 42%",
    vars: {
      "--primary": "215 75% 42%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "215 75% 42%",
      "--accent": "215 60% 90%",
      "--accent-foreground": "215 60% 22%",
    },
  },
  green: {
    label: "Green highlights",
    swatch: "150 55% 32%",
    vars: {
      "--primary": "150 55% 32%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "150 55% 32%",
      "--accent": "150 40% 88%",
      "--accent-foreground": "150 45% 18%",
    },
  },
  red: {
    label: "Red highlights",
    swatch: "0 65% 45%",
    vars: {
      "--primary": "0 65% 45%",
      "--primary-foreground": "0 0% 100%",
      "--ring": "0 65% 45%",
      "--accent": "0 55% 92%",
      "--accent-foreground": "0 50% 25%",
    },
  },
};

export type ThemeKey = "warm" | "classic" | "midnight" | "noir" | "paper" | "sage";

type Theme = {
  label: string;
  description: string;
  dark: boolean;
  vars: Record<string, string>;
};

const sidebarFrom = (v: Record<string, string>) => ({
  "--sidebar-background": v["--background"],
  "--sidebar-foreground": v["--foreground"],
  "--sidebar-primary": v["--primary"],
  "--sidebar-primary-foreground": v["--primary-foreground"],
  "--sidebar-accent": v["--secondary"],
  "--sidebar-accent-foreground": v["--secondary-foreground"],
  "--sidebar-border": v["--border"],
  "--sidebar-ring": v["--ring"],
});

const theme = (label: string, description: string, dark: boolean, vars: Record<string, string>): Theme => ({
  label,
  description,
  dark,
  vars: { ...vars, ...sidebarFrom(vars) },
});

export const THEMES: Record<ThemeKey, Theme> = {
  warm: theme("Warm Boutique", "Cream and taupe with serif headings", false, {
    "--background": "36 33% 97%",
    "--foreground": "25 20% 18%",
    "--card": "36 30% 99%",
    "--card-foreground": "25 20% 18%",
    "--popover": "36 30% 99%",
    "--popover-foreground": "25 20% 18%",
    "--primary": "28 22% 36%",
    "--primary-foreground": "36 33% 97%",
    "--secondary": "34 25% 90%",
    "--secondary-foreground": "25 20% 18%",
    "--muted": "34 22% 92%",
    "--muted-foreground": "28 12% 42%",
    "--accent": "32 30% 78%",
    "--accent-foreground": "25 20% 18%",
    "--destructive": "0 60% 45%",
    "--destructive-foreground": "36 33% 97%",
    "--border": "32 20% 86%",
    "--input": "32 20% 86%",
    "--ring": "28 22% 36%",
    "--radius": "0.75rem",
    "--font-sans": "'Inter', system-ui, sans-serif",
    "--font-serif": "'Cormorant Garamond', Georgia, serif",
  }),
  classic: theme("Classic Light", "Crisp white with a clean blue accent", false, {
    "--background": "210 40% 99%",
    "--foreground": "222 30% 16%",
    "--card": "0 0% 100%",
    "--card-foreground": "222 30% 16%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "222 30% 16%",
    "--primary": "215 80% 45%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "213 30% 94%",
    "--secondary-foreground": "222 30% 20%",
    "--muted": "213 30% 95%",
    "--muted-foreground": "215 16% 45%",
    "--accent": "213 45% 92%",
    "--accent-foreground": "215 45% 25%",
    "--destructive": "0 72% 48%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "214 25% 89%",
    "--input": "214 25% 89%",
    "--ring": "215 80% 45%",
    "--radius": "0.6rem",
    "--font-sans": "'DM Sans', system-ui, sans-serif",
    "--font-serif": "'Space Grotesk', system-ui, sans-serif",
  }),
  midnight: theme("Midnight", "Deep charcoal-navy with soft light text", true, {
    "--background": "222 32% 10%",
    "--foreground": "213 30% 93%",
    "--card": "222 28% 13%",
    "--card-foreground": "213 30% 93%",
    "--popover": "222 28% 13%",
    "--popover-foreground": "213 30% 93%",
    "--primary": "205 90% 60%",
    "--primary-foreground": "222 40% 10%",
    "--secondary": "222 22% 18%",
    "--secondary-foreground": "213 30% 93%",
    "--muted": "222 22% 18%",
    "--muted-foreground": "215 18% 65%",
    "--accent": "222 24% 22%",
    "--accent-foreground": "205 80% 80%",
    "--destructive": "0 65% 52%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "222 20% 22%",
    "--input": "222 20% 22%",
    "--ring": "205 90% 60%",
    "--radius": "0.75rem",
    "--font-sans": "'Manrope', system-ui, sans-serif",
    "--font-serif": "'Space Grotesk', system-ui, sans-serif",
  }),
  noir: theme("Noir & Gold", "Near-black with editorial gold", true, {
    "--background": "0 0% 6%",
    "--foreground": "42 30% 92%",
    "--card": "0 0% 9%",
    "--card-foreground": "42 30% 92%",
    "--popover": "0 0% 9%",
    "--popover-foreground": "42 30% 92%",
    "--primary": "43 55% 55%",
    "--primary-foreground": "0 0% 8%",
    "--secondary": "0 0% 14%",
    "--secondary-foreground": "42 30% 92%",
    "--muted": "0 0% 14%",
    "--muted-foreground": "42 12% 66%",
    "--accent": "43 30% 20%",
    "--accent-foreground": "43 60% 78%",
    "--destructive": "0 62% 48%",
    "--destructive-foreground": "0 0% 100%",
    "--border": "0 0% 18%",
    "--input": "0 0% 18%",
    "--ring": "43 55% 55%",
    "--radius": "0.35rem",
    "--font-sans": "'Inter', system-ui, sans-serif",
    "--font-serif": "'Playfair Display', Georgia, serif",
  }),
  paper: theme("Paper & Ink", "Off-white, rich black, Swiss minimal", false, {
    "--background": "42 22% 96%",
    "--foreground": "0 0% 8%",
    "--card": "40 25% 98%",
    "--card-foreground": "0 0% 8%",
    "--popover": "40 25% 98%",
    "--popover-foreground": "0 0% 8%",
    "--primary": "0 0% 10%",
    "--primary-foreground": "42 22% 96%",
    "--secondary": "40 15% 90%",
    "--secondary-foreground": "0 0% 10%",
    "--muted": "40 15% 91%",
    "--muted-foreground": "0 0% 40%",
    "--accent": "40 12% 86%",
    "--accent-foreground": "0 0% 12%",
    "--destructive": "8 70% 42%",
    "--destructive-foreground": "42 22% 96%",
    "--border": "38 12% 84%",
    "--input": "38 12% 84%",
    "--ring": "0 0% 10%",
    "--radius": "0.25rem",
    "--font-sans": "'Inter', system-ui, sans-serif",
    "--font-serif": "'Space Grotesk', system-ui, sans-serif",
  }),
  sage: theme("Sage Calm", "Muted greens with soft rounded edges", false, {
    "--background": "60 22% 96%",
    "--foreground": "150 20% 16%",
    "--card": "60 28% 99%",
    "--card-foreground": "150 20% 16%",
    "--popover": "60 28% 99%",
    "--popover-foreground": "150 20% 16%",
    "--primary": "150 30% 34%",
    "--primary-foreground": "60 30% 97%",
    "--secondary": "110 18% 90%",
    "--secondary-foreground": "150 20% 18%",
    "--muted": "110 16% 92%",
    "--muted-foreground": "150 10% 42%",
    "--accent": "120 22% 85%",
    "--accent-foreground": "150 25% 20%",
    "--destructive": "5 58% 46%",
    "--destructive-foreground": "60 30% 97%",
    "--border": "110 14% 85%",
    "--input": "110 14% 85%",
    "--ring": "150 30% 34%",
    "--radius": "1rem",
    "--font-sans": "'Manrope', system-ui, sans-serif",
    "--font-serif": "'Cormorant Garamond', Georgia, serif",
  }),
};

export type FieldKey = "designers" | "shoe_size" | "width" | "looking_for";

export const DEFAULT_LABELS: Record<FieldKey, string> = {
  designers: "Designers",
  shoe_size: "Shoe size",
  width: "Width",
  looking_for: "Wants",
};

type Settings = { theme: ThemeKey; accent: AccentSetting; labels: Record<FieldKey, string> };

const STORAGE_KEY = "noted.settings.v1";

function read(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        theme: (p.theme in THEMES ? p.theme : "warm") as ThemeKey,
        accent: (p.accent === "theme" || p.accent in ACCENTS ? p.accent : "black") as AccentSetting,
        labels: { ...DEFAULT_LABELS, ...(p.labels ?? {}) },
      };
    }
  } catch {
    /* ignore */
  }
  return { theme: "warm", accent: "black", labels: { ...DEFAULT_LABELS } };
}

export function applyAccent(accent: AccentKey) {
  const root = document.documentElement;
  Object.entries(ACCENTS[accent].vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

export function applyTheme(themeKey: ThemeKey, accent: AccentSetting) {
  const root = document.documentElement;
  const t = THEMES[themeKey];
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  if (accent !== "theme") applyAccent(accent);
  root.classList.toggle("dark", t.dark);
}

type Ctx = Settings & {
  setTheme: (t: ThemeKey) => void;
  setAccent: (a: AccentSetting) => void;
  setLabel: (k: FieldKey, v: string) => void;
  resetLabels: () => void;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => read());

  useEffect(() => {
    applyTheme(settings.theme, settings.accent);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const value: Ctx = {
    ...settings,
    setTheme: (theme) => setSettings((s) => ({ ...s, theme })),
    setAccent: (accent) => setSettings((s) => ({ ...s, accent })),
    setLabel: (k, v) => setSettings((s) => ({ ...s, labels: { ...s.labels, [k]: v } })),
    resetLabels: () => setSettings((s) => ({ ...s, labels: { ...DEFAULT_LABELS } })),
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

export function useLabels() {
  return useSettings().labels;
}
