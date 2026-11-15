"use client";
import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const dark = useSyncExternalStore((callback) => { window.addEventListener("kaarya-theme-change", callback); return () => window.removeEventListener("kaarya-theme-change", callback); }, () => document.documentElement.classList.contains("dark"), () => false);
  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    localStorage.setItem("kaarya-theme", next ? "dark" : "light");
    window.dispatchEvent(new Event("kaarya-theme-change"));
  }
  return <button aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line)] px-3 text-sm text-[color:var(--ink)] hover:bg-[var(--soft)]" onClick={toggle} type="button">{dark ? <Sun size={17}/> : <Moon size={17}/>}<span className="hidden sm:inline">{dark ? "Light" : "Dark"} mode</span></button>;
}
