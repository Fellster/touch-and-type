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

export type ThemeKey = "warm" | "paper" | "cubs" | "bears" | "yankees";

type Theme = {
  label: string;
  description: string;
  dark: boolean;
  vars: Record<string, string>;
};

export type FontKey = "inter" | "lora" | "manrope" | "kalam";

export const FONTS: Record<FontKey, { label: string; description: string; stack: string }> = {
  inter: { label: "Inter", description: "Clear and easy to read", stack: "'Inter', system-ui, sans-serif" },
  lora: { label: "Lora", description: "Classic and highly readable", stack: "'Lora', Georgia, serif" },
  manrope: { label: "Manrope", description: "Clean and contemporary", stack: "'Manrope', system-ui, sans-serif" },
  kalam: { label: "Kalam", description: "Handwritten but easy to read", stack: "'Kalam', 'Comic Sans MS', cursive" },
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
  label, description, dark, vars: { ...vars, ...sidebarFrom(vars) },
});

export const THEMES: Record<ThemeKey, Theme> = {
  warm: theme("Warm Boutique", "Cream and taupe", false, {
    "--background": "36 33% 97%", "--foreground": "25 20% 18%",
    "--card": "36 30% 99%", "--card-foreground": "25 20% 18%",
    "--popover": "36 30% 99%", "--popover-foreground": "25 20% 18%",
    "--primary": "28 22% 36%", "--primary-foreground": "36 33% 97%",
    "--secondary": "34 25% 90%", "--secondary-foreground": "25 20% 18%",
    "--muted": "34 22% 92%", "--muted-foreground": "28 12% 42%",
    "--accent": "32 30% 78%", "--accent-foreground": "25 20% 18%",
    "--destructive": "0 60% 45%", "--destructive-foreground": "36 33% 97%",
    "--border": "32 20% 86%", "--input": "32 20% 86%", "--ring": "28 22% 36%",
    "--radius": "0.75rem",
  }),
  paper: theme("Paper & Ink", "Simple and neutral", false, {
    "--background": "42 22% 96%", "--foreground": "0 0% 8%",
    "--card": "40 25% 98%", "--card-foreground": "0 0% 8%",
    "--popover": "40 25% 98%", "--popover-foreground": "0 0% 8%",
    "--primary": "0 0% 10%", "--primary-foreground": "42 22% 96%",
    "--secondary": "40 15% 90%", "--secondary-foreground": "0 0% 10%",
    "--muted": "40 15% 91%", "--muted-foreground": "0 0% 40%",
    "--accent": "40 12% 86%", "--accent-foreground": "0 0% 12%",
    "--destructive": "8 70% 42%", "--destructive-foreground": "42 22% 96%",
    "--border": "38 12% 84%", "--input": "38 12% 84%", "--ring": "0 0% 10%",
    "--radius": "0.25rem",
  }),
  cubs: theme("Chicago Cubs", "White with blue pinstripes and red", false, {
    "--background": "0 0% 100%", "--foreground": "221 55% 20%",
    "--card": "0 0% 100%", "--card-foreground": "221 55% 20%",
    "--popover": "0 0% 100%", "--popover-foreground": "221 55% 20%",
    "--primary": "221 81% 29%", "--primary-foreground": "0 0% 100%",
    "--secondary": "0 55% 94%", "--secondary-foreground": "221 81% 29%",
    "--muted": "220 35% 95%", "--muted-foreground": "220 18% 40%",
    "--accent": "220 55% 92%", "--accent-foreground": "221 65% 25%",
    "--destructive": "0 60% 50%", "--destructive-foreground": "0 0% 100%",
    "--border": "220 30% 84%", "--input": "220 30% 84%", "--ring": "221 81% 29%",
    "--radius": "0.75rem",
  }),
  bears: theme("Chicago Bears", "Deep navy and orange", true, {
    "--background": "218 59% 10%", "--foreground": "40 33% 95%",
    "--card": "216 45% 16%", "--card-foreground": "40 33% 95%",
    "--popover": "216 45% 16%", "--popover-foreground": "40 33% 95%",
    "--primary": "17 97% 40%", "--primary-foreground": "0 0% 100%",
    "--secondary": "216 28% 23%", "--secondary-foreground": "40 33% 95%",
    "--muted": "216 28% 21%", "--muted-foreground": "216 15% 75%",
    "--accent": "216 28% 25%", "--accent-foreground": "24 95% 70%",
    "--destructive": "0 68% 53%", "--destructive-foreground": "0 0% 100%",
    "--border": "216 22% 30%", "--input": "216 22% 30%", "--ring": "17 97% 40%",
    "--radius": "0.625rem",
  }),
  yankees: theme("New York Yankees", "White with navy pinstripes", false, {
    "--background": "210 10% 97%", "--foreground": "220 57% 18%",
    "--card": "0 0% 100%", "--card-foreground": "220 57% 18%",
    "--popover": "0 0% 100%", "--popover-foreground": "220 57% 18%",
    "--primary": "220 57% 18%", "--primary-foreground": "0 0% 100%",
    "--secondary": "216 18% 91%", "--secondary-foreground": "220 57% 18%",
    "--muted": "216 18% 93%", "--muted-foreground": "218 12% 43%",
    "--accent": "216 20% 89%", "--accent-foreground": "220 57% 18%",
    "--destructive": "0 58% 45%", "--destructive-foreground": "0 0% 100%",
    "--border": "216 17% 80%", "--input": "216 17% 80%", "--ring": "220 57% 18%",
    "--radius": "0.45rem",
  }),
};

