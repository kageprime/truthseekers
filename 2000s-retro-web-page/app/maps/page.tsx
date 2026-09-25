'use client'

import { ArrowLeft, Layers, MapPin } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { fetchMaps } from '@/lib/api'
import { useApi } from '@/hooks/use-api'
import { LiveBadge } from '@/components/data-states'
import { SiteFooter, SiteHeader } from '@/components/site-chrome'

const places = [
  { name: 'Alexandria', region: 'Egypt', era: 'c. 300 BCE', note: 'A port city where languages, trade, and scholarship crossed paths.', x: '49%', y: '45%' },
  { name: "Chang'an", region: 'China', era: '618–907', note: 'A capital at the eastern end of the Silk Roads.', x: '76%', y: '39%' },
  { name: 'Timbuktu', region: 'Mali', era: '1200s–1500s', note: 'A center of trade, manuscript culture, and Islamic learning.', x: '37%', y: '57%' },
  { name: 'Tenochtitlan', region: 'Mexico', era: '1325–1521', note: 'An island capital built across the waters of Lake Texcoco.', x: '17%', y: '55%' },
]

export default function MapsPage() {
  const [active, setActive] = useState(places[0])
  const [layer, setLayer] = useState('Cities')
  // ponytail: live map count only — static pins keep their designed positions.
  const live = useApi((signal) => fetchMaps(50, 0, signal), 'maps:list')
  return <main className="min-h-screen bg-paper text-ink"><SiteHeader kicker="Maps for making connections" /><div className="mx-auto max-w-[1400px] border-x border-ink/10"><section className="grid gap-10 border-b border-ink/10 px-5 py-12 md:grid-cols-[1fr_2fr] md:px-12 md:py-20"><div><Link href="/" className="flex items-center gap-2 font-mono text-[10px] uppercase"><ArrowLeft size={13} /> Back to index</Link><p className="mt-16 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.16em] text-coral">Atlas / 001 <LiveBadge live={(live.data?.length ?? 0) > 0} /></p><h1 className="mt-4 font-sans text-6xl font-bold leading-[.86] tracking-[-.08em] md:text-[8rem]">The world<br /><span className="text-coral">in relation.</span></h1><p className="mt-8 max-w-md font-serif text-xl leading-tight">A living map of cities, routes, ideas, and the distances between them.</p></div><div><div className="relative min-h-[430px] overflow-hidden border border-ink bg-[#d8d0bf]" aria-label="Interactive map of connected historical cities"><div className="absolute inset-0 opacity-50" style={{ backgroundImage: 'linear-gradient(#15151518 1px, transparent 1px), linear-gradient(90deg, #15151518 1px, transparent 1px)', backgroundSize: '44px 44px' }} /><div className="absolute inset-[12%] rounded-[48%] border border-ink/30" /><div className="absolute inset-[24%_8%_22%_25%] rounded-[45%] border border-ink/20" />{places.map((place) => <button key={place.name} onClick={() => setActive(place)} style={{ left: place.x, top: place.y }} className={`absolute -translate-x-1/2 -translate-y-1/2 ${active.name === place.name ? 'text-coral' : 'text-ink'}`} aria-label={`Show ${place.name}`}><MapPin size={active.name === place.name ? 25 : 19} fill="currentColor" /><span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] uppercase">{place.name}</span></button>)}<div className="absolute bottom-4 left-4 font-mono text-[10px] uppercase">Drag to explore / 4 places</div><div className="absolute right-4 top-4 flex gap-2">{['Cities', 'Routes', 'Ideas'].map((item) => <button key={item} onClick={() => setLayer(item)} className={`flex items-center gap-1 border px-2 py-1 font-mono text-[9px] uppercase ${layer === item ? 'border-ink bg-ink text-paper' : 'border-ink/30 bg-paper/60'}`}><Layers size={11} />{item}</button>)}</div></div><div className="border-x border-b border-ink bg-coral p-5"><p className="font-mono text-[10px] uppercase">Selected place / {active.era}</p><h2 className="mt-2 font-serif text-3xl">{active.name}, {active.region}</h2><p className="mt-2 max-w-xl font-serif text-sm leading-relaxed">{active.note}</p></div></div></section></div><SiteFooter><Link href="/claims" className="font-mono text-[10px] uppercase text-coral">Trace a claim ↗</Link></SiteFooter></main>
}
