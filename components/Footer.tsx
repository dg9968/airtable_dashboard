// components/Footer.tsx (Updated for DaisyUI)
'use client';

import TaxProLogo from './TaxProLogo';

interface FooterProps {
  className?: string;
}

export default function Footer({ className = '' }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`bg-base-200 border-t border-base-300 mt-auto ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0">
          {/* Logo and Company Info */}
          <div className="flex items-center space-x-3">
            <TaxProLogo size="small" variant="main" />
            <div className="text-center md:text-left">
              <h3 className="text-lg font-semibold">Tax Pro Operations</h3>
              <p className="text-sm opacity-70">Business Management System</p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <a href="/airtable-dashboard" className="link link-hover opacity-70">
              Dashboard
            </a>
            <a href="/view-display" className="link link-hover opacity-70">
              Views
            </a>
            <a href="/processor-billing" className="link link-hover opacity-70">
              Billing
            </a>
            <a href="/training-videos" className="link link-hover opacity-70">
              Training
            </a>
          </div>

          {/* Copyright and Tech Stack */}
          <div className="text-center md:text-right">
            <p className="text-sm opacity-70">
              &copy; {currentYear} Tax Preparation Business Operations
            </p>
            <p className="text-xs opacity-50 mt-1">
              Powered by Next.js, Airtable & Tailwind CSS
            </p>
          </div>
        </div>

        {/* System Status */}
        <div className="mt-6 pt-6 border-t border-base-300">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-2 sm:space-y-0">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
              <span className="text-sm opacity-70">System Online</span>
            </div>
            <div className="text-xs opacity-50">
              Last updated: {new Date().toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}