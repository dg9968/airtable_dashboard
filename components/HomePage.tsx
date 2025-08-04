// components/HomePage.tsx - UPDATED WITH CALENDAR
'use client';

import Link from 'next/link';

interface MenuItem {
  title: string;
  description: string;
  href: string;
  icon: string;
  buttonClass: string;
}

export default function HomePage() {
  const menuItems: MenuItem[] = [
    {
      title: "Airtable Dashboard",
      description: "Overview of all Airtable tables, records, and database statistics with detailed analytics",
      href: "/airtable-dashboard",
      icon: "📊",
      buttonClass: "btn-primary"
    },
    {
      title: "View Display",
      description: "Display and configure any Airtable view with custom filters, sorting, and advanced options",
      href: "/view-display",
      icon: "👁️",
      buttonClass: "btn-secondary"
    },
    {
      title: "Task Calendar",
      description: "Manage service tasks, team assignments, and deadlines with an interactive calendar interface",
      href: "/calendar",
      icon: "📅",
      buttonClass: "btn-accent"
    },
    {
      title: "Filing Deadlines",
      description: "Track important tax filing deadlines, compliance dates, and regulatory requirements",
      href: "/filing-deadlines",
      icon: "📋",
      buttonClass: "btn-warning"
    },
    {
      title: "Processor Billing",
      description: "View processor billing information, client distribution, and revenue analytics for bookkeeping services",
      href: "/processor-billing",
      icon: "💰",
      buttonClass: "btn-info"
    },
    {
      title: "Training Videos",
      description: "Access comprehensive tax preparation training videos, tutorials, and educational content from our YouTube channel",
      href: "/training-videos",
      icon: "🎥",
      buttonClass: "btn-success"
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="hero min-h-screen bg-gradient-to-br from-primary to-secondary">
        <div className="hero-content text-center text-primary-content">
          <div className="max-w-6xl">
            <div className="mb-8">
              <div className="avatar">
                <div className="w-24 rounded-full ring ring-primary-content ring-offset-base-100 ring-offset-2">
                  <div className="w-24 h-24 bg-primary-content rounded-full flex items-center justify-center">
                    <span className="text-4xl">💼</span>
                  </div>
                </div>
              </div>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Welcome to Tax Pro Operations
            </h1>
            
            <p className="text-xl md:text-2xl mb-8 max-w-4xl mx-auto leading-relaxed opacity-90">
              Your comprehensive business management system for tax preparation services, 
              client management, and operational oversight
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link href="/airtable-dashboard" className="btn btn-accent btn-lg">
                Get Started
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link href="/calendar" className="btn btn-outline btn-lg">
                View Calendar
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </Link>
            </div>
            
            <div className="alert bg-base-100/20 border-primary-content/30">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-success rounded-full animate-pulse"></div>
                <span className="ml-3 font-medium">All Systems Operational</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation Cards */}
      <section className="py-16 bg-base-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Choose Your Dashboard</h2>
            <p className="text-lg opacity-70">Select the area you want to manage</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {menuItems.map((item, index) => (
              <div key={index} className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 border border-base-300 hover:scale-105">
                <div className="card-body text-center p-8">
                  <div className="text-6xl md:text-7xl mb-6 transform hover:scale-110 transition-transform duration-300">
                    {item.icon}
                  </div>
                  <h3 className="card-title text-xl md:text-2xl font-bold mb-4 justify-center">
                    {item.title}
                  </h3>
                  <p className="text-base opacity-70 mb-6 leading-relaxed">
                    {item.description}
                  </p>
                  <div className="card-actions justify-center">
                    <Link 
                      href={item.href}
                      className={`btn ${item.buttonClass} btn-lg w-full`}
                    >
                      Access {item.title}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-base-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Key Features</h2>
            <p className="text-lg opacity-70">Everything you need to manage your tax preparation business</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body text-center">
                <div className="text-4xl mb-4">🔄</div>
                <h3 className="text-xl font-bold mb-2">Real-time Sync</h3>
                <p className="opacity-70">Automatically synchronized with Airtable for up-to-date information</p>
              </div>
            </div>
            
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body text-center">
                <div className="text-4xl mb-4">📱</div>
                <h3 className="text-xl font-bold mb-2">Mobile Ready</h3>
                <p className="opacity-70">Responsive design that works perfectly on all devices</p>
              </div>
            </div>
            
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body text-center">
                <div className="text-4xl mb-4">🔒</div>
                <h3 className="text-xl font-bold mb-2">Secure Access</h3>
                <p className="opacity-70">Role-based authentication with secure data handling</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}