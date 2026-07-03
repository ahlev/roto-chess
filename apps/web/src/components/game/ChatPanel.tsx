"use client";

/**
 * Table chat — one channel per TABLE, persistent across the series, whole-
 * table only in V1 (ten years of open table-talk precedent). Messages can
 * anchor to a specific move ("brutal †" threads onto the evaporation it
 * mocks). Realtime arrives via the game room's doorbell refetch.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { browserClient } from "@/lib/supabase/client";

interface ChatRow {
  id: number;
  user_id: string;
  body: string;
  anchor_ply: number | null;
  created_at: string;
  displayName: string;
}

export interface ChatPanelProps {
  tableId: string;
  gameId: string;
  myUserId: string | null;
  /** When set, the composer anchors the next message to this ply. */
  anchorPly?: number | null;
  onClearAnchor?: () => void;
  onJumpToPly?: (ply: number) => void;
}

export function ChatPanel({
  tableId,
  gameId,
  myUserId,
  anchorPly = null,
  onClearAnchor,
  onJumpToPly,
}: ChatPanelProps) {
  const supabase = browserClient();
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    // Newest 200, then chronological — a years-long table channel must
    // always show its LATEST page, not its first.
    const { data: newestFirst } = await supabase
      .from("chat_messages")
      .select("id, user_id, body, anchor_ply, created_at, profiles(display_name)")
      .eq("table_id", tableId)
      .order("created_at", { ascending: false })
      .limit(200);
    const data = (newestFirst ?? []).slice().reverse();
    setRows(
      ((data ?? []) as unknown as Array<{
        id: number;
        user_id: string;
        body: string;
        anchor_ply: number | null;
        created_at: string;
        profiles: { display_name: string | null } | null;
      }>).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        body: r.body,
        anchor_ply: r.anchor_ply,
        created_at: r.created_at,
        displayName: r.profiles?.display_name ?? "Player",
      })),
    );
  }, [supabase, tableId]);

  useEffect(() => {
    void load();
    if (!supabase) return;
    const channel = supabase
      .channel(`chat:${tableId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `table_id=eq.${tableId}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, tableId, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [rows.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !myUserId || !draft.trim()) return;
    setBusy(true);
    await supabase.from("chat_messages").insert({
      table_id: tableId,
      game_id: anchorPly !== null ? gameId : null,
      anchor_ply: anchorPly,
      user_id: myUserId,
      body: draft.trim(),
    });
    setDraft("");
    onClearAnchor?.();
    setBusy(false);
    await load();
  };

  return (
    <div className="flex h-72 flex-col rounded-lg border border-line bg-surface">
      <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {rows.length === 0 && (
          <p className="text-text-dim">
            The table is quiet. It won't stay that way.
          </p>
        )}
        {rows.map((row) => (
          <div key={row.id}>
            <span className="text-text-dim">{row.displayName}</span>{" "}
            {row.anchor_ply !== null && (
              <button
                type="button"
                onClick={() => onJumpToPly?.(row.anchor_ply as number)}
                className="rounded border border-line px-1 text-[10px] text-text-dim hover:bg-surface-raised"
                style={{ fontFamily: "var(--font-plex-mono)" }}
              >
                @{row.anchor_ply}
              </button>
            )}{" "}
            <span className="text-text">{row.body}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-line p-2">
        {anchorPly !== null && (
          <button
            type="button"
            onClick={onClearAnchor}
            className="rounded-full border border-line px-2 text-xs text-text-dim"
            title="Remove the move anchor"
          >
            @{anchorPly} ✕
          </button>
        )}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Say it to the whole table…"
          maxLength={2000}
          className="min-w-0 flex-1 rounded-full border border-line bg-surface-raised px-3 py-1.5 text-sm text-text"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="rounded-full border border-line px-3 text-sm text-text-dim"
        >
          Send
        </button>
      </form>
    </div>
  );
}
