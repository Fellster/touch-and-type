import {
  THEMES as ORIGINAL_THEMES,
  ACCENTS,
  applyTheme as applyOriginalTheme,
  type AccentSetting,
  type FontKey,
} from "../../src/hooks/useSettings";

const extra = (label: string, dark: boolean, vars: Record<string, string>) => ({
  label,
  description: "",
  dark,
  vars: { ...ORIGINAL_THEMES.warm.vars, ...vars },
});

export const THEMES = {
  ...ORIGINAL_THEMES,
  punk: extra("Hardcore Punk", true, {
    "--background": "0 0% 6%",
    "--foreground": "42 35% 94%",
    "--card": "42 35% 94%",
    "--card-foreground": "0 0% 8%",
    "--popover": "0 0% 10%",
    "--popover-foreground": "42 35% 94%",
    "--primary": "247 84% 64%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "0 0% 14%",
    "--secondary-foreground": "42 35% 94%",
    "--muted": "0 0% 16%",
    "--muted-foreground": "40 10% 72%",
    "--accent": "247 40% 25%",
    "--accent-foreground": "42 35% 94%",
    "--border": "40 12% 65%",
    "--input": "40 12% 65%",
    "--ring": "247 84% 64%",
    "--destructive": "247 84% 64%",
    "--destructive-foreground": "0 0% 100%",
    "--radius": "0.2rem",
  }),
  gallery: extra("Gallery", false, {
    "--background": "0 0% 100%",
    "--foreground": "0 0% 8%",
    "--card": "0 0% 100%",
    "--card-foreground": "0 0% 8%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "0 0% 8%",
    "--primary": "0 0% 8%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "220 10% 97%",
    "--secondary-foreground": "0 0% 8%",
    "--muted": "220 10% 97%",
    "--muted-foreground": "220 4% 40%",
    "--accent": "220 10% 94%",
    "--accent-foreground": "0 0% 8%",
    "--border": "220 8% 85%",
    "--input": "220 8% 85%",
    "--ring": "0 0% 8%",
    "--destructive": "0 0% 30%",
    "--destructive-foreground": "0 0% 100%",
    "--radius": "0.4rem",
  }),
  botanical: extra("Botanical", false, {
    "--background": "48 33% 98%",
    "--foreground": "136 37% 17%",
    "--card": "48 33% 99%",
    "--card-foreground": "136 37% 17%",
    "--popover": "48 33% 99%",
    "--popover-foreground": "136 37% 17%",
    "--primary": "136 37% 25%",
    "--primary-foreground": "48 33% 99%",
    "--secondary": "90 22% 92%",
    "--secondary-foreground": "136 37% 17%",
    "--muted": "90 20% 94%",
    "--muted-foreground": "130 12% 36%",
    "--accent": "90 24% 90%",
    "--accent-foreground": "136 37% 17%",
    "--border": "110 18% 68%",
    "--input": "110 18% 68%",
    "--ring": "136 37% 25%",
    "--destructive": "0 55% 38%",
    "--destructive-foreground": "0 0% 100%",
    "--radius": "0.65rem",
  }),
};

export type ThemeKey = keyof typeof THEMES;
export const THEME_FONTS: Partial<Record<ThemeKey, FontKey>> = {
  punk: "inter",
  gallery: "inter",
  botanical: "manrope",
};

export function applyTheme(
  key: ThemeKey,
  accent: AccentSetting,
  font: FontKey,
) {
  if (key in ORIGINAL_THEMES) {
    applyOriginalTheme(key as keyof typeof ORIGINAL_THEMES, accent, font);
    return;
  }
  // Start from the original implementation so font selection and token reset stay identical.
  applyOriginalTheme("warm", "theme", font);
  const root = document.documentElement,
    theme = THEMES[key];
  Object.entries(theme.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  if (accent !== "theme")
    Object.entries(ACCENTS[accent].vars).forEach(([k, v]) =>
      root.style.setProperty(k, v),
    );
  root.dataset.theme = key;
  root.classList.toggle("dark", theme.dark);
}
