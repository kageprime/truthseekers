'use client'

import { ArrowLeft, ArrowUpRight, Filter } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { fetchArticles, searchArticles } from '@/lib/api'
import { useApi } from '@/hooks/use-api'
import { ErrorRow, LiveBadge } from '@/components/data-states'
import { SearchBar } from '@/components/search-bar'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { ClaimHover } from '@/components/claim-hover'
import { Skeleton } from '@/components/ui/skeleton'

const articles = [
  { number: '001', title: 'The printing press', type: 'Invention', year: 'c. 1440', description: 'How movable type turned language into a mass medium.', color: 'bg-coral', href: '/article' },
  { number: '002', title: 'The Silk Roads', type: 'Network', year: '130 BCE—1500', description: 'A map of exchange, movement, and unexpected connections.', color: 'bg-[#c9d7c2]', href: '/maps' },
  { number: '003', title: 'Why claims travel', type: 'Method', year: 'Today', description: 'A field guide to tracing ideas back to their evidence.', color: 'bg-[#d9c8df]', href: '/claims' },
  { number: '004', title: 'The library', type: 'Institution', year: 'c. 260 BCE', description: 'What Alexandria imagined when it tried to collect the world.', color: 'bg-[#e6d6ac]', href: '/article' },
  { number: '005', title: 'Maps are arguments', type: 'Idea', year: 'Today', description: 'Every map chooses what to show, measure, and leave out.', color: 'bg-[#bcd6df]', href: '/maps' },
  { number: '006', title: 'A short history of doubt', type: 'Practice', year: 'Ancient—now', description: 'Skepticism is not cynicism. It is a tool for seeing clearly.', color: 'bg-[#dfc3b6]', href: '/claims' },
]

// ponytail: rotating card colors keep the retro wall alive on live data.
const CARD_COLORS = ['bg-coral', 'bg-[#c9d7c2]', 'bg-[#d9c8df]', 'bg-[#e6d6ac]', 'bg-[#bcd6df]', 'bg-[#dfc3b6]']

export default function ArticlesPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All')
  // ponytail: skeletons while loading (never demo cards); static cards are
  // the offline fallback only, shown with the offline badge + retry.
  const list = useApi((signal) => fetchArticles(50, 0, signal), 'articles:list')
  const search = useApi((signal) => searchArticles(query, signal), `articles:search:${query}`)
  const liveCards = (query.trim() ? search.data ?? [] : list.data?.data ?? []).map((a, i) => ({
    number: String(i + 1).padStart(3, '0'),
    title: a.title,
    type: a.categories?.[0] ?? 'Article',
    description: a.abstract ?? '',
    color: CARD_COLORS[i % CARD_COLORS.length],
    href: `/articles/${a.slug}`,
    slug: a.slug,
  }))
  const isLoading = liveCards.length === 0 && (query.trim() ? search.loading : list.loading)
  const pool = liveCards.length > 0 ? liveCards : articles
  const types = ['All', ...Array.from(new Set(pool.map((article) => article.type)))]
  const visible = pool.filter((article) => `${article.title} ${article.description} ${article.type}`.toLowerCase().includes(query.toLowerCase()) && (filter === 'All' || article.type === filter))
  const live = liveCards.length > 0
  return <main className="min-h-screen bg-paper text-ink">
    <SiteHeader kicker="Articles for the permanently curious" />
    <div className="mx-auto max-w-[1400px] border-x border-ink/10"><section className="border-b border-ink/10 px-5 py-14 md:px-12 md:py-24"><Link href="/" className="flex items-center gap-2 font-mono text-[10px] uppercase"><ArrowLeft size={13} /> Back to index</Link><div className="mt-16 grid gap-10 md:grid-cols-[1.1fr_.9fr] md:items-end"><div><p className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[.16em] text-coral">The reading room / {String(visible.length).padStart(3, '0')} entries <LiveBadge live={live} /></p>{!isLoading && liveCards.length === 0 && <div className="mt-3"><ErrorRow onRetry={() => { list.refetch(); search.refetch() }} /></div>}<h1 className="mt-4 font-sans text-7xl font-bold leading-[.82] tracking-[-.09em] md:text-[10rem]">Read<br /><span className="text-coral">widely.</span></h1></div><p className="max-w-md font-serif text-2xl leading-tight">Long-form entries about the systems, objects, people, and ideas that shape how we see the world.</p></div></section><section className="border-b border-ink/10 px-5 py-6 md:px-12"><div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><SearchBar label="Search articles" placeholder="Search articles" value={query} onChange={setQuery} className="md:w-96" /><div className="flex flex-wrap items-center gap-2"><Filter size={14} className="mr-2 text-muted" />{types.map((type) => <button key={type} onClick={() => setFilter(type)} className={`border px-3 py-2 font-mono text-[10px] uppercase ${filter === type ? 'border-ink bg-ink text-paper' : 'border-ink/20 hover:border-ink'}`}>{type}</button>)}</div></div></section>{isLoading ? <section aria-label="Loading articles" className="grid gap-px bg-ink/15 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="bg-paper p-5"><Skeleton className="h-3 w-24 bg-ink/10" /><Skeleton className="mt-6 h-7 w-3/4 bg-ink/10" /><Skeleton className="mt-2 h-4 w-full bg-ink/10" /></div>)}</section> : <section className="grid gap-px bg-ink/15 md:grid-cols-2 lg:grid-cols-3">{visible.map((article) => <Link key={`${article.href}#${article.number}`} href={article.href} className={`group ${article.color} p-5 transition-transform hover:-translate-y-1`}><div className="flex items-center justify-between font-mono text-[10px] uppercase"><span>{article.number} / {article.type}</span><ArrowUpRight size={15} /></div><h2 className="mt-6 font-serif text-2xl leading-tight">{article.title}</h2><p className="mt-2 line-clamp-2 font-serif text-sm leading-relaxed text-muted group-hover:text-ink">{article.description}</p>{'slug' in article && article.slug ? <ClaimHover slug={article.slug} /> : null}</Link>)}</section>}{visible.length === 0 && <p className="px-5 py-20 font-serif text-2xl md:px-12">Nothing in the index matches that search.</p>}</div><SiteFooter><Link href="/chat" className="font-mono text-[10px] uppercase text-coral">Talk to Veritas ↗</Link></SiteFooter>
  </main>
}