export type FieldKey = "designers" | "shoe_size" | "width" | "looking_for";

export const DEFAULT_LABELS: Record<FieldKey, string> = {
  designers: "Designers",
  shoe_size: "Shoe size",
  width: "Width",
  looking_for: "Wants",
};

type Settings = { theme: ThemeKey; accent: AccentSetting; font: FontKey; labels: Record<FieldKey, string> };

const STORAGE_KEY = "noted.settings.v1";

function read(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        theme: (p.theme in THEMES ? p.theme : "warm") as ThemeKey,
        accent: (p.accent === "theme" || p.accent in ACCENTS ? p.accent : "theme") as AccentSetting,
        font: (p.font in FONTS ? p.font : "inter") as FontKey,
        labels: { ...DEFAULT_LABELS, ...(p.labels ?? {}) },
      };
    }
  } catch {
    /* ignore */
  }
  return { theme: "warm", accent: "theme", font: "inter", labels: { ...DEFAULT_LABELS } };
}

export function applyAccent(accent: AccentKey) {
  const root = document.documentElement;
  Object.entries(ACCENTS[accent].vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

export function applyTheme(themeKey: ThemeKey, accent: AccentSetting, fontKey: FontKey) {
  const root = document.documentElement;
  const t = THEMES[themeKey];
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  if (accent !== "theme") applyAccent(accent);
  const font = FONTS[fontKey].stack;
  root.style.setProperty("--font-sans", font);
  root.style.setProperty("--font-serif", font);
  root.dataset.theme = themeKey;
  root.classList.toggle("dark", t.dark);
}

type Ctx = Settings & {
  setTheme: (t: ThemeKey) => void;
  setAccent: (a: AccentSetting) => void;
  setFont: (f: FontKey) => void;
  setLabel: (k: FieldKey, v: string) => void;
  resetLabels: () => void;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => read());

  useEffect(() => {
    applyTheme(settings.theme, settings.accent, settings.font);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const value: Ctx = {
    ...settings,
    setTheme: (theme) => setSettings((s) => ({ ...s, theme, accent: "theme" })),
    setAccent: (accent) => setSettings((s) => ({ ...s, accent })),
    setFont: (font) => setSettings((s) => ({ ...s, font })),
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
