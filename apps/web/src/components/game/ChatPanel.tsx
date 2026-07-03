"use client";

/**
 * Table chat — one persistent channel per TABLE, now surfaced as two clearly
 * labeled lines: "The table" (all four) and "Partners" (team_only=true — in
 * a four-player team game the team channel IS the partner DM). Messages can
 * anchor to a specific move ("brutal †" threads onto the evaporation it
 * mocks). Realtime arrives via a postgres_changes doorbell; RLS on
 * chat_messages keeps team_only rows invisible to the other team (leak test
 * in test/db.test.ts guards the policy).
 *
 * Scrolling is CONTAINER-scoped: only the message list element scrolls,
 * never the page (the founder's "chat jumps the page" complaint), and only
 * when the reader is already near the bottom.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { partnerOf, type Seat } from "@rotochess/engine";
import { browserClient } from "@/lib/supabase/client";
import { emitAttention } from "@/components/game/attention";
import { SEAT_CHIP, type PlaqueSeat } from "@/components/game/SeatPlaques";

interface ChatRow {
  id: number;
  user_id: string;
  body: string;
  anchor_ply: number | null;
  team_only: boolean;
  created_at: string;
  displayName: string;
}

export type ChatChannel = "table" | "partners";

/** A one-shot "open the chat on this channel" request (bump the nonce). */
export interface ChatOpenRequest {
  channel: ChatChannel;
  nonce: number;
}

export interface ChatPanelProps {
  tableId: string;
  gameId: string;
  myUserId: string | null;
  /** Seat map for sender colors and partner routing (optional for lobby). */
  seats?: PlaqueSeat[];
  mySeat?: Seat | null;
  /** Set by the page (seat-plaque clicks) to open a specific channel. */
  openRequest?: ChatOpenRequest | null;
  /** When set, the composer anchors the next message to this ply. */
  anchorPly?: number | null;
  onClearAnchor?: () => void;
  onJumpToPly?: (ply: number) => void;
}

/** How close to the bottom (px) still counts as "reading the latest". */
const NEAR_BOTTOM_PX = 80;
/** Recurring unread reminder cadence. */
const NUDGE_INTERVAL_MS = 30_000;

