"use client";

import { useEffect } from "react";
import Link from "next/link";

function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll<HTMLElement>(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

function InlineImage({ seed, label }: { seed: string; label: string }) {
  return (
    <span
      className="inline-block align-middle mx-1 rounded-full overflow-hidden shrink-0"
      style={{ width: 48, height: 22, verticalAlign: "middle" }}
      aria-label={label}
    >
      <img src={"https://picsum.photos/seed/" + seed + "/200/80"} alt="" className="w-full h-full object-cover" />
    </span>
  );
}

function Marquee({ items }: { items: string[] }) {
  const doubled = [...items, ...items];
  return (
    <div className="overflow-hidden relative" style={{ maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)" }}>
      <div className="flex animate-marquee whitespace-nowrap">
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-center mx-8 text-xs tracking-[0.15em] uppercase font-medium" style={{ color: "var(--subtle)" }}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function BentoCard({ children, className = "", colSpan = 1, rowSpan = 1 }: { children: React.ReactNode; className?: string; colSpan?: number; rowSpan?: number }) {
  return (
    <div
      className={"reveal " + className}
      style={{
        gridColumn: "span " + colSpan,
        gridRow: "span " + rowSpan,
        border: "1px solid var(--rule)",
        borderRadius: 8,
        padding: "clamp(1rem, 2vw, 2rem)",
        background: "var(--surface-elevated)",
      }}
    >
      {children}
    </div>
  );
}

function Testimonial({ quote, name, role, seed }: { quote: string; name: string; role: string; seed: string }) {
  return (
    <div className="reveal flex flex-col gap-4">
      <blockquote className="text-base sm:text-lg leading-relaxed" style={{ fontFamily: "var(--font-serif)", color: "var(--ink-secondary)" }}>
        &ldquo;{quote}&rdquo;
      </blockquote>
      <div className="flex items-center gap-3">
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
      <div className="fixed inset-0 pointer-events-none -z-10" style={{ background: "radial-gradient(circle at 50% 0%, rgba(166,124,47,0.03) 0%, transparent 60%)" }} />

      <section className="relative flex items-center justify-center px-6" style={{ paddingTop: "calc(4.5rem + 2rem)", paddingBottom: "clamp(3rem, 8vw, 8rem)", minHeight: "90dvh" }}>
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="reveal font-serif font-bold" style={{ fontSize: "clamp(2rem, 4vw, 4.5rem)", lineHeight: 1.1, letterSpacing: "-0.03em", color: "var(--ink)" }}>
            An encyclopedia written by
            <InlineImage seed="agent" label="AI agent" /> minds,
            <br className="hidden sm:block" />
            verified by evidence.
          </h1>
          <p className="reveal mt-6 mx-auto max-w-xl leading-relaxed" style={{ color: "var(--muted)", fontSize: "clamp(0.9375rem, 1.25vw, 1.0625rem)" }}>
            Truthseekers generates structured, evidence-grounded articles through a nine-stage epistemic pipeline. Every claim is sourced. Every source is checked.
          </p>
          <div className="reveal mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link href="/chat/new" className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-white transition-all duration-150 w-full sm:w-auto" style={{ padding: "12px 24px", borderRadius: 4, background: "#111111" }}>
              Start researching
            </Link>
            <Link href="/articles" className="inline-flex items-center justify-center gap-1.5 px-5 py-3 sm:py-2.5 text-sm font-medium transition-all duration-150 w-full sm:w-auto" style={{ borderRadius: 4, border: "1px solid var(--rule)", color: "var(--ink-secondary)", background: "transparent" }}>
              Browse articles
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 border-y" style={{ borderColor: "var(--rule)" }}>
        <Marquee items={["Veritas", "Groq", "Zhipu", "OpenAI", "DigitalOcean", "MongoDB", "Z.ai"]} />
      </section>

      <section className="py-16 sm:py-24 md:py-32 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="reveal font-serif font-bold text-center mb-10 sm:mb-16" style={{ fontSize: "clamp(1.5rem, 3vw, 2.5rem)", lineHeight: 1.1 }}>
            How it works
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 auto-rows-auto" style={{ gap: 1, background: "var(--rule)", borderRadius: 8, overflow: "hidden" }}>
            <BentoCard colSpan={2} rowSpan={2} className="!p-0 relative overflow-hidden min-h-[250px] sm:min-h-[400px]">
              <div className="absolute inset-0">
                <img src="https://picsum.photos/seed/pipeline/800/600" alt="" className="w-full h-full object-cover" style={{ mixBlendMode: "luminosity", opacity: 0.85 }} />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, var(--surface) 0%, transparent 60%)" }} />
              </div>
              <div className="relative p-4 sm:p-8 flex flex-col justify-end h-full">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: "#E1F3FE", color: "#1F6C9F" }}>Pipeline</span>
                </div>
                <h3 className="font-serif font-bold text-lg sm:text-xl mb-2" style={{ color: "var(--ink)" }}>Nine-stage epistemic process</h3>
                <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>From retrieval through scrutiny to final resolution. Each stage produces structured output that feeds the next.</p>
              </div>
            </BentoCard>

            <BentoCard>
              <h3 className="font-serif font-bold text-base sm:text-lg mb-2" style={{ color: "var(--ink)" }}>Retrieve</h3>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>Sources are gathered and ranked by relevance and credibility.</p>
            </BentoCard>

            <BentoCard>
              <h3 className="font-serif font-bold text-base sm:text-lg mb-2" style={{ color: "var(--ink)" }}>Scrutinize</h3>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>Claims are decomposed, verified, and flagged for missing evidence.</p>
            </BentoCard>

            <BentoCard colSpan={2} className="!bg-[#E1F3FE] !border-[#1F6C9F]/20">
              <div className="flex items-center gap-2 mb-3">
                <kbd className="px-1.5 py-0.5 rounded border text-xs font-mono" style={{ borderColor: "var(--rule)", background: "var(--surface)" }}>CMD</kbd>
                <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>+ K</span>
              </div>
              <h3 className="font-serif font-bold text-base sm:text-lg mb-2" style={{ color: "var(--ink)" }}>Keyboard first</h3>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>Every action has a shortcut. Navigate, search, and edit without leaving the keys.</p>
            </BentoCard>

            <BentoCard colSpan={2}>
              <h3 className="font-serif font-bold text-base sm:text-lg mb-2" style={{ color: "var(--ink)" }}>Resolve</h3>
              <p className="text-xs sm:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>The final article is assembled, contradictions flagged, every claim links to its source.</p>
            </BentoCard>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 md:py-32 px-4 sm:px-6" style={{ background: "var(--surface)" }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="reveal font-serif font-bold text-center mb-10 sm:mb-16" style={{ fontSize: "clamp(1.5rem, 3vw, 2.5rem)", lineHeight: 1.1 }}>
            What researchers say
          </h2>
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

      <section className="py-16 sm:py-32 px-6 text-center border-t" style={{ borderColor: "var(--rule)" }}>
        <div className="max-w-2xl mx-auto">
          <h2 className="reveal font-serif font-bold mb-6" style={{ fontSize: "clamp(1.5rem, 3.5vw, 3rem)", lineHeight: 1.1 }}>
            Start building the living encyclopedia
          </h2>
          <p className="reveal mb-10 text-sm sm:text-base leading-relaxed" style={{ color: "var(--muted)" }}>
            No sign-up required. Open the chat and start researching any topic.
          </p>
          <div className="reveal flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link href="/chat/new" className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-white transition-all duration-150 w-full sm:w-auto" style={{ padding: "12px 28px", borderRadius: 4, background: "#111111" }}>
              Start researching
            </Link>
            <Link href="/settings" className="inline-flex items-center justify-center gap-1.5 px-5 py-3 sm:py-2.5 text-sm font-medium transition-all duration-150 w-full sm:w-auto" style={{ borderRadius: 4, border: "1px solid var(--rule)", color: "var(--ink-secondary)", background: "transparent" }}>
              Configure
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
