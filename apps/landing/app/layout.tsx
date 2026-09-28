import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ai-cost — AI Gateway & Token Spend Optimizer',
  description: 'A drop-in OpenAI-compatible proxy gateway that deduplicates repetitive prompts, routes dynamically between frontier and mini models, and enforces strict department spend budgets.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-slate-800 selection:text-white">
        {children}
      </body>
    </html>
  );
}