export function ChatPanel({
  tableId,
  gameId,
  myUserId,
  seats = [],
  mySeat = null,
  openRequest = null,
  anchorPly = null,
  onClearAnchor,
  onJumpToPly,
}: ChatPanelProps) {
  const supabase = browserClient();
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<ChatChannel>("table");
  // Highest message id the player has SEEN, per channel — everything newer
  // from someone else is unread.
  const [lastSeen, setLastSeen] = useState<Record<ChatChannel, number>>({
    table: 0,
    partners: 0,
  });

  const listRef = useRef<HTMLDivElement | null>(null);
  const badgeRef = useRef<HTMLSpanElement | null>(null);
  const nearBottomRef = useRef(true);
  const loadedOnceRef = useRef(false);
  const prevMaxIdRef = useRef(0);

  const partnerSeat = mySeat === null ? null : partnerOf(mySeat);
  const partner =
    partnerSeat === null
      ? undefined
      : seats.find((s) => s.seat === partnerSeat);
  const partnersAvailable = partner !== undefined;

  const load = useCallback(async () => {
    if (!supabase) return;
    // Newest 200, then chronological — a years-long table channel must
    // always show its LATEST page, not its first. RLS already hides the
    // other team's team_only rows from this select.
    const { data: newestFirst } = await supabase
      .from("chat_messages")
      .select(
        "id, user_id, body, anchor_ply, team_only, created_at, profiles(display_name)",
      )
      .eq("table_id", tableId)
      .order("created_at", { ascending: false })
      .limit(200);
    const data = (newestFirst ?? []).slice().reverse();
    const mapped = (
      data as unknown as Array<{
        id: number;
        user_id: string;
        body: string;
        anchor_ply: number | null;
        team_only: boolean;
        created_at: string;
        profiles: { display_name: string | null } | null;
      }>
    ).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      body: r.body,
      anchor_ply: r.anchor_ply,
      team_only: r.team_only,
      created_at: r.created_at,
      displayName: r.profiles?.display_name ?? "Player",
    }));
    if (!loadedOnceRef.current) {
      // History is not "unread" — start the unread ledger at the newest
      // message already on the table.
      loadedOnceRef.current = true;
      const maxId = mapped.reduce((m, r) => Math.max(m, r.id), 0);
      prevMaxIdRef.current = maxId;
      setLastSeen({ table: maxId, partners: maxId });
    }
    setRows(mapped);
  }, [supabase, tableId]);

  useEffect(() => {
    void load();
    if (!supabase) return;
    const chatChannel = supabase
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
      void supabase.removeChannel(chatChannel);
    };
  }, [supabase, tableId, load]);

  // ---- unread bookkeeping -------------------------------------------------
  const channelOf = (r: ChatRow): ChatChannel =>
    r.team_only ? "partners" : "table";
  const unreadIn = (ch: ChatChannel) =>
    rows.filter(
      (r) =>
        channelOf(r) === ch && r.id > lastSeen[ch] && r.user_id !== myUserId,
    );
  const unreadTable = unreadIn("table");
  const unreadPartners = unreadIn("partners");
  const unreadCount = unreadTable.length + unreadPartners.length;
  const latestUnread =
    [...unreadTable, ...unreadPartners].sort((a, b) => a.id - b.id).at(-1) ??
    null;
  const latestUnreadSeat =
    latestUnread === null
      ? null
      : (seats.find((s) => s.userId === latestUnread.user_id)?.seat ?? null);

  const visibleRows = rows.filter((r) => channelOf(r) === channel);
  const visibleMaxId = visibleRows.reduce((m, r) => Math.max(m, r.id), 0);

  const markChannelSeen = useCallback(() => {
    setLastSeen((prev) =>
      prev[channel] >= visibleMaxId
        ? prev
        : { ...prev, [channel]: visibleMaxId },
    );
  }, [channel, visibleMaxId]);

  // One brief attention bump — a single scale beat, never an infinite pulse.
  // Under prefers-reduced-motion the badge simply stays bold and static
  // (checked via matchMedia; globals.css is out of bounds here).
  const bumpBadge = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    badgeRef.current?.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.25)", offset: 0.4 },
        { transform: "scale(1)" },
      ],
      { duration: 450, easing: "ease-in-out" },
    );
  }, []);

  // New arrivals from someone else → attention event + badge beat.
  useEffect(() => {
    if (!loadedOnceRef.current) return;
    const maxId = rows.reduce((m, r) => Math.max(m, r.id), 0);
    if (maxId <= prevMaxIdRef.current) return;
    const fresh = rows.filter(
      (r) => r.id > prevMaxIdRef.current && r.user_id !== myUserId,
    );
    prevMaxIdRef.current = maxId;
    if (fresh.length > 0) {
      emitAttention("chat-receive"); // sound: chat-receive
      bumpBadge();
    }
  }, [rows, myUserId, bumpBadge]);

  // Recurring nudge while unread chat exists — one beat every ~30s.
  const hasUnread = unreadCount > 0;
  useEffect(() => {
    if (!hasUnread) return;
    const timer = window.setInterval(() => {
      emitAttention("chat-nudge"); // sound: chat-nudge
      bumpBadge();
    }, NUDGE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [hasUnread, bumpBadge]);

  // ---- container-scoped scrolling ----------------------------------------
  // Scroll the LIST element only (never scrollIntoView — that scrolls the
  // page), and only when the reader is already near the bottom.
  useEffect(() => {
    const list = listRef.current;
    if (!open || !list) return;
    if (nearBottomRef.current) {
      list.scrollTop = list.scrollHeight;
      markChannelSeen();
    }
  }, [visibleRows.length, open, channel, markChannelSeen]);

  const onListScroll = () => {
    const list = listRef.current;
    if (!list) return;
    const fromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    nearBottomRef.current = fromBottom < NEAR_BOTTOM_PX;
    if (nearBottomRef.current) markChannelSeen();
  };

  const openOn = useCallback((ch: ChatChannel) => {
    nearBottomRef.current = true; // opening always lands on the latest
    setChannel(ch);
    setOpen(true);
  }, []);

  // Seat-plaque clicks route here from the page.
  useEffect(() => {
    if (!openRequest) return;
    openOn(openRequest.channel);
  }, [openRequest, openOn]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !myUserId || !draft.trim()) return;
    setBusy(true);
    const teamOnly = channel === "partners";
    await supabase.from("chat_messages").insert({
      table_id: tableId,
      // RLS judges team scoping in the game the message anchors to (seats
      // rotate between games in a series) — a partners message MUST carry
      // game_id or the policy can admit no one, not even the sender.
      game_id: teamOnly || anchorPly !== null ? gameId : null,
      anchor_ply: anchorPly,
      user_id: myUserId,
      team_only: teamOnly,
      body: draft.trim(),
    });
    setDraft("");
    onClearAnchor?.();
    setBusy(false);
    nearBottomRef.current = true; // your own message always lands in view
    await load();
  };

  const tabClass = (ch: ChatChannel) =>
    `rounded-full px-3 py-1 text-xs ${
      channel === ch
        ? "bg-[color:var(--focus-ring)] font-semibold text-[color:var(--ink)]"
        : "border border-line text-text-dim hover:bg-surface-raised"
    }`;

  return (
    <div className="rounded-lg border border-line bg-surface">
      {/* Header — the toggle carries the unread badge. */}
      <button
        type="button"
        data-testid="chat-toggle"
        onClick={() => (open ? setOpen(false) : openOn(channel))}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-text hover:bg-surface-raised"
      >
        <span className="flex items-center gap-2">
          <span style={{ fontFamily: "var(--font-instrument-serif)" }}>
            Table talk
          </span>
          {unreadCount > 0 && (
            <span
              ref={badgeRef}
              data-testid="chat-unread-badge"
              className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--focus-ring)] px-2 py-0.5 text-[11px] font-bold text-[color:var(--ink)]"
            >
              {latestUnreadSeat !== null && (
                <span
                  aria-hidden
                  className={`h-2 w-2 rounded-full ${SEAT_CHIP[latestUnreadSeat]}`}
                />
              )}
              {unreadCount} new
            </span>
          )}
        </span>
        <span aria-hidden className="text-xs text-text-dim">
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="flex h-72 flex-col border-t border-line">
          {/* Channel tabs — nobody should DM the wrong audience. */}
          <div className="flex items-center gap-2 border-b border-line p-2">
            <button
              type="button"
              data-testid="chat-tab-table"
              className={tabClass("table")}
              onClick={() => {
                nearBottomRef.current = true;
                setChannel("table");
              }}
            >
              The table
              {unreadTable.length > 0 && channel !== "table"
                ? ` · ${unreadTable.length}`
                : ""}
            </button>
            {partnersAvailable && (
              <button
                type="button"
                data-testid="chat-tab-partners"
                className={tabClass("partners")}
                onClick={() => {
                  nearBottomRef.current = true;
                  setChannel("partners");
                }}
              >
                Partners
                {unreadPartners.length > 0 && channel !== "partners"
                  ? ` · ${unreadPartners.length}`
                  : ""}
              </button>
            )}
            {channel === "partners" && partner && (
              <span className="ml-auto truncate text-[11px] text-text-dim">
                only you and {partner.displayName}
              </span>
            )}
          </div>

          <div
            ref={listRef}
            onScroll={onListScroll}
            data-testid="chat-message-list"
            className="flex-1 space-y-2 overflow-y-auto p-3 text-sm"
          >
            {visibleRows.length === 0 && (
              <p className="text-text-dim">
                {channel === "partners"
                  ? "A private line to your partner. Plot quietly."
                  : "The table is quiet. It won't stay that way."}
              </p>
            )}
            {visibleRows.map((row) => (
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
          </div>

          <form
            onSubmit={send}
            className="flex gap-2 border-t border-line p-2"
          >
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
              placeholder={
                channel === "partners" ? "To your partner…" : "To the table…"
              }
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
      )}
    </div>
  );
}
