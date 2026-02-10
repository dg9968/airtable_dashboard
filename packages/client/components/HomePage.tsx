// components/HomePage.tsx (Rewritten for DaisyUI)
'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface WorkflowItem {
  title: string;
  href: string;
  icon: string;
  buttonClass: string;
}

export default function HomePage() {
  const { data: session } = useSession();
  const userRole = (session?.user as any)?.role;
  const isAuthorized = userRole === 'staff' || userRole === 'admin';

  const personalWorkflows: WorkflowItem[] = [
    {
      title: "Client Intake",
      href: "/client-intake",
      icon: "📋",
      buttonClass: "btn-success"
    },
    {
      title: "Personal Services Pipeline",
      href: "/personal-services-pipeline",
      icon: "📊",
      buttonClass: "btn-primary"
    },
    {
      title: "Document Management",
      href: "/document-management",
      icon: "📄",
      buttonClass: "btn-info"
    }
  ];

  const corporateWorkflows: WorkflowItem[] = [
    {
      title: "Client Intake",
      href: "/corporate-client-intake",
      icon: "🏢",
      buttonClass: "btn-success"
    },
    {
      title: "Services Pipeline",
      href: "/corporate-services-pipeline",
      icon: "📊",
      buttonClass: "btn-primary"
    },
    {
      title: "Document Management",
      href: "/corporate-document-management",
      icon: "📄",
      buttonClass: "btn-info"
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="hero min-h-[50vh] bg-gradient-to-br from-primary to-secondary">
        <div className="hero-content text-center text-primary-content">
          <div className="max-w-4xl">
            <div className="mb-6">
              <div className="avatar">
                <div className="w-20 rounded-full ring ring-primary-content ring-offset-base-100 ring-offset-2">
                  <div className="w-20 h-20 bg-primary-content rounded-full flex items-center justify-center">
                    <span className="text-4xl">💼</span>
                  </div>
                </div>
              </div>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
              Welcome to Tax Pro Operations
            </h1>

            <p className="text-lg md:text-xl mb-6 max-w-3xl mx-auto leading-relaxed opacity-90">
              Your comprehensive business management system for tax preparation services and client management
            </p>

            {!session && (
              <Link href="/auth/signin" className="btn btn-accent btn-lg">
                Sign In
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Client Workflow Navigation */}
      {isAuthorized && (
        <section className="py-16 bg-base-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Select Client Type</h2>
              <p className="text-lg opacity-70">Choose the workflow for Personal or Corporate clients</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Personal Client Workflows */}
              <div className="card bg-base-100 shadow-2xl border-2 border-primary/20 hover:border-primary transition-all duration-300">
                <div className="card-body p-8">
                  <div className="flex items-center justify-center mb-6">
                    <div className="text-6xl">👤</div>
                  </div>
                  <h3 className="card-title text-3xl mb-6 justify-center text-primary">
                    Personal Clients
                  </h3>
                  <p className="text-center opacity-70 mb-8 text-lg">
                    Individual tax returns and personal tax preparation services
                  </p>

                  <div className="space-y-4">
                    {personalWorkflows.map((workflow, index) => (
                      <Link
                        key={index}
                        href={workflow.href}
                        className={`btn ${workflow.buttonClass} btn-lg w-full justify-start text-lg group`}
                      >
                        <span className="text-2xl mr-3">{workflow.icon}</span>
                        {workflow.title}
                        <svg className="w-5 h-5 ml-auto group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {/* Corporate Client Workflows */}
              <div className="card bg-base-100 shadow-2xl border-2 border-secondary/20 hover:border-secondary transition-all duration-300">
                <div className="card-body p-8">
                  <div className="flex items-center justify-center mb-6">
                    <div className="text-6xl">🏢</div>
                  </div>
                  <h3 className="card-title text-3xl mb-6 justify-center text-secondary">
                    Corporate Clients
                  </h3>
                  <p className="text-center opacity-70 mb-8 text-lg">
                    Business services including reconciliation, tax returns, and more
                  </p>

                  <div className="space-y-4">
                    {corporateWorkflows.map((workflow, index) => (
                      <Link
                        key={index}
                        href={workflow.href}
                        className={`btn ${workflow.buttonClass} btn-lg w-full justify-start text-lg group`}
                      >
                        <span className="text-2xl mr-3">{workflow.icon}</span>
                        {workflow.title}
                        <svg className="w-5 h-5 ml-auto group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Additional Tools Section */}
      {isAuthorized && (
        <section className="py-16 bg-base-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Additional Tools</h2>
              <p className="text-lg opacity-70">Access more features and management tools</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Link href="/airtable-dashboard" className="card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="card-body items-center text-center">
                  <div className="text-5xl mb-4">📊</div>
                  <h3 className="card-title text-xl mb-2">Airtable Dashboard</h3>
                  <p className="text-sm opacity-70">Database overview and analytics</p>
                </div>
              </Link>

              <Link href="/processor-billing" className="card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="card-body items-center text-center">
                  <div className="text-5xl mb-4">💰</div>
                  <h3 className="card-title text-xl mb-2">Processor Billing</h3>
                  <p className="text-sm opacity-70">Billing and revenue analytics</p>
                </div>
              </Link>

              <Link href="/manage-contacts" className="card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="card-body items-center text-center">
                  <div className="text-5xl mb-4">👥</div>
                  <h3 className="card-title text-xl mb-2">Manage Contacts</h3>
                  <p className="text-sm opacity-70">Link contacts to companies</p>
                </div>
              </Link>

              <Link href="/training-videos" className="card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="card-body items-center text-center">
                  <div className="text-5xl mb-4">🎥</div>
                  <h3 className="card-title text-xl mb-2">Training Videos</h3>
                  <p className="text-sm opacity-70">Educational content and tutorials</p>
                </div>
              </Link>

              <Link href="/filing-deadlines" className="card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="card-body items-center text-center">
                  <div className="text-5xl mb-4">📅</div>
                  <h3 className="card-title text-xl mb-2">Filing Deadlines</h3>
                  <p className="text-sm opacity-70">Tax deadline tracking</p>
                </div>
              </Link>

              <Link href="/view-display" className="card bg-base-100 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                <div className="card-body items-center text-center">
                  <div className="text-5xl mb-4">👁️</div>
                  <h3 className="card-title text-xl mb-2">View Display</h3>
                  <p className="text-sm opacity-70">Custom Airtable views</p>
                </div>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Quick Access for Public Users */}
      <section className="py-16 bg-base-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="card bg-base-100 shadow-xl border-2 border-info/20">
            <div className="card-body">
              <div className="text-5xl mb-4">🎓</div>
              <h2 className="card-title text-2xl md:text-3xl justify-center mb-4">
                Training Resources Available
              </h2>
              <p className="text-lg opacity-70 mb-6">
                Access comprehensive training videos and educational content
              </p>
              <Link href="/training-videos" className="btn btn-info btn-lg">
                View Training Videos
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}