import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GeM Bid Compliance Verification Platform | Government of India',
  description:
    'AI-powered procurement bid compliance verification system for the Government e-Marketplace (GeM). Automated OCR, Gemini AI analysis, and government record triangulation.',
  keywords: 'GeM, Government e-Marketplace, bid compliance, procurement, AI verification, India',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#003580" />
      </head>
      <body>{children}</body>
    </html>
  );
}
