import { useState, useEffect } from "react";

export type ColorPalette = "blue" | "pink" | "yellow" | "purple" | "green" | "orange" | "red" | "cyan";
export type ThemeMode = "light" | "dark";

export interface ThemeColors {
  from: string;
  to: string;
  accent: string;
  light: string;
}

const colorPalettes: Record<ColorPalette, ThemeColors> = {
  blue: {
    from: "from-blue-50 dark:from-slate-900",
    to: "to-indigo-100 dark:to-slate-800",
    accent: "bg-blue-500",
    light: "bg-blue-100/50 dark:bg-blue-900/30"
  },
  pink: {
    from: "from-pink-50 dark:from-slate-900",
    to: "to-rose-100 dark:to-slate-800",
    accent: "bg-pink-500",
    light: "bg-pink-100/50 dark:bg-pink-900/30"
  },
  yellow: {
    from: "from-yellow-50 dark:from-slate-900",
    to: "to-amber-100 dark:to-slate-800",
    accent: "bg-yellow-500",
    light: "bg-yellow-100/50 dark:bg-yellow-900/30"
  },
  purple: {
    from: "from-purple-50 dark:from-slate-900",
    to: "to-violet-100 dark:to-slate-800",
    accent: "bg-purple-500",
    light: "bg-purple-100/50 dark:bg-purple-900/30"
  },
  green: {
    from: "from-green-50 dark:from-slate-900",
    to: "to-emerald-100 dark:to-slate-800",
    accent: "bg-green-500",
    light: "bg-green-100/50 dark:bg-green-900/30"
  },
  orange: {
    from: "from-orange-100 dark:from-slate-900",
    to: "to-orange-200 dark:to-orange-950/40",
    accent: "bg-orange-500",
    light: "bg-orange-100/50 dark:bg-orange-900/30"
  },
  red: {
    from: "from-red-50 dark:from-slate-900",
    to: "to-rose-100 dark:to-slate-800",
    accent: "bg-red-500",
    light: "bg-red-100/50 dark:bg-red-900/30"
  },
  cyan: {
    from: "from-cyan-50 dark:from-slate-900",
    to: "to-blue-100 dark:to-slate-800",
    accent: "bg-cyan-500",
    light: "bg-cyan-100/50 dark:bg-cyan-900/30"
  }
};

interface PaletteVars {
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
  ring: string;
  primaryDark: string;
  accentDark: string;
  ringDark: string;
}

const paletteVars: Record<ColorPalette, PaletteVars> = {
  blue: {
    primary: "217 91% 60%",
    primaryForeground: "0 0% 100%",
    accent: "224 76% 48%",
    accentForeground: "0 0% 100%",
    ring: "217 91% 60%",
    primaryDark: "217 91% 65%",
    accentDark: "224 76% 58%",
    ringDark: "217 91% 65%",
  },
  pink: {
    primary: "340 82% 52%",
    primaryForeground: "0 0% 100%",
    accent: "316 73% 52%",
    accentForeground: "0 0% 100%",
    ring: "340 82% 52%",
    primaryDark: "340 82% 62%",
    accentDark: "316 73% 62%",
    ringDark: "340 82% 62%",
  },
  yellow: {
    primary: "38 92% 44%",
    primaryForeground: "0 0% 100%",
    accent: "25 95% 53%",
    accentForeground: "0 0% 100%",
    ring: "38 92% 44%",
    primaryDark: "38 92% 55%",
    accentDark: "25 95% 58%",
    ringDark: "38 92% 55%",
  },
  purple: {
    primary: "271 81% 56%",
    primaryForeground: "0 0% 100%",
    accent: "258 90% 66%",
    accentForeground: "0 0% 100%",
    ring: "271 81% 56%",
    primaryDark: "271 81% 66%",
    accentDark: "258 90% 72%",
    ringDark: "271 81% 66%",
  },
  green: {
    primary: "151 55% 42%",
    primaryForeground: "0 0% 100%",
    accent: "199 89% 48%",
    accentForeground: "0 0% 100%",
    ring: "151 55% 42%",
    primaryDark: "151 55% 48%",
    accentDark: "199 89% 55%",
    ringDark: "151 55% 48%",
  },
  orange: {
    primary: "21 90% 48%",
    primaryForeground: "0 0% 100%",
    accent: "32 98% 44%",
    accentForeground: "0 0% 100%",
    ring: "21 90% 48%",
    primaryDark: "21 90% 58%",
    accentDark: "32 98% 54%",
    ringDark: "21 90% 58%",
  },
  red: {
    primary: "0 84% 54%",
    primaryForeground: "0 0% 100%",
    accent: "12 76% 61%",
    accentForeground: "0 0% 100%",
    ring: "0 84% 54%",
    primaryDark: "0 84% 64%",
    accentDark: "12 76% 66%",
    ringDark: "0 84% 64%",
  },
  cyan: {
    primary: "192 91% 36%",
    primaryForeground: "0 0% 100%",
    accent: "200 98% 39%",
    accentForeground: "0 0% 100%",
    ring: "192 91% 36%",
    primaryDark: "192 91% 48%",
    accentDark: "200 98% 50%",
    ringDark: "192 91% 48%",
  },
};

function applyPaletteVars(palette: ColorPalette, isDark: boolean) {
  const vars = paletteVars[palette];
  const root = document.documentElement;
  root.style.setProperty("--primary", isDark ? vars.primaryDark : vars.primary);
  root.style.setProperty("--primary-foreground", vars.primaryForeground);
  root.style.setProperty("--accent", isDark ? vars.accentDark : vars.accent);
  root.style.setProperty("--accent-foreground", vars.accentForeground);
  root.style.setProperty("--ring", isDark ? vars.ringDark : vars.ring);
}

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("theme-mode");
    if (stored) return stored === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const [colorPalette, setColorPalette] = useState<ColorPalette>(() => {
    if (typeof window === "undefined") return "green";
    return (localStorage.getItem("color-palette") as ColorPalette) || "green";
  });

  useEffect(() => {
    localStorage.setItem("theme-mode", isDark ? "dark" : "light");
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    applyPaletteVars(colorPalette, isDark);
  }, [isDark, colorPalette]);

  useEffect(() => {
    localStorage.setItem("color-palette", colorPalette);
    applyPaletteVars(colorPalette, isDark);
  }, [colorPalette]);

  const toggleTheme = () => setIsDark(!isDark);
  const changeColorPalette = (palette: ColorPalette) => setColorPalette(palette);
  const colors = colorPalettes[colorPalette];

  return {
    isDark,
    colorPalette,
    colors,
    toggleTheme,
    changeColorPalette,
    allPalettes: Object.keys(colorPalettes) as ColorPalette[]
  };
}
