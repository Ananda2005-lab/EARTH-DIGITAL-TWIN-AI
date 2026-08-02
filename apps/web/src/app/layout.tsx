import { PLATFORM } from '@edt/shared';
import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Sora } from 'next/font/google';
import type * as React from 'react';

import { Providers } from './providers';
import './globals.css';

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const display = Sora({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    default: `${PLATFORM.name} — ${PLATFORM.tagline}`,
    template: `%s · ${PLATFORM.shortName}`,
  },
  description:
    'Explore any place on Earth through an immersive 3D globe with live weather, hazards, flights, shipping and AI-powered location intelligence.',
  applicationName: PLATFORM.name,
  keywords: [
    'digital twin',
    '3D globe',
    'satellite imagery',
    'live weather',
    'flight tracking',
    'ship tracking',
    'geospatial analytics',
    'location intelligence',
  ],
  openGraph: {
    type: 'website',
    siteName: PLATFORM.name,
    title: PLATFORM.name,
    description: PLATFORM.tagline,
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
  icons: { icon: '/favicon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#050a17' },
    { media: '(prefers-color-scheme: light)', color: '#f7f9fc' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning` is required by next-themes, which sets the class
    // on <html> before React hydrates to avoid a flash of the wrong theme.
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={`${sans.variable} ${display.variable} ${mono.variable} font-sans`}>
        <a
          href="#main"
          className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:px-4 focus:py-2 focus:text-sm focus:font-medium"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
