"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppFooter from "./components/AppFooter";
import EyebrowTag from "./components/EyebrowTag";
import { useHealth, useContestedClaims, useAllGaps } from "./hooks";

function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll<HTMLElement>(".reveal, .reveal-up, .reveal-blur, .scrub-text, .stack-card, .scale-fade-img").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function InlineImage({ seed, label }: { seed: string; label: string }) {
  return (
    <span
      className="inline-block align-middle mx-1.5 rounded-full overflow-hidden shrink-0"
      style={{ width: 56, height: 28, verticalAlign: "middle" }}
      aria-label={label}
    >
      <img src={"https://picsum.photos/seed/" + seed + "/300/150"} alt="" className="w-full h-full object-cover" />
    </span>
  );
}

function InfiniteMarquee({ items, speed = 40 }: { items: string[]; speed?: number }) {
  const doubled = [...items, ...items];
  return (
    <div className="overflow-hidden relative w-full" style={{ maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)" }}>
      <div className="flex whitespace-nowrap" style={{ animation: `marquee ${speed}s linear infinite` }}>
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-center mx-12 text-xs tracking-[0.15em] uppercase font-medium" style={{ color: "var(--subtle)" }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function HorizontalAccordion({ panels }: { panels: Array<{ title: string; content: string; image: string; seed: string }> }) {
  return (
    <div className="accordion-root" style={{ borderRadius: "var(--radius-sharp)" }}>
      {panels.map((panel, i) => (
        <div key={i} className="accordion-panel">
          <img src={"https://picsum.photos/seed/" + panel.seed + "/800/600"} alt="" className="accordion-img" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7 text-white">
            <h3 className="font-display font-bold text-lg md:text-xl mb-1 tracking-tight">{panel.title}</h3>
            <p className="text-xs md:text-sm opacity-90 line-clamp-2 font-serif">{panel.content}</p>
          </div>
        </div>
      ))}
      <style jsx>{`
        .accordion-root {
          display: flex;
          height: 20rem;
          overflow: hidden;
          gap: 3px;
          background: color-mix(in srgb, var(--rule) 60%, transparent);
        }
        @media (min-width: 768px) {
          .accordion-root { height: 24rem; }
        }
        .accordion-panel {
          flex: 1 1 0%;
          min-width: 100px;
          position: relative;
          overflow: hidden;
          transition: flex 0.7s cubic-bezier(0.32, 0.72, 0, 1);
          cursor: pointer;
        }
        .accordion-panel .accordion-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: filter 0.7s ease;
          filter: grayscale(50%) contrast(110%);
        }
        .accordion-root:hover .accordion-panel {
          flex: 1 1 8%;
        }
        .accordion-root:hover .accordion-panel:hover {
          flex: 1 1 60%;
        }
        .accordion-root:hover .accordion-panel:hover .accordion-img {
          filter: grayscale(0%) contrast(100%);
        }
        .accordion-root:not(:hover) .accordion-panel {
          flex: 1 1 0%;
        }
      `}</style>
    </div>
  );
}

function BentoCard({ children, className = "", colSpan = 1, rowSpan = 1 }: { children: React.ReactNode; className?: string; colSpan?: number; rowSpan?: number }) {
  return (
    <div
      className={"bezel reveal-blur " + className}
      style={{
        gridColumn: "span " + colSpan,
        gridRow: "span " + rowSpan,
        minHeight: "100%",
      }}
    >
      <div
        className="bezel-inner h-full w-full"
        style={{
          padding: "clamp(1rem, 2vw, 1.75rem)",
          background: "var(--surface-elevated)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function BookGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function FeatureLink({ href, glyph, title, desc }: { href: string; glyph: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="reveal-up group flex flex-col gap-3 p-5 sm:p-6 no-underline transition-all duration-200 hover:-translate-y-0.5"
      style={{ border: "1px solid var(--rule)", borderRadius: "var(--radius-sharp)", background: "var(--surface-elevated)" }}
    >
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center w-8 h-8 rounded-md text-sm" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}>{glyph}</span>
        <h3 className="font-display font-bold text-base" style={{ color: "var(--ink)" }}>{title}</h3>
      </div>
      <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{desc}</p>
      <span className="mt-auto text-xs font-medium inline-flex items-center gap-1 transition-colors" style={{ color: "var(--accent)" }}>
        Explore
        <span className="transition-transform group-hover:translate-x-0.5">→</span>
      </span>
    </Link>
  );
}

function LiveStatsStrip() {
  // Pull from the shared React Query caches so all three stats share one
  // network round-trip and the home page stays in sync with the gaps/contested
  // dashboards.
  const { data: h } = useHealth();
  const { data: c } = useContestedClaims(100);
  const { data: g } = useAllGaps();

  const items = [
    { label: "Articles", value: h?.article_count },
    { label: "Contested claims", value: c?.claims?.length },
    { label: "Open questions", value: g?.gaps?.length },
  ].filter((i) => i.value != null);

  if (items.length === 0) return null;

  return (
    <div className="reveal-up mt-10 flex items-center justify-center gap-6 sm:gap-10">
      {items.map((i) => (
        <div key={i.label} className="text-center">
          <div className="font-display font-bold tabular-nums" style={{ color: "var(--ink)", fontSize: "clamp(1.5rem, 3vw, 2.25rem)" }}>
            {i.value}
          </div>
          <div className="text-[10px] font-medium uppercase tracking-[0.14em] mt-1" style={{ color: "var(--subtle)" }}>
            {i.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function Testimonial({ quote, name, role, seed }: { quote: string; name: string; role: string; seed: string }) {
  return (
    <div className="reveal-up flex flex-col gap-4 h-full">
      <blockquote className="text-base sm:text-lg leading-relaxed flex-1" style={{ fontFamily: "var(--font-serif)", color: "var(--ink-secondary)" }}>
        &ldquo;{quote}&rdquo;
      </blockquote>
      <div className="flex items-center gap-3 mt-auto">
        <img src={"https://picsum.photos/seed/" + seed + "/80/80"} alt="" className="w-10 h-10 rounded-md object-cover" style={{ filter: "grayscale(60%)" }} />
        <div>
          <div className="text-sm font-medium" style={{ color: "var(--ink)" }}>{name}</div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>{role}</div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  useScrollReveal();

  return (
    <main className="overflow-x-hidden w-full max-w-full pb-24 md:pb-0">
      <div className="fixed inset-0 pointer-events-none -z-10" style={{ background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(166,124,47,0.05) 0%, transparent 70%)" }} />

      {/* HERO — Cinematic Center */}
      <section className="relative flex items-center justify-center px-6" style={{ paddingTop: "calc(4.5rem + 2rem)", paddingBottom: "clamp(4rem, 10vw, 10rem)", minHeight: "95dvh" }}>
        <div className="max-w-6xl mx-auto text-center">
          <div className="reveal-blur flex justify-center mb-8">
            <EyebrowTag label="The Living Encyclopedia · 2026" />
          </div>
          <h1 className="reveal-blur font-display font-bold" style={{ fontSize: "clamp(3rem, 5vw, 5.5rem)", lineHeight: 1.05, letterSpacing: "-0.02em", color: "var(--ink)" }}>
            An encyclopedia written by
            <InlineImage seed="agent" label="AI agent" /> minds,
            <br className="hidden sm:block" />
            verified by evidence.
          </h1>
          <p className="reveal-blur mt-8 mx-auto max-w-3xl leading-relaxed" style={{ color: "var(--muted)", fontSize: "clamp(1rem, 1.5vw, 1.125rem)" }}>
            Truthseekers generates structured, evidence-grounded articles through a nine-stage epistemic pipeline. Every claim is sourced. Every source is checked.
          </p>
          <div className="reveal-blur mt-12 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link href="/chat/new" className="cta-bevel group w-full sm:w-auto">
              <span>Start researching</span>
              <span className="cta-bevel-icon" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </Link>
            <Link href="/articles" className="cta-bevel cta-bevel-light group w-full sm:w-auto">
              <span>Browse articles</span>
              <span className="cta-bevel-icon" style={{ background: "var(--ink)", color: "var(--surface)" }} aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </Link>
          </div>

          {/* Live stats */}
          <LiveStatsStrip />
        </div>
      </section>

      {/* TRUST BAR — Infinite Marquee */}
      <section className="py-8 border-y" style={{ borderColor: "var(--rule)" }}>
          <InfiniteMarquee items={["Veritas", "Groq", "Zhipu", "OpenAI", "DigitalOcean", "PostgreSQL", "Z.ai", "Firecrawl", "Tavily"]} speed={50} />
      </section>

      {/* INTEREST — BENTO GRID (gapless, dense) */}
      <section className="section-py px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16 sm:mb-20 md:mb-24">
            <div className="reveal-blur flex justify-center mb-6">
              <EyebrowTag label="Process · Nine stages" />
            </div>
            <h2 className="reveal-blur font-display font-bold" style={{ fontSize: "clamp(1.85rem, 3vw, 3rem)", lineHeight: 1.08, color: "var(--ink)" }}>
              How it works
            </h2>
            <p className="reveal-blur mt-5 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed" style={{ color: "var(--muted)" }}>
              Nine deterministic stages. No hallucination. Complete traceability.
            </p>
          </div>

          <div className="bento-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 grid-flow-dense gap-3 sm:gap-4" style={{ gridAutoRows: "minmax(170px, auto)" }}>
            {/* Card 1: Feature image — col-span-7 row-span-2 (was 3) */}
            <BentoCard colSpan={7} rowSpan={2} className="!p-0 relative overflow-hidden min-h-0">
              <div className="absolute inset-0 scale-fade-img">
                <img src="https://picsum.photos/seed/pipeline/1400/1000" alt="" className="w-full h-full object-cover" style={{ mixBlendMode: "luminosity", opacity: 0.85 }} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, var(--surface) 0%, transparent 65%)" }} />
              </div>
              <div className="relative p-5 sm:p-8 md:p-10 flex flex-col justify-end h-full">
                <div className="flex items-center gap-2 mb-3">
                  <span className="eyebrow !text-[9px]"><span className="eyebrow-dot" />Pipeline</span>
                </div>
                <h3 className="font-display font-bold text-xl sm:text-2xl mb-2" style={{ color: "var(--ink)", letterSpacing: "-0.01em" }}>Nine-stage epistemic process</h3>
                <p className="text-xs sm:text-sm leading-relaxed max-w-md" style={{ color: "var(--muted)" }}>From retrieval through scrutiny to final resolution. Each stage produces structured output that feeds the next.</p>
              </div>
            </BentoCard>

            {/* Card 2: Retrieve — col-span-5 (was 2) */}
            <BentoCard colSpan={5}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-display font-bold text-base sm:text-lg" style={{ color: "var(--ink)" }}>Retrieve</h3>
                <span className="eyebrow !text-[9px] !py-1">01</span>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>Sources are gathered and ranked by relevance and credibility.</p>
            </BentoCard>

            {/* Card 3: Scrutinize — col-span-5 (was 2) */}
            <BentoCard colSpan={5}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-display font-bold text-base sm:text-lg" style={{ color: "var(--ink)" }}>Scrutinize</h3>
                <span className="eyebrow !text-[9px] !py-1">02</span>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>Claims are decomposed, verified, and flagged for missing evidence.</p>
            </BentoCard>

            {/* Card 4: Keyboard first — col-span-5 row-span-2 (was 2) */}
            <BentoCard colSpan={5} rowSpan={2}>
              <div className="flex items-center gap-2 mb-3">
                <kbd className="px-1.5 py-0.5 rounded border text-xs font-mono" style={{ borderColor: "var(--rule)", background: "var(--surface)" }}>CMD</kbd>
                <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>+ K</span>
              </div>
              <h3 className="font-display font-bold text-base sm:text-lg mb-2" style={{ color: "var(--ink)" }}>Keyboard first</h3>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>Every action has a shortcut. Navigate, search, and edit without leaving the keys.</p>
            </BentoCard>

            {/* Card 5: Resolve — col-span-7 row-span-2 (was 3) */}
            <BentoCard colSpan={7} rowSpan={2}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-display font-bold text-base sm:text-lg" style={{ color: "var(--ink)" }}>Resolve</h3>
                <span className="eyebrow !text-[9px] !py-1">03</span>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed max-w-lg" style={{ color: "var(--muted)" }}>The final article is assembled, contradictions flagged, every claim links to its source.</p>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* DESIRE — Horizontal Accordion + GSAP Scroll */}
      <section className="py-16 sm:py-24 md:py-40 px-4 sm:px-6" style={{ background: "var(--surface)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="reveal-up font-display font-bold" style={{ fontSize: "clamp(1.75rem, 3vw, 2.75rem)", lineHeight: 1.1, color: "var(--ink)" }}>
              Explore the research
            </h2>
            <p className="reveal-up mt-4 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed" style={{ color: "var(--muted)" }}>
              Hover a panel to expand. Scroll the page to reveal.
            </p>
          </div>

          <HorizontalAccordion
            panels={[
              {
                title: "Historical Analysis",
                content: "Trace the fall of Constantinople through 47 primary sources and 12 modern historians.",
                image: "https://picsum.photos/seed/byzantine/800/600",
                seed: "byzantine",
              },
              {
                title: "Scientific Verification",
                content: "Quantum entanglement experiments replicated across 3 independent labs with full methodology.",
                image: "https://picsum.photos/seed/quantum/800/600",
                seed: "quantum",
              },
              {
                title: "Economic Modeling",
                content: "1970s stagflation re-examined with modern CPI adjustments and supply-chain data.",
                image: "https://picsum.photos/seed/economics/800/600",
                seed: "economics",
              },
              {
                title: "Cultural Synthesis",
                content: "Jazz evolution mapped across 80 years of recordings, venues, and migration patterns.",
                image: "https://picsum.photos/seed/jazz/800/600",
                seed: "jazz",
              },
            ]}
          />

          <div className="mt-12 sm:mt-16 grid md:grid-cols-2 gap-8">
            <div className="reveal-up">
              <h3 className="font-display font-bold text-lg sm:text-xl mb-4" style={{ color: "var(--ink)" }}>Source Transparency</h3>
              <p className="leading-relaxed" style={{ color: "var(--ink-secondary)" }}>
                Every generated article includes a complete citation graph. Click any claim to see the exact source, confidence score, and contradictory evidence.
              </p>
            </div>
            <div className="reveal-up">
              <h3 className="font-display font-bold text-lg sm:text-xl mb-4" style={{ color: "var(--ink)" }}>Iterative Refinement</h3>
              <p className="leading-relaxed" style={{ color: "var(--ink-secondary)" }}>
                Not satisfied? Trigger a refresh with new parameters. The pipeline re-runs with updated sources while preserving verified claims.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* LIVING ENCYCLOPEDIA — Evidence dashboards */}
      <section className="section-py px-6 border-t" style={{ borderColor: "var(--rule)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14 sm:mb-20">
            <div className="reveal-blur flex justify-center mb-6">
              <EyebrowTag label="Living Encyclopedia" />
            </div>
            <h2
              className="reveal-blur font-display font-bold"
              style={{ fontSize: "clamp(1.85rem, 3vw, 3rem)", lineHeight: 1.08, letterSpacing: "-0.02em", color: "var(--ink)" }}
            >
              Knowledge you can audit, not just read
            </h2>
            <p className="reveal-blur mt-5 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed" style={{ color: "var(--muted)" }}>
              Beyond polished articles, Truthseekers exposes the evidence underneath — what&apos;s contested, what&apos;s missing, and what&apos;s going stale.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <FeatureLink href="/claim-graph" glyph="◈" title="Claim Graph" desc="The global map of every claim, its evidence, and the contradictions between them." />
            <FeatureLink href="/contested" glyph="⚠" title="Contested Claims" desc="The most debated claims across the encyclopedia, ranked by contradiction level." />
            <FeatureLink href="/gaps" glyph="?" title="Open Questions" desc="Claims missing evidence. Upvote gaps and submit sources you&apos;ve found." />
            <FeatureLink href="/stale" glyph="↻" title="Stale Watch" desc="Articles whose evidence is aging. See what needs re-verification first." />
          </div>
        </div>
      </section>

      {/* TESTIMONIALS — Stacked Cards with GSAP */}
      <section className="section-py px-4 sm:px-6" style={{ background: "var(--surface-elevated)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14 sm:mb-20">
            <div className="reveal-blur flex justify-center mb-6">
              <EyebrowTag label="Researchers · 2026" />
            </div>
            <h2
              className="reveal-blur font-display font-bold"
              style={{ fontSize: "clamp(1.85rem, 3vw, 3rem)", lineHeight: 1.08, letterSpacing: "-0.02em", color: "var(--ink)" }}
            >
              What researchers say
            </h2>
            <p className="reveal-blur mt-5 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed" style={{ color: "var(--muted)" }}>
              Transparency isn't a feature. It's the foundation.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            <Testimonial
              quote="The transparency is remarkable. I can trace every claim back to its source."
              name="Mira K."
              role="Research analyst"
              seed="portrait1"
            />
            <Testimonial
              quote="It handles complex historical topics with nuance. The epistemic pipeline catches gaps I would miss."
              name="James R."
              role="Journalist, freelance"
              seed="portrait2"
            />
            <Testimonial
              quote="Finally, an AI tool that shows its work. Every stage is inspectable."
              name="Lin W."
              role="Data journalist"
              seed="portrait3"
            />
          </div>
        </div>
      </section>

      {/* ACTION — CTA */}
      <section className="section-py px-6 text-center border-t" style={{ borderColor: "var(--rule)" }}>
        <div className="max-w-2xl mx-auto">
          <div className="reveal-blur flex justify-center mb-6">
            <EyebrowTag label="Begin · No sign-up" />
          </div>
          <h2
            className="reveal-blur font-display font-bold"
            style={{ fontSize: "clamp(2rem, 1.5rem + 2.5vw, 3.25rem)", lineHeight: 1.06, letterSpacing: "-0.025em", color: "var(--ink)" }}
          >
            Start building the living encyclopedia
          </h2>
          <p className="reveal-blur mt-5 text-sm sm:text-base leading-relaxed" style={{ color: "var(--muted)" }}>
            No sign-up required. Open the chat and start researching any topic.
          </p>
          <div className="reveal-blur mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link href="/chat/new" className="cta-bevel group w-full sm:w-auto">
              <span>Start researching</span>
              <span className="cta-bevel-icon" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </Link>
            <Link href="/settings" className="cta-bevel cta-bevel-light group w-full sm:w-auto">
              <span>View settings</span>
              <span className="cta-bevel-icon" style={{ background: "var(--ink)", color: "var(--surface)" }} aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER — closing section of the living encyclopedia */}
      <AppFooter />

      <style jsx>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .reveal { opacity: 0; transition: opacity 0.8s ease-out; }
        .reveal.in-view { opacity: 1; }
        .reveal-up { opacity: 0; transform: translateY(40px); transition: opacity 0.8s ease-out, transform 0.8s ease-out; }
        .reveal-up.in-view { opacity: 1; transform: translateY(0); }
        .scrub-text { opacity: 0; transform: translateY(20px); transition: opacity 1s ease-out, transform 1s ease-out; }
        .scrub-text.in-view { opacity: 1; transform: translateY(0); }
        .stack-card { opacity: 0; transform: translateY(60px) scale(0.95); transition: opacity 0.6s ease-out, transform 0.6s ease-out; }
        .stack-card.in-view { opacity: 1; transform: translateY(0) scale(1); }
        .scale-fade-img { opacity: 0.3; transform: scale(0.85); transition: opacity 0.8s ease-out, transform 0.8s ease-out; }
        .scale-fade-img.in-view { opacity: 1; transform: scale(1); }
        :global(.bento-grid) { grid-auto-rows: 140px; }
        @media (min-width: 640px) { :global(.bento-grid) { grid-auto-rows: 220px; } }
        @media (min-width: 768px) { :global(.bento-grid) { grid-auto-rows: 280px; } }
      `}</style>
    </main>
  );
}