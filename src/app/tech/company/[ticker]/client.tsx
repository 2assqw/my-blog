'use client';
import { use } from 'react';
import { useState, useEffect } from 'react';
import Navbar from '@/components/investment/TechNavbar';
import { ScoreBadge, ScoreBar } from '@/components/investment/ScoreBadge';
import { api, CompanyMetrics, CompanyExplain } from '@/lib/investment-api';
import Link from 'next/link';
import { Shield, TrendingUp, DollarSign, AlertTriangle } from 'lucide-react';

export default function CompanyClient({ ticker }: { ticker: Promise<{ ticker: string }> }) {
  const { ticker: t } = use(ticker);
  const [metrics, setMetrics] = useState<CompanyMetrics | null>(null);
  const [explain, setExplain] = useState<CompanyExplain | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.metrics(t), api.explain(t)])
      .then(([m, e]) => { setMetrics(m); setExplain(e); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return <><Navbar /><div className="p-24 text-center text-neutral-400">Loading {t}...</div></>;
  if (!metrics) return <><Navbar /><div className="p-24 text-center text-neutral-500">No data for {t}</div></>;

  const q = metrics.breakdown?.quality ?? {};
  const r = metrics.breakdown?.risk ?? {};

  return (
    <>
      <Navbar />
      <main className="max-w-5xl mx-auto px-6 py-16">
        <section className="mb-16 flex items-start gap-8">
          <div>
            <h1 className="text-5xl font-bold text-neutral-900 mb-2">{t.toUpperCase()}</h1>
            <p className="text-lg text-neutral-500 mb-6">Q{metrics.scores.quality} · G{metrics.scores.growth} · V{metrics.scores.valuation} · R{metrics.scores.risk}</p>
            {metrics.industrySupport.level === 'PASS' && <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">PASS</span>}
          </div>
          <ScoreBadge score={metrics.scores.overall} size="lg" />
        </section>
        <section className="mb-16">
          <h2 className="text-xl font-semibold mb-6">Four Pillars</h2>
          <div className="space-y-4">
            <ScoreBar label="Quality" value={metrics.scores.quality} />
            <ScoreBar label="Growth" value={metrics.scores.growth} />
            <ScoreBar label="Valuation" value={metrics.scores.valuation} />
            <ScoreBar label="Risk" value={metrics.scores.risk} />
          </div>
        </section>
        <section className="mb-16">
          <h2 className="text-xl font-semibold mb-6">Snapshot</h2>
          <div className="grid grid-cols-4 gap-4">
            {[
              { l:'ROE', v:(q.roe?.value??0).toFixed(0)+'%', d:(q.roe?.value??0)>20?'Excellent':'Good', i:TrendingUp },
              { l:'FCF Margin', v:(q.fcfMargin?.value??0).toFixed(0)+'%', d:(q.fcfMargin?.value??0)>20?'Excellent':'Good', i:DollarSign },
              { l:'Altman Z', v:(r.altmanZ?.value??0).toFixed(2), d:(r.altmanZ?.value??0)>3?'Very Safe':'Safe', i:Shield },
              { l:'Debt', v:(q.debtRatio?.value??0).toFixed(0)+'%', d:(q.debtRatio?.value??0)<40?'Low':'Moderate', i:AlertTriangle },
            ].map(c=><div key={c.l} className="bg-white border rounded-xl p-5"><c.i size={20} className="text-neutral-400 mb-3"/><p className="text-2xl font-bold">{c.v}</p><p className="text-sm text-neutral-500">{c.l}</p><p className="text-xs text-green-600">{c.d}</p></div>)}
          </div>
        </section>
        {explain?.strengths && (
          <section className="mb-16 grid grid-cols-2 gap-12">
            <div><h2 className="text-xl font-semibold mb-4 text-green-700">Strengths</h2>{explain.strengths.map(s=><p key={s} className="text-sm text-neutral-700">✓ {s.replace(/_/g,' ')}</p>)}</div>
            <div><h2 className="text-xl font-semibold mb-4 text-red-600">Risks</h2>{explain.weaknesses.map(w=><p key={w} className="text-sm text-neutral-700">⚠ {w.replace(/_/g,' ')}</p>)}</div>
          </section>
        )}
        <section>
          <h2 className="text-xl font-semibold mb-4">Related</h2>
          <div className="flex gap-3">
            {['AMD','TSM','AVGO','INTC'].filter(x=>x!==t.toUpperCase()).map(x=><Link key={x} href={`/tech/company/${x}`} className="px-4 py-2 rounded-lg bg-neutral-50 hover:bg-neutral-100 text-sm">{x}</Link>)}
          </div>
        </section>
      </main>
    </>
  );
}
