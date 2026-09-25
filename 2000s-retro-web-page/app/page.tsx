'use client'

import { ArrowUpRight, BookOpen, Compass, Network, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { fetchArticles, fetchFeaturedArticles, fetchHealth, searchArticles } from '@/lib/api'
import { useApi } from '@/hooks/use-api'
import { LiveBadge } from '@/components/data-states'
import { SearchBar } from '@/components/search-bar'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { Skeleton } from '@/components/ui/skeleton'

const entries = [
  { number: '001', title: 'The printing press', type: 'Invention', description: 'How movable type turned language into a mass medium.', href: '/article' },
  { number: '002', title: 'The Silk Roads', type: 'Network', description: 'A map of exchange, movement, and unexpected connections.', href: '/maps' },
  { number: '003', title: 'The claim graph', type: 'Method', description: 'Trace an idea back to its evidence and forward to its consequences.', href: '/claims' },
]

export default function Home() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const live = useApi((signal) => searchArticles(query, signal), `search:${query}`)
  const health = useApi((signal) => fetchHealth(signal), 'health')
  const latest = useApi((signal) => fetchArticles(9, 0, signal), 'home:latest')
  const featured = useApi((signal) => fetchFeaturedArticles(signal), 'home:featured')
  // ponytail: live search augments static index; offline → static only.
  const liveCards = (latest.data?.data ?? []).map((a, i) => ({
    number: String(i + 1).padStart(3, '0'),
    title: a.title,
    type: a.categories?.[0] ?? 'Article',
    description: a.abstract ?? '',
    href: `/articles/${a.slug}`,
  }))
  const pool = liveCards.length > 0 ? liveCards : entries
  // ponytail: skeletons on first load, never demo cards; static only offline.
  const isLoading = liveCards.length === 0 && latest.loading
  const filtered = pool.filter((entry) => `${entry.title} ${entry.type}`.toLowerCase().includes(query.toLowerCase()))
  const feat = (featured.data?.[0] ?? latest.data?.data?.[0] ?? null) as { slug: string; title: string; abstract: string } | null
  const count = health.data?.article_count
  const goQuery = () => {
    const slug = query.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    if (slug) router.push(`/articles/${slug}`)
  }
  const surprise = () => {
    if (!filtered.length) return
    const pick = filtered[Math.floor(Math.random() * filtered.length)]
    router.push(pick.href)
  }
  return <main className="min-h-screen bg-paper text-ink">
    <SiteHeader kicker={count != null ? `${count} verified entries — a living index of people, places, ideas & things` : undefined} />
    <section className="mx-auto grid max-w-[1400px] gap-10 border-x border-ink/10 px-5 py-16 md:grid-cols-[1.2fr_.8fr] md:px-12 md:py-28"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-coral">Issue 01 / The world is connected</p><h1 className="mt-5 max-w-4xl font-sans text-7xl font-bold leading-[.82] tracking-[-.09em] md:text-[10rem]">A place to<br /><span className="text-coral">follow</span><br />ideas.</h1><p className="mt-10 max-w-xl font-serif text-2xl leading-tight md:text-3xl">Everything is an encyclopedia for curious people: readable articles, explorable maps, and evidence you can inspect.</p><SearchBar label="Search the encyclopedia" placeholder="Search the index" value={query} onChange={setQuery} onEnter={goQuery} className="mt-10 max-w-xl" /></div><div className="flex flex-col justify-end border-l border-ink/15 pl-6 md:pl-10"><p className="font-mono text-[10px] uppercase leading-relaxed text-muted">Not a database dump.<br />A guided way through knowledge.</p><div className="mt-12 grid gap-3">{[[BookOpen, 'Read slowly', 'Long-form articles with context'], [Compass, 'See the shape', 'Maps for movement and place'], [Network, 'Check the chain', 'Claims linked to evidence']].map(([Icon, title, text]) => <div key={title as string} className="flex gap-4 border-t border-ink/15 pt-4"><Icon size={19} className="mt-1 text-coral" /><div><h2 className="font-serif text-xl">{title as string}</h2><p className="mt-1 font-mono text-[10px] uppercase text-muted">{text as string}</p></div></div>)}</div></div></section>
    {feat && <section className="mx-auto max-w-[1400px] border-x border-ink/10 px-5 py-12 md:px-12 md:py-20"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-coral">Editor&apos;s feature / live</p><Link href={`/articles/${feat.slug}`} className="mt-4 block max-w-4xl font-sans text-5xl font-bold leading-[.9] tracking-[-.06em] hover:text-coral md:text-7xl">{feat.title}</Link><p className="mt-6 max-w-2xl font-serif text-xl italic leading-relaxed text-muted">{feat.abstract?.slice(0, 240)}</p><Link href={`/articles/${feat.slug}`} className="mt-6 inline-block font-mono text-[11px] uppercase underline">Read the verified article →</Link></section>}
    <section id="entries" className="mx-auto max-w-[1400px] border-x border-t border-ink/10 px-5 py-12 md:px-12 md:py-20"><div className="mb-10 flex items-end justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-coral">Browse the index</p><h2 className="mt-2 font-sans text-5xl font-bold tracking-[-.07em] md:text-7xl">Start anywhere.</h2></div><span className="flex items-center gap-3 font-mono text-[10px] uppercase text-muted">{filtered.length} entries shown <LiveBadge live={(live.data?.length ?? 0) > 0} />{filtered.length > 1 && <button onClick={surprise} className="underline hover:text-coral">Surprise me →</button>}</span></div>{isLoading ? <div aria-label="Loading index" className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="border border-ink/20 p-5"><Skeleton className="h-3 w-20 bg-ink/10" /><Skeleton className="mt-16 h-7 w-3/4 bg-ink/10" /><Skeleton className="mt-4 h-4 w-full bg-ink/10" /></div>)}</div> : <div className="grid gap-4 md:grid-cols-3">{filtered.map((entry) => <Link key={entry.number} href={entry.href} className="group border border-ink/20 p-5 transition-colors hover:bg-coral"><div className="flex justify-between font-mono text-[10px] uppercase text-muted group-hover:text-ink"><span>{entry.number} / {entry.type}</span><ArrowUpRight size={14} /></div><h3 className="mt-6 font-serif text-2xl leading-tight">{entry.title}</h3><p className="mt-2 line-clamp-2 font-serif text-sm leading-relaxed text-muted group-hover:text-ink">{entry.description}</p></Link>)}</div>}{(live.data?.length ?? 0) > 0 && <div className="mt-8 border-t border-ink/10 pt-6"><p className="font-mono text-[10px] uppercase tracking-[0.16em] text-coral">Live from Veritas</p><div className="mt-4 space-y-2">{live.data!.slice(0, 5).map((a) => <Link key={a.slug} href={`/articles/${a.slug}`} className="block font-serif text-xl hover:text-coral">{a.title}</Link>)}</div></div>}{filtered.length === 0 && !(live.data?.length) && <p className="font-serif text-xl">No entry found. Try another route through the index.</p>}</section>
    <SiteFooter blurb="Built for the permanently curious. No ads, no rankings, no final answers."><Link href="/claims" className="flex items-center gap-2 font-mono text-[10px] uppercase text-coral">Meet Veritas <Sparkles size={14} /></Link></SiteFooter>
  </main>
}
