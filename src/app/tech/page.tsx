'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/investment/TechNavbar';
import { ScoreBadge } from '@/components/investment/ScoreBadge';
import { api, RankingEntry } from '@/lib/investment-api';

const TICKERS = ['NVDA', 'META', 'AAPL', 'MSFT'];

export default function TechHomePage() {
  const [top, setTop] = useState<RankingEntry[]>([]);
  const [hq, setHQ] = useState<RankingEntry[]>([]);
  const [hg, setHG] = useState<RankingEntry[]>([]);
  const [hv, setHV] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.rankings('overall'), api.discover()])
      .then(([r, d]) => { setTop(r.results.slice(0,6)); setHQ(d.highQuality.slice(0,6)); setHG(d.highGrowth.slice(0,6)); setHV(d.highValue.slice(0,6)); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <><Navbar /><div className="p-24 text-center text-neutral-400">Loading...</div></>;

  return (
    <>
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-24">
        <section className="text-center mb-32">
          <h1 className="text-6xl font-bold tracking-tight text-neutral-900 leading-tight mb-6">Understand a business<br />before buying a stock.</h1>
          <p className="text-xl text-neutral-500 mb-10 max-w-xl mx-auto">Institutional-quality stock research for long-term investors.</p>
          <div className="flex justify-center gap-3 text-sm text-neutral-400">
            {TICKERS.map(t => <Link key={t} href={`/tech/company/${t}`} className="px-4 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors">{t}</Link>)}
          </div>
        </section>
        {top.length > 0 && (
          <section className="mb-24">
            <h2 className="text-2xl font-semibold mb-8">Top Overall</h2>
            <div className="grid grid-cols-3 gap-6">
              {top.slice(0,3).map(r => (
                <Link key={r.ticker} href={`/tech/company/${r.ticker}`} className="bg-white border border-neutral-100 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4"><div><h3 className="font-semibold text-lg">{r.ticker}</h3><p className="text-sm text-neutral-500">{r.company}</p></div><ScoreBadge score={r.overall} size="sm" /></div>
                  <div className="flex gap-6 text-sm text-neutral-500"><span>Q{r.quality}</span><span>G{r.growth}</span><span>V{r.valuation}</span><span>R{r.risk}</span></div>
                </Link>
              ))}
            </div>
          </section>
        )}
        {hq.length > 0 && <Section title="High Quality" items={hq} />}
        {hg.length > 0 && <Section title="High Growth" items={hg} />}
        {hv.length > 0 && <Section title="Deep Value" items={hv} />}
      </main>
    </>
  );
}

function Section({ title, items }: { title: string; items: RankingEntry[] }) {
  return (
    <section className="mb-16">
      <h2 className="text-2xl font-semibold mb-6">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {items.map(r => (
          <Link key={r.ticker} href={`/tech/company/${r.ticker}`} className="flex-shrink-0 w-44 bg-white border border-neutral-100 rounded-xl p-5 hover:shadow-md transition-shadow">
            <p className="font-semibold">{r.ticker}</p><p className="text-sm text-neutral-500 mb-3">{r.company}</p>
            <span className="text-2xl font-bold text-neutral-900">{r.overall}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
