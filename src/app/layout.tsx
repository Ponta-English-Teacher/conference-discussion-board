import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Conference Discussion Board',
  description: 'A bilingual academic conference discussion platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full antialiased" style={{ background: '#F8F9FF', color: '#1E293B' }}>
        {children}
      </body>
    </html>
  );
}
