"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** true solo despues de hidratar en el cliente; evita mismatch de SSR sin setState-en-efecto. */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
