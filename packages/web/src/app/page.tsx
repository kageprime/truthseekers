"use client";

import { useEffect } from "react";
import Link from "next/link";

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
    document.querySelectorAll<HTMLElement>(".reveal, .reveal-up, .scrub-text, .stack-card, .scale-fade-img").forEach((el) => observer.observe(el));
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
      className={"stack-card reveal-up " + className}
      style={{
        gridColumn: "span " + colSpan,
        gridRow: "span " + rowSpan,
        border: "1px solid var(--rule)",
        borderRadius: "var(--radius-sharp)",
        padding: "clamp(1rem, 2vw, 2rem)",
        background: "var(--surface-elevated)",
        minHeight: "100%",
      }}
    >
      {children}
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
          <h1 className="reveal font-display font-bold" style={{ fontSize: "clamp(3rem, 5vw, 5.5rem)", lineHeight: 1.05, letterSpacing: "-0.02em", color: "var(--ink)" }}>
            An encyclopedia written by
            <InlineImage seed="agent" label="AI agent" /> minds,
            <br className="hidden sm:block" />
            verified by evidence.
          </h1>
          <p className="reveal scrub-text mt-8 mx-auto max-w-3xl leading-relaxed" style={{ color: "var(--muted)", fontSize: "clamp(1rem, 1.5vw, 1.125rem)" }}>
            Truthseekers generates structured, evidence-grounded articles through a nine-stage epistemic pipeline. Every claim is sourced. Every source is checked.
          </p>
          <div className="reveal mt-12 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link href="/chat/new" className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-white transition-all duration-150 w-full sm:w-auto" style={{ padding: "14px 32px", borderRadius: 4, background: "#111111" }}>
              Start researching
            </Link>
            <Link href="/articles" className="inline-flex items-center justify-center gap-1.5 px-6 py-3.5 sm:py-3 text-sm font-medium transition-all duration-150 w-full sm:w-auto" style={{ borderRadius: 4, border: "1px solid var(--rule)", color: "var(--ink-secondary)", background: "transparent" }}>
              Browse articles
            </Link>
          </div>
        </div>
      </section>

      {/* TRUST BAR — Infinite Marquee */}
      <section className="py-8 border-y" style={{ borderColor: "var(--rule)" }}>
        <InfiniteMarquee items={["Veritas", "Groq", "Zhipu", "OpenAI", "DigitalOcean", "MongoDB", "Z.ai", "Firecrawl", "Tavily"]} speed={50} />
      </section>

      {/* INTEREST — BENTO GRID (gapless, dense) */}
      <section className="py-16 sm:py-24 md:py-40 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="reveal-up font-display font-bold" style={{ fontSize: "clamp(1.75rem, 3vw, 2.75rem)", lineHeight: 1.1, color: "var(--ink)" }}>
              How it works
            </h2>
            <p className="reveal-up mt-4 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed" style={{ color: "var(--muted)" }}>
              Nine deterministic stages. No hallucination. Complete traceability.
            </p>
          </div>

          <div className="grid grid-cols-5 grid-flow-dense gap-3 sm:gap-4 bento-grid" style={{ background: "var(--rule)", borderRadius: "var(--radius-sharp)", overflow: "hidden" }}>
            {/* Card 1: Feature image — col-span-3 row-span-2 */}
            <BentoCard colSpan={3} rowSpan={2} className="!p-0 relative overflow-hidden min-h-0">
              <div className="absolute inset-0 scale-fade-img">
                <img src="https://picsum.photos/seed/pipeline/1200/900" alt="" className="w-full h-full object-cover" style={{ mixBlendMode: "luminosity", opacity: 0.85 }} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, var(--surface) 0%, transparent 60%)" }} />
              </div>
              <div className="relative p-4 sm:p-8 flex flex-col justify-end h-full">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "#E1F3FE", color: "#1F6C9F" }}>Pipeline</span>
                </div>
                <h3 className="font-display font-bold text-lg sm:text-xl mb-2" style={{ color: "var(--ink)" }}>Nine-stage epistemic process</h3>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>From retrieval through scrutiny to final resolution. Each stage produces structured output that feeds the next.</p>
              </div>
            </BentoCard>

            {/* Card 2: Retrieve — col-span-2 */}
            <BentoCard colSpan={2}>
              <h3 className="font-display font-bold text-base sm:text-lg mb-2" style={{ color: "var(--ink)" }}>Retrieve</h3>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>Sources are gathered and ranked by relevance and credibility.</p>
            </BentoCard>

            {/* Card 3: Scrutinize — col-span-2 */}
            <BentoCard colSpan={2}>
              <h3 className="font-display font-bold text-base sm:text-lg mb-2" style={{ color: "var(--ink)" }}>Scrutinize</h3>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>Claims are decomposed, verified, and flagged for missing evidence.</p>
            </BentoCard>

            {/* Card 4: Keyboard first — col-span-2 row-span-2 */}
            <BentoCard colSpan={2} rowSpan={2} className="!bg-[var(--gold-bg)] !border-[var(--gold)]/20">
              <div className="flex items-center gap-2 mb-3">
                <kbd className="px-1.5 py-0.5 rounded border text-xs font-mono" style={{ borderColor: "var(--rule)", background: "var(--surface)" }}>CMD</kbd>
                <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>+ K</span>
              </div>
              <h3 className="font-display font-bold text-base sm:text-lg mb-2" style={{ color: "var(--ink)" }}>Keyboard first</h3>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>Every action has a shortcut. Navigate, search, and edit without leaving the keys.</p>
            </BentoCard>

            {/* Card 5: Resolve — col-span-3 row-span-2 */}
            <BentoCard colSpan={3} rowSpan={2}>
              <h3 className="font-display font-bold text-base sm:text-lg mb-2" style={{ color: "var(--ink)" }}>Resolve</h3>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>The final article is assembled, contradictions flagged, every claim links to its source.</p>
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
              Interactive deep-dives. Hover to expand. Scroll to reveal.
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

      {/* TESTIMONIALS — Stacked Cards with GSAP */}
      <section className="py-16 sm:py-24 md:py-40 px-4 sm:px-6" style={{ background: "var(--surface-elevated)" }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="reveal-up font-display font-bold" style={{ fontSize: "clamp(1.75rem, 3vw, 2.75rem)", lineHeight: 1.1, color: "var(--ink)" }}>
              What researchers say
            </h2>
            <p className="reveal-up mt-4 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed" style={{ color: "var(--muted)" }}>
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
      <section className="py-16 sm:py-32 md:py-48 px-6 text-center border-t" style={{ borderColor: "var(--rule)" }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="reveal-up font-display font-bold" style={{ fontSize: "clamp(1.75rem, 4vw, 3.25rem)", lineHeight: 1.1, color: "var(--ink)" }}>
            Start building the living encyclopedia
          </h2>
          <p className="reveal-up mt-6 text-sm sm:text-base leading-relaxed" style={{ color: "var(--muted)" }}>
            No sign-up required. Open the chat and start researching any topic.
          </p>
          <div className="reveal-up mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link href="/chat/new" className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-white transition-all duration-150 w-full sm:w-auto" style={{ padding: "14px 36px", borderRadius: 4, background: "#111111" }}>
              Start researching
            </Link>
            <Link href="/settings" className="inline-flex items-center justify-center gap-1.5 px-6 py-3.5 sm:py-3 text-sm font-medium transition-all duration-150 w-full sm:w-auto" style={{ borderRadius: 4, border: "1px solid var(--rule)", color: "var(--ink-secondary)", background: "transparent" }}>
              Configure
            </Link>
          </div>
        </div>
      </section>

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