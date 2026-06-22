import { Providers } from './providers'
import ClientLayoutWrapper from '@/components/ClientLayoutWrapper'
import ClientThemeWrapper from '@/components/ClientThemeWrapper'
import './globals.css'
import type { Metadata } from 'next'
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});


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
    <html lang="en" className={cn("font-sans", geist.variable)} data-theme="cupcake" suppressHydrationWarning>
      <head>
        {/* Inline script runs synchronously before any HTML is parsed or painted.
            This eliminates theme flash in both dev and production. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('app-theme')||'cupcake';document.documentElement.setAttribute('data-theme',t);}catch(e){}` }} />
      </head>
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