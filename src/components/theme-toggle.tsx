"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useHasMounted } from "@/lib/use-has-mounted";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHasMounted();

  if (!mounted) {
    return <Button variant="ghost" size="sm" disabled className="h-8" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 text-xs"
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? "Claro" : "Oscuro"}
    </Button>
  );
}
