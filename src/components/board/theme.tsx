"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { MoonIcon, SunIcon, SunMoonIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type ThemeMode = "auto" | "light" | "dark";

const MODE_KEY = "bnb-theme-mode";

/** Dim the screen from 8pm to 6:30am so the kitchen isn't lit by a bright panel */
export function isNight(date = new Date()) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  return minutes >= 20 * 60 || minutes < 6 * 60 + 30;
}

const ModeContext = createContext<{ mode: ThemeMode; setMode: (mode: ThemeMode) => void }>({
  mode: "auto",
  setMode: () => {},
});

export function BoardThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    // next-themes applies the last light/dark choice before paint; the mode on top of it
    // (auto/light/dark) decides what that choice should be from here on.
    <ThemeProvider
      attribute="class"
      themes={["light", "dark"]}
      defaultTheme="light"
      enableSystem={false}
      storageKey="bnb-theme"
      disableTransitionOnChange
    >
      <ModeProvider>{children}</ModeProvider>
    </ThemeProvider>
  );
}

function ModeProvider({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();
  // null until the saved mode is read, so a saved light/dark choice isn't briefly overridden
  // by what auto would pick (a flash of the wrong theme on load)
  const [mode, setModeState] = useState<ThemeMode | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(MODE_KEY);
    // localStorage only exists after mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setModeState(stored === "light" || stored === "dark" ? stored : "auto");
  }, []);

  useEffect(() => {
    if (mode === null) return;
    if (mode !== "auto") {
      setTheme(mode);
      return;
    }
    const apply = () => setTheme(isNight() ? "dark" : "light");
    apply();
    const timer = setInterval(apply, 60 * 1000);
    return () => clearInterval(timer);
  }, [mode, setTheme]);

  const setMode = (next: ThemeMode) => {
    localStorage.setItem(MODE_KEY, next);
    setModeState(next);
  };

  return (
    <ModeContext.Provider value={{ mode: mode ?? "auto", setMode }}>
      {children}
    </ModeContext.Provider>
  );
}

const OPTIONS = [
  { value: "auto", label: "Auto (dark at night)", Icon: SunMoonIcon },
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
] as const;

export function ThemeModeToggle() {
  const { mode, setMode } = useContext(ModeContext);

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      spacing={0}
      value={mode}
      onValueChange={(value) => value && setMode(value as ThemeMode)}
      aria-label="Theme"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <ToggleGroupItem
          key={value}
          value={value}
          aria-label={label}
          title={label}
          className="size-11 data-[state=on]:bg-foreground data-[state=on]:text-background"
        >
          <Icon className="size-5" />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
