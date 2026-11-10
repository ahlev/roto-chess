import { useEffect, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile } from "remotion";

/** Key = `${seat}${kind}`, value = a data URL for the sprite SVG. */
export type SpriteMap = Record<string, string>;

const SEATS = [1, 2, 3, 4] as const;
const KINDS = ["K", "Q", "R", "B", "N", "P"] as const;
export const SPRITE_KEYS: readonly string[] = SEATS.flatMap((s) => KINDS.map((k) => `${s}${k}`));

const cache: { promise: Promise<SpriteMap> | null; value: SpriteMap | null } = { promise: null, value: null };

export function loadSprites(): Promise<SpriteMap> {
  if (!cache.promise) {
    cache.promise = Promise.all(
      SPRITE_KEYS.map(async (key) => {
        const res = await fetch(staticFile(`pieces/${key}.svg`));
        if (!res.ok) throw new Error(`sprite ${key}: HTTP ${res.status}`);
        const svg = await res.text();
        return [key, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`] as const;
      }),
    ).then((entries) => {
      cache.value = Object.fromEntries(entries);
      return cache.value;
    });
  }
  return cache.promise;
}

/** Blocks the render until all 24 sprites are in memory; returns null meanwhile. */
export function useSprites(): SpriteMap | null {
  const [sprites, setSprites] = useState<SpriteMap | null>(cache.value);
  const [handle] = useState<number | null>(() => (cache.value ? null : delayRender("Loading piece sprites")));
  useEffect(() => {
    if (cache.value) return;
    loadSprites()
      .then((v) => {
        setSprites(v);
        if (handle !== null) continueRender(handle);
      })
      .catch((err: unknown) => cancelRender(err));
  }, [handle]);
  return sprites;
}
