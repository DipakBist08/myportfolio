import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { ThemeProvider } from '@/components/layout/ThemeProvider'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://blog.dipakbist.com.np'

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Dipak Bist | QA Blog',
    template: '%s | Dipak Bist QA Blog',
  },
  description:
    'Articles on Software QA, automation testing, Selenium, Playwright, API testing, bug reporting, and QA career tips by Dipak Bist.',
  keywords: [
    'Software QA',
    'Quality Assurance',
    'Automation Testing',
    'Selenium',
    'Playwright',
    'API Testing',
    'Manual Testing',
    'Bug Reporting',
    'Test Cases',
    'Test Plans',
    'Python',
    'QA Engineer',
    'Dipak Bist',
  ],
  authors: [{ name: 'Dipak Bist', url: 'https://dipakbist.com' }],
  creator: 'Dipak Bist',
  alternates: {
    canonical: BASE_URL,
    types: { 'application/rss+xml': `${BASE_URL}/rss.xml` },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: BASE_URL,
    siteName: 'Dipak Bist QA Blog',
    title: 'Dipak Bist | QA Blog',
    description:
      'Articles on Software QA, automation testing, Selenium, Playwright, API testing, bug reporting, and QA career tips.',
    images: [{ url: `${BASE_URL}/og-default.png`, width: 1200, height: 630, alt: 'Dipak Bist QA Blog' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dipak Bist | QA Blog',
    description:
      'Articles on Software QA, automation testing, Playwright, API testing, and QA career tips.',
    creator: '@dipakbist08',
    images: [`${BASE_URL}/og-default.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="alternate" type="application/rss+xml" title="Dipak Bist QA Blog RSS" href="/rss.xml" />
      </head>
      <body className="flex min-h-screen flex-col">
        <ThemeProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  )
}
