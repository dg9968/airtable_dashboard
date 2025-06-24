// components/Header.tsx (Updated)
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import TaxProLogo from './TaxProLogo';

interface NavigationItem {
  name: string;
  href: string;
  icon: string;
  description?: string;
}

interface HeaderProps {
  className?: string;
}

export default function Header({ className = '' }: HeaderProps) {
  const pathname = usePathname();

  const navigationItems: NavigationItem[] = [
    {
      name: 'Dashboard',
      href: '/',
      icon: '🏠',
      description: 'Main dashboard overview'
    },
    {
      name: 'Airtable Data',
      href: '/airtable-dashboard',
      icon: '📊',
      description: 'View all Airtable tables and statistics'
    },
    {
      name: 'View Display',
      href: '/view-display',
      icon: '👁️',
      description: 'Configure and display Airtable views'
    },
    {
      name: 'Bookkeeping',
      href: '/bookkeeping-dashboard',
      icon: '💼',
      description: 'Bookkeeping clients dashboard'
    },
    {
      name: 'Processor Billing',
      href: '/processor-billing',
      icon: '💰',
      description: 'Processor billing overview'
    },
    {
      name: 'Training Videos',
      href: '/training-videos',
      icon: '🎥',
      description: 'Tax preparation training videos'
    }
  ];

  const isActiveRoute = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <header className={`bg-blue-800 shadow-lg border-b border-blue-700 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo Section */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
              <TaxProLogo size="large" variant="main" priority={true} />
              <div className="hidden sm:block">
                <h1 className="text-xl font-bold text-white">Tax Operations</h1>
                <p className="text-xs text-gray-400">Business Management System</p>
              </div>
            </Link>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex space-x-1">
            {navigationItems.map((item) => {
              const isActive = isActiveRoute(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    group relative px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                    ${isActive 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-700'
                    }
                  `}
                  title={item.description}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-base">{item.icon}</span>
                    <span className="hidden lg:inline">{item.name}</span>
                  </div>
                  
                  {/* Active indicator */}
                  {isActive && (
                    <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full"></div>
                  )}
                  
                  {/* Tooltip for medium screens */}
                  <div className="lg:hidden absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    {item.name}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button 
              type="button"
              className="text-gray-300 hover:text-white hover:bg-gray-700 p-2 rounded-lg transition-colors"
              onClick={() => {
                // Toggle mobile menu (you can implement this with state)
                const mobileMenu = document.getElementById('mobile-menu');
                if (mobileMenu) {
                  mobileMenu.classList.toggle('hidden');
                }
              }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        <div id="mobile-menu" className="hidden md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 border-t border-gray-700">
            {navigationItems.map((item) => {
              const isActive = isActiveRoute(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`
                    block px-3 py-2 rounded-lg text-base font-medium transition-colors
                    ${isActive 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-300 hover:text-white hover:bg-gray-700'
                    }
                  `}
                  onClick={() => {
                    // Close mobile menu on navigation
                    const mobileMenu = document.getElementById('mobile-menu');
                    if (mobileMenu) {
                      mobileMenu.classList.add('hidden');
                    }
                  }}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{item.icon}</span>
                    <div>
                      <div>{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-gray-400">{item.description}</div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}