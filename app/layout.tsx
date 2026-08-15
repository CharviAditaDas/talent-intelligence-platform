import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Talent Intelligence Platform',
    template: '%s | Talent Intelligence Platform',
  },
  description:
    'AI resume screening and talent intelligence. Evidence-grounded candidate assessment that keeps hiring decisions with recruiters.',
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-sharp focus:bg-petrol-700 focus:px-4 focus:py-2 focus:text-white">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
