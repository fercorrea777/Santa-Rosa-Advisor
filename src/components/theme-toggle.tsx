"use client";

import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useHasMounted } from "@/lib/use-has-mounted";
import { IconLuna, IconSol } from "@/components/icons";

/** Botón de tema como ícono (sol/luna del set propio), no texto. El label
 *  accesible dice a qué modo CAMBIA, que es lo que el click hace. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHasMounted();

  if (!mounted) {
    return <Button variant="ghost" size="icon" disabled aria-hidden="true" />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <span className="transition-transform duration-300 ease-out hover:rotate-12">
        {isDark ? <IconSol size={17} /> : <IconLuna size={17} />}
      </span>
    </Button>
  );
}
