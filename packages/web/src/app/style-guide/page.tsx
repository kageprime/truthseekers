import Link from "next/link";
import Fleuron from "../components/editorial/Fleuron";
import DropCap from "../components/editorial/DropCap";
import PullQuote from "../components/editorial/PullQuote";
import FigurePlate from "../components/editorial/FigurePlate";
import { CATEGORIES, default as CategoryIcon } from "../components/editorial/CategoryIcon";

export const metadata = { title: "Style Guide — Truthseekers" };

const PALETTE = [
  ["--surface", "Aged paper"],
  ["--surface-elevated", "Plate"],
  ["--ink", "Ink"],
  ["--ink-secondary", "Ink secondary"],
  ["--muted", "Muted"],
  ["--gold", "Gold (accent)"],
  ["--gold-soft", "Gold soft"],
  ["--gold-bg", "Gold fill"],
  ["--oxblood", "Oxblood"],
  ["--forest", "Forest"],
  ["--rule", "Rule"],
];

const TYPE_SCALE = [
  { cls: "t-display t-display-1", label: "Display 1", sample: "The Living Encyclopedia" },
  { cls: "t-display t-display-2", label: "Display 2", sample: "On This Day" },
  { cls: "t-title", label: "Title", sample: "The Fall of Constantinople" },
  { cls: "t-body", label: "Body (serif)", sample: "The capital of the Eastern Roman Empire fell on the twenty-ninth of May." },
  { cls: "small-caps", label: "Small Caps", sample: "VOL. I · LIVING EDITION" },
];

export default function StyleGuidePage() {
  return (
    <main className="relative" style={{ background: "var(--surface)", zIndex: 1 }}>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="dateline hover:underline" style={{ color: "var(--gold)" }}>← Back to Truthseekers</Link>

        <header className="mt-8 mb-12 text-center">
          <h1 className="t-display t-display-1 mb-2" style={{ color: "var(--ink)" }}>Design Language</h1>
          <p className="t-body italic" style={{ color: "var(--muted)" }}>
            The visual contract for Truthseekers — editorial hybrid, antique gold &amp; ink.
          </p>
          <div className="masthead-rule mx-auto mt-6" style={{ width: "60%" }} />
        </header>

        {/* Palette */}
        <Section title="Palette">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PALETTE.map(([token, name]) => (
              <div key={token} className="plate p-3">
                <div className="h-12 rounded-sharp mb-2" style={{ background: `var(${token})`, border: "1px solid var(--rule)" }} />
                <div className="font-ui text-xs font-semibold" style={{ color: "var(--ink)" }}>{name}</div>
                <code className="font-mono text-[10px]" style={{ color: "var(--subtle)" }}>{token}</code>
              </div>
            ))}
          </div>
        </Section>

        {/* Typography */}
        <Section title="Type Scale">
          <div className="space-y-5">
            {TYPE_SCALE.map((row) => (
              <div key={row.label}>
                <div className="dateline mb-1">{row.label}</div>
                <div className={row.cls} style={{ color: "var(--ink)" }}>{row.sample}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Buttons */}
        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn btn-primary">Primary</button>
            <button className="btn btn-secondary">Secondary</button>
            <button className="btn btn-ghost">Ghost</button>
            <button className="btn btn-primary btn-sm">Small</button>
            <button className="btn btn-primary btn-lg">Large</button>
          </div>
        </Section>

        {/* Editorial primitives */}
        <Section title="Editorial Primitives">
          <div className="space-y-6">
            <div>
              <div className="dateline mb-2">Drop Cap</div>
              <DropCap>The year was 1453, and the Ottoman cannon roared against the Theodosian Walls. For fifty-three days the defenders held.</DropCap>
            </div>
            <div>
              <div className="dateline mb-2">Pull Quote</div>
              <PullQuote cite="A reader">A library is a hospital for the mind, and an encyclopedia is its triage desk.</PullQuote>
            </div>
            <div>
              <div className="dateline mb-2">Figure Plate</div>
              <FigurePlate num={1} caption="The Theodosian Walls of Constantinople, as they stood in the fifteenth century.">
                <div className="h-32 flex items-center justify-center" style={{ background: "linear-gradient(135deg, var(--gold-bg), var(--surface))", color: "var(--gold)" }}>
                  [plate media]
                </div>
              </FigurePlate>
            </div>
            <div>
              <div className="dateline mb-2">Fleuron Divider</div>
              <Fleuron />
            </div>
            <div>
              <div className="dateline mb-2">See Also</div>
              <div className="see-also">
                <span className="see-also-label">See also:</span>{" "}
                <Link href="#">Byzantine Empire</Link>, <Link href="#">Mehmed II</Link>, <Link href="#">Theodosian Walls</Link>
              </div>
            </div>
          </div>
        </Section>

        {/* Categories */}
        <Section title="Categories">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {CATEGORIES.map((cat) => (
              <div key={cat.slug} className="plate p-3 flex items-center gap-3">
                <CategoryIcon slug={cat.slug} size={22} />
                <div>
                  <div className="font-display text-sm" style={{ color: "var(--ink)" }}>{cat.label}</div>
                  <code className="font-mono text-[10px]" style={{ color: "var(--subtle)" }}>{cat.slug}</code>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Cards */}
        <Section title="Plates (cards)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <article className="plate p-0 overflow-hidden">
              <div className="h-24" style={{ background: "linear-gradient(135deg, var(--gold-bg), var(--surface))" }} />
              <div className="p-4">
                <h3 className="font-display text-base" style={{ color: "var(--ink)" }}>Plate card</h3>
                <p className="font-serif text-sm" style={{ color: "var(--muted)" }}>Sharp 2px radius, hairline rule, gold hover.</p>
              </div>
            </article>
            <div className="glass-card p-4">
              <div className="dateline mb-2">glass-card (compat)</div>
              <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>Older surfaces still render via the alias.</p>
            </div>
          </div>
        </Section>

        <Fleuron />
        <p className="text-center font-serif text-sm italic" style={{ color: "var(--muted)" }}>
          End of the design language.
        </p>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="t-title mb-4" style={{ fontSize: "1.25rem", color: "var(--ink)" }}>
        <span className="dateline" style={{ color: "var(--gold)", marginRight: "0.5rem" }}>§</span>
        {title}
      </h2>
      <div className="masthead-rule mb-6" style={{ width: "100%" }} />
      {children}
    </section>
  );
}
