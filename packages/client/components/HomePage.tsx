// components/HomePage.tsx (Rewritten for DaisyUI)
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
      title: "Client Intake",
      description: "Personal income tax client intake form with document checklist and client search functionality",
      href: "/client-intake",
      icon: "📋",
      buttonClass: "btn-success"
    },
    {
      title: "Manage Contacts",
      description: "Link contacts to companies and manage work relationships with role, department, and contact information",
      href: "/manage-contacts",
      icon: "👥",
      buttonClass: "btn-warning"
    },
    {
      title: "View Display",
      description: "Display and configure any Airtable view with custom filters, sorting, and advanced options",
      href: "/view-display",
      icon: "👁️",
      buttonClass: "btn-secondary"
    },
    {
      title: "Processor Billing",
      description: "View processor billing information, client distribution, and revenue analytics for bookkeeping services",
      href: "/processor-billing",
      icon: "💰",
      buttonClass: "btn-accent"
    },
    {
      title: "Training Videos",
      description: "Access comprehensive tax preparation training videos, tutorials, and educational content from our YouTube channel",
      href: "/training-videos",
      icon: "🎥",
      buttonClass: "btn-info"
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
              <Link href="/training-videos" className="btn btn-outline btn-lg">
                View Training
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h8m2-10v.01M3 10v.01" />
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {menuItems.map((item, index) => (
              <div key={index} className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 border border-base-300 hover:scale-105">
                <div className="card-body text-center p-8">
                  <div className="text-6xl md:text-7xl mb-6 transform hover:scale-110 transition-transform duration-300">
                    {item.icon}
                  </div>
                  <h3 className="card-title text-2xl md:text-3xl mb-4 justify-center">
                    {item.title}
                  </h3>
                  <p className="opacity-70 leading-relaxed text-base md:text-lg mb-6">
                    {item.description}
                  </p>
                  <div className="card-actions justify-center">
                    <Link href={item.href} className={`btn ${item.buttonClass} btn-wide`}>
                      Open Dashboard
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
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
            <h2 className="text-3xl font-bold mb-4">Platform Features</h2>
            <p className="text-lg opacity-70">Everything you need to manage your tax preparation business</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="card-body text-center">
                <div className="text-4xl md:text-5xl mb-6 transform hover:scale-110 transition-transform duration-300">
                  🏢
                </div>
                <h3 className="card-title text-xl md:text-2xl mb-4 justify-center">
                  Client Management
                </h3>
                <p className="opacity-70 leading-relaxed">
                  Track client information, services, and subscription status across all business operations with real-time updates
                </p>
              </div>
            </div>
            
            <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="card-body text-center">
                <div className="text-4xl md:text-5xl mb-6 transform hover:scale-110 transition-transform duration-300">
                  📈
                </div>
                <h3 className="card-title text-xl md:text-2xl mb-4 justify-center">
                  Business Analytics
                </h3>
                <p className="opacity-70 leading-relaxed">
                  Monitor revenue, client activity, and operational metrics to drive business growth with detailed insights
                </p>
              </div>
            </div>
            
            <div className="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="card-body text-center">
                <div className="text-4xl md:text-5xl mb-6 transform hover:scale-110 transition-transform duration-300">
                  🎓
                </div>
                <h3 className="card-title text-xl md:text-2xl mb-4 justify-center">
                  Training & Education
                </h3>
                <p className="opacity-70 leading-relaxed">
                  Access comprehensive training videos and educational resources to enhance your tax preparation skills
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Stats */}
      <section className="py-12 bg-base-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="stats stats-vertical lg:stats-horizontal shadow w-full">
            <div className="stat place-items-center">
              <div className="stat-title">Dashboards</div>
              <div className="stat-value text-primary">6</div>
              <div className="stat-desc">Comprehensive tools</div>
            </div>
            
            <div className="stat place-items-center">
              <div className="stat-title">Availability</div>
              <div className="stat-value text-secondary">24/7</div>
              <div className="stat-desc">Always accessible</div>
            </div>
            
            <div className="stat place-items-center">
              <div className="stat-title">Data Sync</div>
              <div className="stat-value text-accent">Real-time</div>
              <div className="stat-desc">Live updates</div>
            </div>
            
            <div className="stat place-items-center">
              <div className="stat-title">Security</div>
              <div className="stat-value text-info">Secure</div>
              <div className="stat-desc">Protected platform</div>
            </div>
            
            <div className="stat place-items-center">
              <div className="stat-title">Training</div>
              <div className="stat-value text-success">Videos</div>
              <div className="stat-desc">Learning resources</div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-16 bg-primary text-primary-content">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl mb-8 opacity-90">
            Take control of your tax preparation business with our comprehensive management tools
          </p>
          <Link href="/airtable-dashboard" className="btn btn-accent btn-lg">
            Access Dashboard
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>
    </div>
  );
}