// app/layout.tsx - FIXED VERSION
import { Providers } from './providers'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ClientThemeWrapper from '@/components/ClientThemeWrapper'
import './globals.css'
import type { Metadata } from 'next'

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
            <div className="min-h-screen flex flex-col">
              <Header />
              <main className="flex-1">
                {children}
              </main>
              <Footer />
            </div>
          </Providers>
        </ClientThemeWrapper>
      </body>
    </html>
  )
}