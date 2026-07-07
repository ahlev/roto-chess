"use client";

/**
 * The rail — who's watching, one quiet line: "Observing: Ava, Ben". For the
 * observer themself it also carries "stop watching" (deletes their own
 * membership row — RLS allows exactly that and nothing more).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase/client";
import type { ObserverInfo } from "@/lib/game/observers";

export function ObserverRail({
  observers,
  isObserver,
  tableId,
  myUserId,
}: {
  observers: ObserverInfo[];
  isObserver: boolean;
  tableId: string | null;
  myUserId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (observers.length === 0) return null;

  const stopWatching = async () => {
    const supabase = browserClient();
    if (!supabase || !tableId || !myUserId || busy) return;
    setBusy(true);
    await supabase
      .from("table_observers")
      .delete()
      .eq("table_id", tableId)
      .eq("user_id", myUserId);
    router.push("/app");
  };

  return (
    <p
      data-testid="observer-rail"
      className="truncate px-1 pt-1.5 text-center text-[11px] text-text-dim"
    >
      Observing: {observers.map((o) => o.displayName).join(", ")}
      {isObserver && (
        <>
          {" · "}
          <button
            type="button"
            onClick={() => void stopWatching()}
            disabled={busy}
            className="underline decoration-dotted underline-offset-2 hover:text-text"
          >
            stop watching
          </button>
        </>
      )}
    </p>
  );
}
