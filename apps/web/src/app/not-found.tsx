import Link from "next/link";
import { MeridianRose } from "@/components/brand/MeridianRose";
import { BRAND } from "@/config/brand";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <img
        src="/plates/vignette-404.webp"
        alt=""
        aria-hidden="true"
        width={700}
        height={700}
        className="w-44 rounded-lg border border-line"
      />
      <MeridianRose size={32} className="text-text-dim" />
      <h1
        className="text-3xl text-text"
        style={{ fontFamily: "var(--font-instrument-serif)" }}
      >
        No such square
      </h1>
      <p className="max-w-sm text-sm text-text-dim">
        — and this board is very thorough about squares.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-full border border-line px-4 py-2 text-sm text-text-dim"
      >
        Back to {BRAND.name}
      </Link>
    </main>
  );
}
