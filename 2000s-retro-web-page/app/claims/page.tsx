'use client'

import { ArrowLeft, Check, ChevronRight, CircleHelp, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'
import { fetchContestedClaims, searchClaims } from '@/lib/api'
import { useApi } from '@/hooks/use-api'
import { LiveBadge } from '@/components/data-states'
import { EvidenceForm } from '@/components/evidence-form'
import { SearchBar } from '@/components/search-bar'
import { SiteFooter } from '@/components/site-chrome'

const claims = [
  { id: 'C-001', label: 'The printing press accelerated literacy in Europe.', status: 'supported', detail: 'The claim is supported by multiple independent histories of book production and literacy rates.', sources: ['British Library', 'Oxford Research Encyclopedia', 'The Gutenberg Bible'], slug: null },
  { id: 'C-002', label: 'Movable type was invented in Europe.', status: 'needs context', detail: 'The European metal-type press was a major innovation, but movable type has earlier roots in China and Korea.', sources: ['National Museum of Korea', 'Song dynasty records'], slug: null },
  { id: 'C-003', label: 'More books always create better knowledge.', status: 'open question', detail: 'This is a value claim. More access can widen knowledge while also widening the circulation of error.', sources: ['Veritas editorial note'], slug: null },
]

function ClaimsInner() {
  type ClaimCard = { id: string; label: string; status: string; detail: string; sources: string[]; slug: string | null }
  const params = useSearchParams()
  const deepId = params.get('claim')
  const applied = useRef<string | null>(null)
  const [selected, setSelected] = useState<ClaimCard>(claims[0])
  const [query, setQuery] = useState('')
  // ponytail: live search + contested top-up; static 3 are the offline fallback.
  const search = useApi((signal) => searchClaims(query, 20, signal), `claims:search:${query}`)
  const contested = useApi((signal) => fetchContestedClaims(20, signal), 'claims:contested')
  const toCard = (c: { id: string; text: string; status: string; article_title?: string; article_slug?: string }): ClaimCard => ({
    id: c.id, label: c.text, status: c.status,
    detail: c.article_title ? `From “${c.article_title}”` : 'From the Veritas claim index.',
    sources: c.article_slug ? [c.article_slug] : ['Veritas index'],
    slug: c.article_slug ?? null,
  })
  const livePool = [...(search.data ?? []), ...(contested.data ?? [])].map(toCard)
  // ponytail: ?claim= deep link (from card hover) — apply once per id so the
  // per-render pool rebuild can't loop. Runs on stable fetch data only.
  useEffect(() => {
    if (!deepId || applied.current === deepId) return
    const hit = [...(search.data ?? []), ...(contested.data ?? [])].find((c) => c.id === deepId)
    if (hit) {
      applied.current = deepId
      setSelected(toCard(hit))
      setQuery('')
    }
  }, [deepId, search.data, contested.data])
  const pool = livePool.length > 0 ? livePool : claims
  const shown = pool.filter((claim) => claim.label.toLowerCase().includes(query.toLowerCase()))
  const live = livePool.length > 0
  return <main className="min-h-screen bg-paper text-ink"><header className="border-b border-ink/15 bg-coral px-5 py-5 md:px-10"><div className="mx-auto flex max-w-[1400px] items-center justify-between"><Link href="/" className="flex items-center gap-2 font-mono text-[10px] uppercase"><ArrowLeft size={14} /> Everything / Encyclopedia</Link><span className="flex items-center gap-2 font-mono text-[10px] uppercase">Veritas / Claim traversal <LiveBadge live={live} /></span></div></header><div className="mx-auto max-w-[1400px] border-x border-ink/10"><section className="border-b border-ink/10 px-5 py-14 md:px-12 md:py-24"><div className="max-w-4xl"><p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-coral"><Sparkles size={13} /> Veritas, the evidence guide</p><h1 className="mt-5 font-sans text-6xl font-bold leading-[.86] tracking-[-.085em] md:text-[9rem]">Don&apos;t just<br /><span className="text-coral">believe.</span><br />traverse.</h1><p className="mt-10 max-w-2xl font-serif text-2xl leading-tight md:text-3xl">Ask what a claim depends on, who supports it, where it breaks, and what would change your mind.</p></div></section><section className="grid min-h-[620px] lg:grid-cols-[.85fr_1.15fr]"><div className="border-b border-ink/10 p-5 md:p-10 lg:border-b-0 lg:border-r"><SearchBar label="Find a claim" placeholder="Find a claim" value={query} onChange={setQuery} /><div className="mt-8 space-y-2">{shown.map((claim) => <button key={claim.id} onClick={() => setSelected(claim)} className={`w-full border p-4 text-left transition-colors ${selected.id === claim.id ? 'border-coral bg-coral' : 'border-ink/15 hover:bg-ink/5'}`}><div className="flex items-center justify-between font-mono text-[10px] uppercase"><span>{claim.id}</span><span>{claim.status}</span></div><p className="mt-4 font-serif text-xl leading-tight">{claim.label}</p></button>)}</div><button className="mt-8 flex w-full items-center justify-center gap-2 border border-ink py-4 font-mono text-[10px] uppercase hover:bg-coral"><CircleHelp size={14} /> Ask Veritas about a new claim</button></div><div className="relative overflow-hidden bg-ink p-5 text-paper md:p-10"><div className="absolute right-8 top-8 font-mono text-[10px] uppercase text-paper/45">Live evidence graph / 3 nodes</div><div className="relative mx-auto mt-12 max-w-xl"><div className="absolute left-[25%] top-[105px] h-px w-[52%] rotate-[-18deg] bg-coral/60" /><div className="absolute left-[25%] top-[125px] h-px w-[55%] rotate-[18deg] bg-coral/60" /><div className="absolute left-[44%] top-[210px] h-[150px] w-px bg-coral/60" /><div className="relative z-10 mx-auto flex h-48 w-48 flex-col items-center justify-center rounded-full border-2 border-coral bg-ink p-5 text-center shadow-[0_0_60px_rgba(255,77,63,.18)]"><ShieldCheck className="mb-3 text-coral" size={28} /><span className="font-mono text-[10px] uppercase text-coral">Selected claim</span><strong className="mt-2 font-serif text-xl leading-tight">{selected.label}</strong></div><div className="relative z-10 mt-24 grid grid-cols-2 gap-8"><div className="border border-paper/30 bg-ink p-4"><div className="flex items-center gap-2 font-mono text-[10px] uppercase text-coral"><Check size={13} /> Evidence</div><p className="mt-3 font-serif text-lg">{selected.sources[0]}</p><p className="mt-2 font-mono text-[10px] uppercase text-paper/50">Supports / primary</p></div><div className="border border-paper/30 bg-ink p-4"><div className="flex items-center gap-2 font-mono text-[10px] uppercase text-coral"><ChevronRight size={13} /> Context</div><p className="mt-3 font-serif text-lg">Earlier precedents</p><p className="mt-2 font-mono text-[10px] uppercase text-paper/50">Complicates / historical</p></div></div></div><div className="mt-14 border-t border-paper/20 pt-6"><p className="font-mono text-[10px] uppercase text-coral">Veritas&apos; reading</p><p className="mt-3 max-w-2xl font-serif text-xl leading-relaxed text-paper/80">{selected.detail}</p><div className="mt-6 flex flex-wrap gap-3">{selected.sources.map((source) => <span key={source} className="flex items-center gap-2 border border-paper/20 px-3 py-2 font-mono text-[10px] uppercase text-paper/60"><ExternalLink size={12} /> {source}</span>)}</div>{selected.slug && <Link href={`/articles/${selected.slug}`} className="mt-6 inline-block border border-coral px-4 py-2 font-mono text-[10px] uppercase text-coral hover:bg-coral hover:text-ink">Read the article →</Link>}<EvidenceForm claimId={selected.id} /></div></div></section></div><SiteFooter><Link href="/articles" className="font-mono text-[10px] uppercase text-coral">Browse articles →</Link></SiteFooter></main>
}

// ponytail: useSearchParams needs a Suspense boundary or the build fails.
export default function ClaimsPage() {
  return <Suspense><ClaimsInner /></Suspense>
}
