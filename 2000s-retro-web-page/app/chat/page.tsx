'use client'

import { ArrowLeft, ArrowUp, BookOpen, ChevronRight, Compass, Network, Plus, Search, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { authed, createChat } from '@/lib/api'
import { useAuth } from '@/components/auth-provider'

type Message = { role: 'user' | 'veritas'; text: string; sources?: string[] }

const opening: Message = { role: 'veritas', text: 'I am Veritas. Ask me about an idea, a place, a person, or a claim. I will show you what I know, where it comes from, and where the uncertainty begins.', sources: ['Veritas method / version 01'] }
const suggestions = ['Why did the printing press matter?', 'Trace the Silk Roads through cities.', 'How do I know if a claim is strong?']

export default function ChatPage() {
  const { user, loading: authLoading } = useAuth()
  const [messages, setMessages] = useState<Message[]>([opening])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)

  // ponytail: chat is authed — anon gets a login CTA, never a fake reply.
  const send = async (text = input) => {
    const clean = text.trim()
    if (!clean || thinking) return
    if (!authLoading && !user) {
      setInput('')
      setMessages((current) => [...current, { role: 'user', text: clean }, {
        role: 'veritas',
        text: 'The inquiry room is members-only — log in so I can investigate with the full archive behind me.',
      }])
      return
    }
    setInput('')
    setMessages((current) => [...current, { role: 'user', text: clean }])
    setThinking(true)
    try {
      const conv = await createChat('Untitled investigation')
      if (!conv) throw new Error('offline')
      const live = await authed(`/chat/${conv.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: clean }),
      }).catch(() => null)
      if (!live || !live.ok || !live.body) throw new Error(live?.status === 401 ? 'login' : 'offline')
      const reader = live.body.getReader()
      const decoder = new TextDecoder()
      let doneText = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value).split('\n')) {
          const t = line.trim()
          if (!t.startsWith('data:')) continue
          try {
            const evt = JSON.parse(t.slice(5))
            if (typeof evt.content === 'string' && evt.content) doneText = evt.content
            if (evt.type === 'done' && typeof evt.content === 'string') doneText = evt.content
          } catch { /* heartbeat frames */ }
        }
      }
      setMessages((current) => [...current, {
        role: 'veritas',
        text: doneText || 'The investigation is queued — open the claim graph to inspect the chain.',
        sources: ['Claim graph / live'],
      }])
    } catch {
      // Offline backend: honest about it, no fabricated answer.
      setMessages((current) => [...current, {
        role: 'veritas',
        text: 'Veritas is unreachable right now — the backend may be down. Your question is kept above; try again in a moment.',
      }])
    } finally {
      setThinking(false)
    }
  }

  return (
    <main className="min-h-screen bg-ink text-paper">
      <header className="border-b border-paper/20 px-5 py-4 md:px-8">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.12em] text-paper/70 hover:text-coral"><ArrowLeft size={14} /> Everything / Encyclopedia</Link>
          <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[.12em]"><span className="hidden text-paper/40 md:inline">Private inquiry room</span>{!authLoading && !user ? <Link href="/login?redirect=/chat" className="border border-coral px-3 py-1 text-coral hover:bg-coral hover:text-ink">Log in</Link> : <span className="flex items-center gap-2 text-coral"><span className="h-2 w-2 rounded-full bg-coral shadow-[0_0_10px_#ff705d]" /> Veritas online</span>}</div>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-65px)] max-w-[1500px] border-x border-paper/15 lg:grid-cols-[250px_minmax(0,1fr)_260px]">
        <aside className="hidden border-r border-paper/15 p-6 lg:flex lg:flex-col">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full border border-coral text-coral"><Sparkles size={17} /></div><div><p className="font-sans text-xl font-bold tracking-[-.06em]">Veritas</p><p className="font-mono text-[9px] uppercase text-paper/50">Evidence guide</p></div></div>
          <button type="button" onClick={() => setMessages([opening])} className="mt-14 flex items-center justify-between border border-paper/20 px-3 py-3 text-left font-mono text-[10px] uppercase tracking-[.1em] transition hover:border-coral hover:text-coral"><span className="flex items-center gap-2"><Plus size={14} /> New inquiry</span><ChevronRight size={13} /></button>
          <nav className="mt-8 space-y-5 font-mono text-[10px] uppercase tracking-[.1em] text-paper/50"><p className="text-coral">Current thread</p><p className="hover:text-paper">Conversation history</p><p className="hover:text-paper">Saved investigations</p></nav>
          <div className="mt-auto border-t border-paper/15 pt-6"><p className="font-serif text-lg leading-tight text-paper/70">A special kind of answer: one that leaves a trail.</p><Link href="/claims" className="mt-5 flex items-center gap-2 font-mono text-[10px] uppercase text-coral hover:underline">Open claim graph <Network size={13} /></Link></div>
        </aside>

        <section className="flex min-w-0 flex-col">
          <div className="border-b border-paper/15 px-5 py-5 md:px-12"><div className="mx-auto flex max-w-3xl items-center justify-between"><div><p className="font-mono text-[9px] uppercase tracking-[.18em] text-coral">Live inquiry / 001</p><p className="mt-1 font-sans text-sm font-bold">Untitled investigation</p></div><span className="font-mono text-[9px] uppercase text-paper/40">Sources visible</span></div></div>
          <div className="flex-1 px-5 py-10 md:px-12 md:py-14"><div className="mx-auto max-w-3xl">
            {messages.length === 1 && <div className="mb-12"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-coral">Veritas / conversational index</p><h1 className="mt-5 max-w-2xl font-sans text-6xl font-bold leading-[.82] tracking-[-.08em] md:text-8xl">Ask better<br /><span className="text-coral">questions.</span></h1><p className="mt-7 max-w-md font-serif text-xl leading-tight text-paper/65">Not a chat window. A guided way to investigate what is known, what is disputed, and what deserves another look.</p></div>}
            <div className="space-y-9">{messages.map((message, index) => <article key={`${message.role}-${index}`} className={message.role === 'user' ? 'ml-auto max-w-[85%] border-l border-coral pl-5' : 'max-w-[92%]'}><div className="mb-2 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.16em] text-paper/40"><span className={message.role === 'veritas' ? 'text-coral' : 'text-paper/70'}>{message.role === 'veritas' ? 'Veritas' : 'You'}</span><span>/</span><span>{index === 0 ? 'opening note' : `turn ${index}`}</span></div><p className={message.role === 'user' ? 'font-sans text-lg leading-relaxed text-paper' : 'font-serif text-[21px] leading-[1.35] text-paper/90'}>{message.text}</p>{message.sources && <div className="mt-5 flex flex-wrap gap-2">{message.sources.map((source) => <Link key={source} href="/claims" className="flex items-center gap-2 border border-paper/20 px-3 py-2 font-mono text-[9px] uppercase tracking-[.08em] text-paper/60 hover:border-coral hover:text-coral"><BookOpen size={12} /> {source}</Link>)}</div>}</article>)}{thinking && <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[.14em] text-coral"><span className="inline-flex gap-1"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-coral" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-coral [animation-delay:150ms]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-coral [animation-delay:300ms]" /></span> Traversing sources</div>}</div>
            {messages.length === 1 && <div className="mt-12 grid gap-2 md:grid-cols-3">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => send(suggestion)} className="group min-h-24 border border-paper/15 p-4 text-left font-serif text-base leading-tight text-paper/65 transition hover:border-coral hover:text-paper"><span className="mb-6 block font-mono text-[9px] uppercase text-paper/35 group-hover:text-coral">Explore /</span>{suggestion}</button>)}</div>}
          </div></div>
          <div className="border-t border-paper/20 px-5 py-5 md:px-12"><form onSubmit={(event) => { event.preventDefault(); send() }} className="mx-auto flex max-w-3xl items-center gap-3 border border-paper/35 bg-paper/[.04] p-2 focus-within:border-coral"><Search size={16} className="ml-2 text-paper/40" /><input aria-label="Ask Veritas a question" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask a question, name a claim, or start a trail…" className="min-w-0 flex-1 bg-transparent px-1 py-3 font-serif text-lg text-paper outline-none placeholder:text-paper/35" /><button aria-label="Send question" type="submit" disabled={thinking} className="flex h-11 w-11 items-center justify-center bg-coral text-ink transition hover:bg-paper disabled:opacity-40"><ArrowUp size={18} /></button></form><p className="mx-auto mt-3 max-w-3xl font-mono text-[9px] uppercase tracking-[.1em] text-paper/35">Veritas can be wrong. Every answer is an invitation to inspect the evidence.</p></div>
        </section>

        <aside className="hidden border-l border-paper/15 p-6 xl:block"><p className="font-mono text-[9px] uppercase tracking-[.16em] text-coral">Investigation tools</p><div className="mt-6 space-y-3"><Link href="/claims" className="group block border border-paper/15 p-4 hover:border-coral"><Network size={17} className="text-coral" /><p className="mt-8 font-sans text-sm font-bold">Claim traversal</p><p className="mt-2 font-serif text-sm leading-tight text-paper/55">Follow an answer back through its supporting and opposing nodes.</p></Link><Link href="/maps" className="group block border border-paper/15 p-4 hover:border-coral"><Compass size={17} className="text-coral" /><p className="mt-8 font-sans text-sm font-bold">Place context</p><p className="mt-2 font-serif text-sm leading-tight text-paper/55">See how geography changes the story.</p></Link></div><div className="mt-12 border-t border-paper/15 pt-5"><p className="font-mono text-[9px] uppercase tracking-[.16em] text-paper/40">Method note</p><p className="mt-3 font-serif text-base leading-tight text-paper/65">Ask for sources. Ask what would change the answer. Ask who is missing.</p></div></aside>
      </div>
    </main>
  )
}
