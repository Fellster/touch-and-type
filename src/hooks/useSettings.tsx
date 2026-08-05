import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type AccentKey = "black" | "blue" | "green" | "red";

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

export type FieldKey = "designers" | "shoe_size" | "width" | "looking_for";

export const DEFAULT_LABELS: Record<FieldKey, string> = {
  designers: "Designers",
  shoe_size: "Shoe size",
  width: "Width",
  looking_for: "Looking for",
};

type Settings = { accent: AccentKey; labels: Record<FieldKey, string> };

const STORAGE_KEY = "noted.settings.v1";

function read(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        accent: (p.accent in ACCENTS ? p.accent : "black") as AccentKey,
        labels: { ...DEFAULT_LABELS, ...(p.labels ?? {}) },
      };
    }
  } catch {
    /* ignore */
  }
  return { accent: "black", labels: { ...DEFAULT_LABELS } };
}

export function applyAccent(accent: AccentKey) {
  const root = document.documentElement;
  Object.entries(ACCENTS[accent].vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

type Ctx = Settings & {
  setAccent: (a: AccentKey) => void;
  setLabel: (k: FieldKey, v: string) => void;
  resetLabels: () => void;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => read());

  useEffect(() => {
    applyAccent(settings.accent);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const value: Ctx = {
    ...settings,
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
