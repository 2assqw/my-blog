import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Investment Research — Understand a business before buying a stock.',
  description: 'Institutional-quality stock research for long-term investors.',
};

export default function TechLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
