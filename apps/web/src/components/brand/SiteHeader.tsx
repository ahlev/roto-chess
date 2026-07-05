"use client";

/**
 * The one site header. Every page's top bar is this component so the logo,
 * wordmark, and navigation read identically everywhere — only the per-page
 * links, the home target, and the color tone (dark app chrome vs. the paper
 * "compendium" idiom on /rules and /about) vary. The auth affordance is
 * self-contained: it shows "Sign in" to guests and an Account / Sign out
 * pair to members, flipping live via useAuthStatus.
 */
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MeridianRose } from "@/components/brand/MeridianRose";
import { SoundToggle } from "@/components/audio/SoundToggle";
import { BRAND } from "@/config/brand";
import { useAuthStatus } from "@/lib/auth/useAuthStatus";

export interface NavLink {
  href: string;
  label: string;
  /** Open in a new tab (e.g. the rulebook from a live game). */
  newTab?: boolean;
}

const TONES = {
  dark: { text: "text-text", dim: "text-text-dim" },
  paper: { text: "text-[color:var(--ink)]", dim: "text-[color:var(--ink-dim)]" },
} as const;

export function SiteHeader({
  tone = "dark",
  home = "/",
  links = [],
  auth = true,
  logoSize = 28,
  className,
  rightSlot,
}: {
  tone?: keyof typeof TONES;
  home?: string;
  links?: NavLink[];
  /** Show the sign-in / account affordance. */
  auth?: boolean;
  logoSize?: number;
  /** Override the default bar layout (rare — e.g. a page with no right nav). */
  className?: string;
  /** Page-specific controls appended after the links (e.g. in-game toggles). */
  rightSlot?: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <header
      className={
        className ??
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4"
      }
    >
      <Link
        href={home}
        className={`flex items-center gap-2 text-2xl ${t.text}`}
        style={{ fontFamily: "var(--font-instrument-serif)" }}
      >
        <MeridianRose size={logoSize} className={t.text} />
        {BRAND.name}
      </Link>
      <nav className={`flex flex-wrap items-center gap-4 text-sm ${t.dim}`}>
        {links.map((l) => (
          <Link
            key={`${l.href}·${l.label}`}
            href={l.href}
            target={l.newTab ? "_blank" : undefined}
            rel={l.newTab ? "noopener" : undefined}
            className="hover:underline"
          >
            {l.label}
          </Link>
        ))}
        {rightSlot}
        <SoundToggle />
        {auth && <AuthControl />}
      </nav>
    </header>
  );
}

/** Sign in ⇄ Account / Sign out, resolved from live auth state. */
function AuthControl() {
  const pathname = usePathname();
  const { signedIn, signOut } = useAuthStatus();

  // Hold an invisible "Sign in" of the right width until resolved, so the bar
  // never flashes the wrong language (or shifts) before auth is known.
  if (signedIn === null) {
    return (
      <span aria-hidden className="select-none opacity-0">
        Sign in
      </span>
    );
  }
  if (!signedIn) {
    const redirect =
      pathname && pathname !== "/"
        ? `?redirect=${encodeURIComponent(pathname)}`
        : "";
    return (
      <Link href={`/login${redirect}`} className="hover:underline">
        Sign in
      </Link>
    );
  }
  return (
    <>
      <Link href="/app/settings" className="hover:underline">
        Account
      </Link>
      <button
        type="button"
        onClick={() => void signOut()}
        className="hover:underline"
      >
        Sign out
      </button>
    </>
  );
}
