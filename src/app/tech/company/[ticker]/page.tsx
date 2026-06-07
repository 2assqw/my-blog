import CompanyClient from './client';

export function generateStaticParams() {
  return [
    { ticker: 'NVDA' }, { ticker: 'META' }, { ticker: 'AAPL' }, { ticker: 'MSFT' },
    { ticker: 'GOOGL' }, { ticker: 'AMZN' }, { ticker: 'JPM' }, { ticker: 'XOM' },
    { ticker: 'FCX' },
  ];
}

export default function Page({ params }: { params: Promise<{ ticker: string }> }) {
  return <CompanyClient ticker={params} />;
}
