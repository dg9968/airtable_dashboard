import { Providers } from './providers'
import ClientLayoutWrapper from '@/components/ClientLayoutWrapper'
import ClientThemeWrapper from '@/components/ClientThemeWrapper'
import './globals.css'
import type { Metadata } from 'next'

// Better Auth's React client uses hooks at init time, which breaks SSG.
// All pages in this app are user-specific anyway, so force dynamic rendering.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tax Pro Operations',
  description: 'Comprehensive business management system for tax preparation services, client management, and operational oversight',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <ClientThemeWrapper>
          <Providers>
            <ClientLayoutWrapper>
              {children}
            </ClientLayoutWrapper>
          </Providers>
        </ClientThemeWrapper>
      </body>
    </html>
  )
}