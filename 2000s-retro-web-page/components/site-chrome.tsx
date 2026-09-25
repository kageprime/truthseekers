import Link from "next/link";
import { AuthLink } from "./auth-link";

// ponytail: one header/footer — pages were duplicating this markup 5×.
export function SiteHeader({ kicker = "A living index of people, places, ideas & things" }: { kicker?: string }) {
  return (
    <header className="border-b border-ink/15 bg-coral px-5 py-5 md:px-10">
      <div className="mx-auto flex max-w-[1400px] items-start justify-between gap-6">
        <div>
          <Link href="/" className="font-sans text-2xl font-bold tracking-[-0.07em] md:text-3xl">
            EVERYTHING / ENCYCLOPEDIA
          </Link>
          <p className="mt-4 max-w-xs font-mono text-[10px] uppercase tracking-[0.16em]">{kicker}</p>
        </div>
        <nav aria-label="Primary" className="hidden gap-8 font-mono text-[11px] uppercase md:flex">
          <Link href="/articles" className="hover:underline">
            Articles
          </Link>
          <Link href="/maps" className="hover:underline">
            Maps
          </Link>
          <Link href="/claims" className="hover:underline">
            Claim graph
          </Link>
          <Link href="/gaps" className="hover:underline">
            Open gaps
          </Link>
          <Link href="/chat" className="hover:underline">
            Ask Veritas
          </Link>
          <AuthLink />
        </nav>
      </div>
    </header>
  );
}

// ponytail: one footer, two tones — ink for index pages (optional blurb +
// caller-supplied links), coral for the article shell's back-to-top block.
export function SiteFooter({
  tone = "ink",
  blurb,
  children,
}: {
  tone?: "ink" | "coral";
  blurb?: string;
  children?: React.ReactNode;
}) {
  if (tone === "coral") {
    return (
      <footer className="border-t border-ink bg-coral px-5 py-10 md:px-10">
        <div className="mx-auto flex max-w-[1400px] flex-col justify-between gap-8 md:flex-row">
          <div>
            <p className="font-sans text-2xl font-bold tracking-[-.06em]">Everything / Encyclopedia</p>
            <p className="mt-3 max-w-sm font-serif text-sm">
              Built for the permanently curious. No ads, no rankings, no final answers.
            </p>
          </div>
          <div className="font-mono text-[10px] uppercase leading-loose">{children}</div>
        </div>
      </footer>
    );
  }
  return (
    <footer className="border-t border-ink bg-ink px-5 py-12 text-paper md:px-10">
      <div className="mx-auto flex max-w-[1400px] flex-col justify-between gap-6 md:flex-row">
        <div>
          <p className="font-sans text-2xl font-bold tracking-[-.06em]">Everything / Encyclopedia</p>
          {blurb && <p className="mt-3 max-w-sm font-serif text-sm text-paper/65">{blurb}</p>}
        </div>
        <div className="flex items-start gap-6">{children}</div>
      </div>
    </footer>
  );
}
