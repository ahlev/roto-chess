import type { ReactNode } from "react";
import { ReducedMotionGate } from "@/components/prefs/ReducedMotionGate";

/**
 * Authed-area layout: applies account preferences that live at the document
 * level (today: the reduced-motion gate). Pages render unchanged.
 */
export default function AppAreaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ReducedMotionGate />
      {children}
    </>
  );
}
