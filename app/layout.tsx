import type { Metadata, Viewport } from 'next';
import './globals.css';
import './admin.css';
import './responsive.css';
import './technical.css';
import './final-responsive.css';

const siteUrl = process.env.INAM_SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'https://inamtechzone.com');

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'INAM TECH ZONE — Power. Security. Control.',
  description: 'Professional hardware, power tools, electrical, CCTV, solar, networking, alarm, access control and fire safety solutions.',
  applicationName: 'INAM TECH ZONE Commerce',
  icons: {
    icon: '/itz-logo-transparent.png',
    shortcut: '/itz-logo-transparent.png',
    apple: '/itz-logo-transparent.png',
  },
  openGraph: {
    title: 'INAM TECH ZONE — Power. Security. Control.',
    description: 'Professional technology and project-grade products for power, security and control.',
    type: 'website',
    url: '/',
    images: [{ url: '/og.png', width: 1731, height: 909, alt: 'INAM TECH ZONE — Power. Security. Control.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'INAM TECH ZONE — Power. Security. Control.',
    description: 'Professional technology and project-grade products for power, security and control.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
