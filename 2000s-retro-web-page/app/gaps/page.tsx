'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { fetchAllGaps, submitGapEvidence } from '@/lib/api'
import type { Gap } from '@/lib/types'
import { useApi } from '@/hooks/use-api'
import { useAuth } from '@/components/auth-provider'
import { ErrorRow, LiveBadge } from '@/components/data-states'
import { GapRow } from '@/components/gap-row'
import { SearchBar } from '@/components/search-bar'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'
import { Skeleton } from '@/components/ui/skeleton'

// ponytail: per-gap evidence filing lives here, next to the gap — same shape
// as claim evidence, different endpoint.
function GapSubmit({ gapId }: { gapId: string }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!open) {
    return <button onClick={() => setOpen(true)} className="font-mono text-[10px] uppercase text-coral underline">File evidence →</button>
  }
  const submit = async () => {
    if (!url.trim()) return
    setBusy(true)
    setMsg(null)
    const res = await submitGapEvidence(gapId, url.trim(), note.trim())
    setBusy(false)
    if (res) {
      setMsg('Filed — Veritas will verify it against the gap.')
      setUrl('')
      setNote('')
    } else {
      setMsg(user ? 'Filing failed — try again.' : 'Log in to file evidence.')
    }
  }
  return (
    <div className="mt-3 space-y-2 border-t border-ink/10 pt-3">
      <input aria-label="Evidence URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://source…" inputMode="url" className="w-full border border-ink/25 bg-transparent px-3 py-2 font-mono text-xs outline-none placeholder:text-muted focus:border-coral" />
      <input aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this closes the gap (optional)" className="w-full border border-ink/25 bg-transparent px-3 py-2 font-mono text-xs outline-none placeholder:text-muted focus:border-coral" />
      <div className="flex gap-3">
        <button disabled={busy || !url.trim()} onClick={submit} className="border border-coral px-3 py-2 font-mono text-[10px] uppercase text-coral hover:bg-coral hover:text-ink disabled:opacity-40">{busy ? 'Filing…' : 'Submit'}</button>
        <button onClick={() => setOpen(false)} className="font-mono text-[10px] uppercase text-muted underline">Cancel</button>
      </div>
      {msg && <p className="font-mono text-[10px] uppercase text-muted">{msg}</p>}
      {!user && <Link href="/login?redirect=/gaps" className="block font-mono text-[10px] uppercase text-coral underline">Log in to file evidence</Link>}
    </div>
  )
}

export default function GapsPage() {
  const [query, setQuery] = useState('')
  const gaps = useApi((signal) => fetchAllGaps(signal), 'gaps:all')
  const list = gaps.data ?? []
  const shown = list
    .filter((g) => `${g.claim_text ?? ''} ${g.expected_artifact} ${g.article_slug ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 40)
  const live = list.length > 0
  return <main className="min-h-screen bg-paper text-ink">
    <SiteHeader kicker="Known unknowns, filed openly" />
    <div className="mx-auto max-w-[1400px] border-x border-ink/10">
      <section className="border-b border-ink/10 px-5 py-14 md:px-12 md:py-24">
        <Link href="/" className="flex items-center gap-2 font-mono text-[10px] uppercase"><ArrowLeft size={13} /> Back to index</Link>
        <div className="mt-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.16em] text-coral">Evidence gaps / {live ? `${list.length} open` : '—'} <LiveBadge live={live} /></p>
            <h1 className="mt-4 font-sans text-6xl font-bold leading-[.86] tracking-[-.08em] md:text-8xl">What we<br /><span className="text-coral">don&apos;t know.</span></h1>
            <p className="mt-6 max-w-md font-serif text-xl leading-tight">Every gap is a missing artifact with a name. Upvote the ones that matter, file evidence for the ones you can close.</p>
          </div>
        </div>
        <SearchBar label="Filter gaps" placeholder="Filter by claim, artifact, article…" value={query} onChange={setQuery} className="mt-10 max-w-xl" />
      </section>
      <section className="px-5 py-10 md:px-12">
        {gaps.loading && <div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="border border-ink/15 p-4"><Skeleton className="h-3 w-32 bg-ink/10" /><Skeleton className="mt-3 h-5 w-full bg-ink/10" /></div>)}</div>}
        {!gaps.loading && gaps.error && <ErrorRow onRetry={gaps.refetch} />}
        {!gaps.loading && !gaps.error && shown.length === 0 && <p className="font-serif text-xl">{query ? 'No gaps match that filter.' : 'No open gaps — the index is fully sourced.'}</p>}
        <div className="space-y-3">
          {shown.map((g: Gap) => (
            <div key={g.id} className="border border-ink/15 p-4">
              <GapRow gap={g} />
              {g.claim_text && <p className="mt-3 font-serif text-base leading-relaxed">{g.claim_text}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-4">
                {g.article_slug && <Link href={`/articles/${g.article_slug}`} className="font-mono text-[10px] uppercase text-coral underline">Read article →</Link>}
                <GapSubmit gapId={g.id} />
              </div>
            </div>
          ))}
        </div>
        {list.length > shown.length && <p className="mt-6 font-mono text-[10px] uppercase text-muted">Showing {shown.length} of {list.length} — refine the filter to see more.</p>}
      </section>
    </div>
    <SiteFooter><Link href="/claims" className="font-mono text-[10px] uppercase text-coral">Traverse claims →</Link></SiteFooter>
  </main>
}
