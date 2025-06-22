'use client';

import Link from 'next/link';
import Image from 'next/image';

interface MenuItem {
  title: string;
  description: string;
  href: string;
  icon: string;
  color: string;
  bgColor: string;
}

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  variant?: 'main' | 'icon';
  className?: string;
  priority?: boolean;
}

function TaxProLogo({ 
  size = 'medium', 
  variant = 'main',
  className = '',
  priority = false
}: LogoProps) {
  
  const sizeConfig = {
    small: {
      width: 48,
      height: 48,
      containerClass: 'w-12 h-12'
    },
    medium: {
      width: 80,
      height: 80,
      containerClass: 'w-20 h-20'
    },
    large: {
      width: 128,
      height: 128,
      containerClass: 'w-32 h-32'
    }
  };

  const config = sizeConfig[size];
  
  // Choose logo file based on variant and size
  let logoSrc = '/logo.png';
  if (variant === 'icon' && size === 'small') {
    logoSrc = '/logo-icon.png';
  } else if (size === 'small') {
    logoSrc = '/logo-small.png';
  }

  return (
    <div className={`${config.containerClass} relative ${className}`}>
      <Image
        src={logoSrc}
        alt="Tax Pro Operations Logo"
        width={config.width}
        height={config.height}
        priority={priority}
        className="object-contain w-full h-full drop-shadow-lg"
        onError={(e) => {
          // Fallback to main logo if variant doesn't exist
          const target = e.target as HTMLImageElement;
          target.src = '/logo.png';
        }}
      />
    </div>
  );
}

export default function HomePage() {
  const menuItems: MenuItem[] = [
    {
      title: "Airtable Dashboard",
      description: "Overview of all Airtable tables, records, and database statistics",
      href: "/airtable-dashboard",
      icon: "📊",
      color: "text-blue-600",
      bgColor: "bg-blue-50 hover:bg-blue-100 border-blue-200"
    },
    {
      title: "View Display",
      description: "Display and configure any Airtable view with custom filters and sorting",
      href: "/view-display",
      icon: "👁️",
      color: "text-purple-600",
      bgColor: "bg-purple-50 hover:bg-purple-100 border-purple-200"
    },
    {
      title: "Bookkeeping Dashboard",
      description: "Specialized dashboard for bookkeeping clients and subscription management",
      href: "/bookkeeping-dashboard",
      icon: "💼",
      color: "text-green-600",
      bgColor: "bg-green-50 hover:bg-green-100 border-green-200"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 shadow-lg border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            {/* Responsive PNG Logo */}
            <div className="flex justify-center mb-8">
              {/* Large logo for desktop */}
              <div className="hidden lg:block">
                <TaxProLogo size="large" variant="main" priority={true} />
              </div>
              {/* Medium logo for tablet */}
              <div className="hidden md:block lg:hidden">
                <TaxProLogo size="medium" variant="main" priority={true} />
              </div>
              {/* Small logo for mobile */}
              <div className="block md:hidden">
                <TaxProLogo size="small" variant="main" priority={true} />
              </div>
            </div>
            
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
              Tax Preparation Business Operations
            </h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Comprehensive business management system for tax preparation services, 
              client management, and operational oversight
            </p>
          </div>
        </div>
      </header>

      {/* Main Navigation Menu */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {menuItems.map((item, index) => (
            <Link
              key={index}
              href={item.href}
              className={`group block p-8 rounded-xl border-2 transition-all duration-300 transform hover:scale-105 hover:shadow-2xl ${item.bgColor}`}
            >
              <div className="text-center">
                <div className="text-5xl md:text-6xl mb-6 group-hover:scale-110 transition-transform duration-300">
                  {item.icon}
                </div>
                <h2 className={`text-xl md:text-2xl font-bold mb-4 ${item.color} group-hover:text-opacity-80 transition-colors duration-300`}>
                  {item.title}
                </h2>
                <p className="text-gray-700 leading-relaxed text-sm md:text-base">
                  {item.description}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* Business Information Section */}
        <div className="mt-20 bg-gray-800 rounded-xl p-8 border border-gray-700 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center group">
              <div className="text-3xl md:text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
                🏢
              </div>
              <h3 className="text-lg md:text-xl font-semibold text-white mb-2">
                Client Management
              </h3>
              <p className="text-gray-300 text-sm md:text-base leading-relaxed">
                Track client information, services, and subscription status across all business operations
              </p>
            </div>
            <div className="text-center group">
              <div className="text-3xl md:text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
                📈
              </div>
              <h3 className="text-lg md:text-xl font-semibold text-white mb-2">
                Business Analytics
              </h3>
              <p className="text-gray-300 text-sm md:text-base leading-relaxed">
                Monitor revenue, client activity, and operational metrics to drive business growth
              </p>
            </div>
            <div className="text-center group">
              <div className="text-3xl md:text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
                ⚙️
              </div>
              <h3 className="text-lg md:text-xl font-semibold text-white mb-2">
                Operations Control
              </h3>
              <p className="text-gray-300 text-sm md:text-base leading-relaxed">
                Centralized control panel for managing all aspects of tax preparation business operations
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats or Status */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center space-x-3 bg-gray-800 rounded-full px-6 py-3 border border-gray-700 shadow-lg">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-gray-300 font-medium">System Online</span>
            <TaxProLogo size="small" variant="icon" className="ml-2" />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-400">
            <div className="flex justify-center mb-4">
              <TaxProLogo size="small" variant="main" />
            </div>
            <p className="text-sm md:text-base">
              &copy; 2024 Tax Preparation Business Operations. All rights reserved.
            </p>
            <p className="mt-2 text-xs md:text-sm">
              Powered by Next.js, Airtable, and modern web technologies
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}