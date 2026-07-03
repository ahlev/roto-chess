/**
 * Attention events — a tiny pub-sub for "something wants the player's eye".
 *
 * The UI emits these when it nudges visually; a SOUND SYSTEM will subscribe
 * in a follow-up and map each event to a cue. Hook points currently emitted:
 *
 *   - "chat-receive" — a chat message arrived that the player has not seen
 *                      (sound: chat-receive)
 *   - "chat-nudge"   — the recurring ~30s reminder while unread chat exists
 *                      (sound: chat-nudge)
 *   - "your-turn"    — the game just became the player's move
 *                      (sound: your-turn)
 */
export type AttentionEvent = "chat-receive" | "chat-nudge" | "your-turn";

type Listener = (event: AttentionEvent) => void;

const listeners = new Set<Listener>();

/** Subscribe to attention events; returns an unsubscribe function. */
export function onAttention(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Emit an attention event to all subscribers (visuals already handled). */
export function emitAttention(event: AttentionEvent): void {
  for (const listener of listeners) listener(event);
}
