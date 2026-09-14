"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMap } from "../../hooks";
import PageLayout from "../../components/PageLayout";
import MarkdownRenderer from "../../components/MarkdownRenderer";
import InteractiveTimeline from "../../components/InteractiveTimeline";
import RetroWindow from "../../components/retro/RetroWindow";
import RetroMarkdown from "../../components/retro/RetroMarkdown";
import { IS_RETRO } from "@/lib/retro";
import type { MapEntry } from "@encarta/core";

const MapViewer = dynamic(() => import("../../components/MapViewer"), { ssr: false });

interface MapClientProps {
  slug: string;
  map: MapEntry | null;
}

export default function MapClient({ slug, map: initialMap }: MapClientProps) {
  const router = useRouter();
  const { data: fetched } = useMap(slug);
  const map: MapEntry | null = initialMap ?? fetched ?? null;

  if (!map) {
    const body = (
      <div className="px-6 py-12 sm:py-16 flex items-center justify-center">
        <div className="max-w-lg mx-auto text-center">
          <h1 className="font-display font-bold mb-3 capitalize" style={{ fontSize: "clamp(1.25rem, 2vw, 1.5rem)", color: "var(--ink)" }}>
            {slug.replace(/-/g, " ")}
          </h1>
          <p className="text-sm mb-2" style={{ color: "var(--subtle)" }}>Map not found</p>
          <p className="text-sm leading-relaxed mb-8 max-w-sm mx-auto" style={{ color: "var(--muted)" }}>
            This atlas entry does not exist yet.
          </p>
          <Link href="/maps" className="btn btn-primary btn-lg no-underline">
            Back to atlas
          </Link>
        </div>
      </div>
    );
    // ponytail: maps draw their own RetroWindow like articles — same data, retro chrome.
    if (IS_RETRO) {
      return (
        <RetroWindow title={`TruthSeekers — ${slug}`} path={`/maps/${slug}`} crumb={slug} status={`TruthSeekers • ${slug}`}>
          {body}
        </RetroWindow>
      );
    }
    return <PageLayout maxWidthClass="max-w-3xl">{body}</PageLayout>;
  }

  // ponytail: single geoJson becomes one layer — MapViewer only speaks layers.
  const layers = map.layers ?? (map.geoJson ? [{ id: "main", label: map.title, geoJson: map.geoJson, visible: true }] : []);
  const markers = map.markers ?? [];
  const hasMap = markers.length > 0 || layers.length > 0 || map.centerLat != null;
  const title = map.title || slug.replace(/-/g, " ");
  const deck = map.subtitle || map.description;

  if (IS_RETRO) {
    return (
      <RetroWindow title={`TruthSeekers — ${title}`} path={`/maps/${slug}`} crumb={title} status={`TruthSeekers • ${slug}`}>
        <div className="p-3 sm:p-4">
          <div className="text-[11px] font-bold text-[var(--r-muted)] uppercase tracking-wider">
            Atlas{map.region ? ` • ${map.region}` : ""}{map.era ? ` • ${map.era}` : ""}
          </div>
          <h1 className="r-h1 text-[24px] sm:text-[30px] mt-1">{title}</h1>
          {deck && <p className="text-[13px] text-[var(--r-ink-secondary)] mt-1 leading-relaxed">{deck}</p>}
          {map.type === "interactive" && (
            <span className="inline-block mt-2 text-[9px] px-1.5 py-0.5 bg-[var(--r-header-accent)] text-black font-bold rounded-sm border border-black/30">
              INTERACTIVE
            </span>
          )}
          {hasMap && (
            <div className="mt-3 border border-[var(--r-border)] rounded-[var(--r-radius)] overflow-hidden" style={{ height: "clamp(280px, 55vh, 480px)" }}>
              <MapViewer
                markers={markers}
                layers={layers}
                centerLat={map.centerLat}
                centerLng={map.centerLng}
                zoom={map.zoom}
                height="100%"
              />
            </div>
          )}
          {map.content && (
            <div className="mt-3 bg-[var(--r-surface-elevated)] border border-[var(--r-border)] rounded-[var(--r-radius)] p-4">
              <RetroMarkdown content={map.content} />
            </div>
          )}
          {markers.length > 0 && (
            <div className="mt-3 bg-[var(--r-surface-elevated)] border border-[var(--r-border)] rounded-[var(--r-radius)] p-3">
              <div className="text-[11px] font-bold text-[var(--r-muted)] uppercase tracking-wider mb-2">Markers ({markers.length})</div>
              <ul className="space-y-1.5">
                {markers.map((m, i) => (
                  <li key={i} className="text-[12px] text-[var(--r-ink)]">
                    <span className="font-bold">{m.title}</span>
                    {m.description && <span className="text-[var(--r-muted)]"> — {m.description}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(map.timeline?.length ?? 0) > 0 && (
            <div className="mt-3 bg-[var(--r-surface-elevated)] border border-[var(--r-border)] rounded-[var(--r-radius)] p-3">
              <div className="text-[11px] font-bold text-[var(--r-muted)] uppercase tracking-wider mb-2">Timeline</div>
              <ol className="space-y-1.5">
                {map.timeline!.map((t, i) => (
                  <li key={t.id ?? i} className="text-[12px] text-[var(--r-ink)]">
                    <span className="font-bold tabular-nums">{t.year}</span> — {t.event}
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div className="mt-3 flex items-center gap-3 text-[11px] text-[var(--r-muted)]">
            <Link href="/maps" className="hover:underline">← Back to atlas</Link>
            {map.externalUrl && <a href={map.externalUrl} target="_blank" rel="noreferrer" className="hover:underline">External source ↗</a>}
          </div>
        </div>
      </RetroWindow>
    );
  }

  return (
    <PageLayout maxWidthClass="max-w-[88rem]">
      <div className="w-full">
        <article className="px-4 sm:px-6 lg:px-10 pt-3 sm:pt-4 pb-6 sm:pb-8 w-full animate-appear-up">
          {/* Back link — gold badge with hover arrow */}
          <button
            onClick={() => router.back()}
            className="group inline-flex items-center gap-2 mb-4 no-underline cursor-pointer"
            style={{ color: "var(--muted)", background: "none", border: "none", padding: 0 }}
          >
            <span className="flex items-center justify-center w-7 h-7 rounded-full transition-all duration-500" style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)" }}>
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: "var(--accent)", transition: "transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)" }}
                className="group-hover:-translate-x-0.5"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </span>
            <span className="text-[11px] font-medium tracking-wide" style={{ letterSpacing: "0.06em" }}>Back to atlas</span>
          </button>

          {/* Masthead — natural-history plate: folio row, Didone headline,
              italic deck, double rule. */}
          <header className="plate-head">
            <div className="plate-folio">
              <span>/ maps{map.region ? ` / ${map.region}` : ""}</span>
              {map.era && <span>/ {map.era}</span>}
              {map.updatedAt && (
                <span>/ {new Date(map.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              )}
            </div>
            <h1 className="plate-title">
              {title}
            </h1>

            {deck && (
              <p className="plate-deck">
                {deck}
              </p>
            )}

            <div className="plate-rule" aria-hidden="true" />

            <div className="plate-controls">
              {map.type === "interactive" ? (
                <span className="plate-byline">◈ Interactive map</span>
              ) : (
                <span className="plate-byline">▤ Static plate</span>
              )}
              {map.externalUrl && (
                <>
                  <span className="plate-sep" aria-hidden="true">·</span>
                  <a href={map.externalUrl} target="_blank" rel="noreferrer" className="plate-byline hover:underline">
                    External source ↗
                  </a>
                </>
              )}
            </div>
          </header>

          {/* Hero map */}
          {hasMap ? (
            <div className="plate p-3 mb-4 overflow-hidden" style={{ height: "clamp(280px, 55vh, 480px)" }}>
              <MapViewer
                markers={markers}
                layers={layers}
                centerLat={map.centerLat}
                centerLng={map.centerLng}
                zoom={map.zoom}
                height="100%"
              />
            </div>
          ) : map.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={map.image} alt={title} className="plate mb-4 max-w-full" />
          ) : null}

          {/* Body — folio grid: text column plus margin rail */}
          <div className="folio-grid">
            <div className="stagger-children">
              {map.content && (
                <div style={{ fontSize: "0.9375rem", lineHeight: 1.75, color: "var(--ink)" }}>
                  <MarkdownRenderer content={map.content} />
                </div>
              )}
              {(map.timeline?.length ?? 0) > 0 && (
                <div className="plate p-3 mb-4 overflow-hidden">
                  <InteractiveTimeline events={map.timeline!.map((e) => ({ ...e, year: typeof e.year === "string" ? parseInt(e.year, 10) || 0 : e.year }))} />
                </div>
              )}
            </div>
            {/* Margin rail */}
            <aside className="folio-rail" aria-label="Map markers">
              {markers.length > 0 && (
                <div className="plate p-4">
                  <div className="dateline mb-2">Markers · {markers.length}</div>
                  <ul className="space-y-2">
                    {markers.map((m, i) => (
                      <li key={i} className="text-sm leading-snug" style={{ color: "var(--ink-secondary)" }}>
                        <span className="font-semibold" style={{ color: "var(--ink)" }}>{m.title}</span>
                        {m.description && <span> — {m.description}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        </article>
      </div>
    </PageLayout>
  );
}
