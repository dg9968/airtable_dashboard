"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { WorkflowPath } from "@/lib/workflow-utils";

interface WorkflowStep {
  number: number;
  name: string;
  path: string;
  icon: string;
  requiredRoles?: string[];
  description?: string;
}

const personalSteps: WorkflowStep[] = [
  {
    number: 1,
    name: "Client Intake",
    path: "/client-intake",
    icon: "👤",
    description: "Add new personal clients",
  },
  {
    number: 2,
    name: "Documents",
    path: "/document-management",
    icon: "📄",
    description: "Upload required documents",
  },
  {
    number: 3,
    name: "Tax Pipeline",
    path: "/tax-prep-pipeline",
    icon: "📋",
    description: "Process tax returns",
  },
  {
    number: 4,
    name: "Billing",
    path: "/billing?type=personal",
    icon: "💰",
    requiredRoles: ["staff", "admin"],
    description: "Process payments",
  },
];

const corporateSteps: WorkflowStep[] = [
  {
    number: 1,
    name: "Company Intake",
    path: "/corporate-client-intake",
    icon: "🏢",
    description: "Add new corporate clients",
  },
  {
    number: 2,
    name: "Documents",
    path: "/corporate-document-management",
    icon: "📄",
    description: "Upload corporate documents",
  },
  {
    number: 3,
    name: "Services Pipeline",
    path: "/corporate-services-pipeline",
    icon: "⚙️",
    description: "Manage corporate services",
  },
  {
    number: 4,
    name: "Billing",
    path: "/billing?type=corporate",
    icon: "💰",
    requiredRoles: ["staff", "admin"],
    description: "Process payments",
  },
];

interface WorkflowSidebarProps {
  currentStep: number;
  activePath: WorkflowPath;
}

export default function WorkflowSidebar({
  currentStep,
  activePath,
}: WorkflowSidebarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [selectedPath, setSelectedPath] = useState<WorkflowPath>(activePath);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load saved path from localStorage on mount
  useEffect(() => {
    const savedPath = localStorage.getItem("workflowPath") as WorkflowPath;
    if (savedPath === "personal" || savedPath === "corporate") {
      setSelectedPath(savedPath);
    }
  }, []);

  // Save path to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("workflowPath", selectedPath);
  }, [selectedPath]);

  const userRole = (session?.user as any)?.role;
  const steps = selectedPath === "personal" ? personalSteps : corporateSteps;

  // Filter steps based on user role
  const visibleSteps = steps.filter((step) => {
    if (!step.requiredRoles) return true;
    return step.requiredRoles.includes(userRole);
  });

  const handleStepClick = (path: string) => {
    setMobileMenuOpen(false);
    router.push(path);
  };

  const handlePathToggle = (path: WorkflowPath) => {
    setSelectedPath(path);
    // Navigate to step 1 of the new path
    const newSteps = path === "personal" ? personalSteps : corporateSteps;
    router.push(newSteps[0].path);
  };

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 btn btn-circle btn-primary"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {mobileMenuOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Overlay for mobile */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
        fixed lg:static top-0 left-0 h-screen w-64 bg-base-200
        transform transition-transform duration-300 ease-in-out z-40
        ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        flex flex-col
      `}
      >
        {/* Header */}
        <div className="p-4 border-b border-base-300">
          <Link
            href="/"
            className="btn btn-ghost text-lg font-bold normal-case w-full justify-start"
          >
            🏠 Home
          </Link>
        </div>

        {/* Path Toggle */}
        <div className="p-4 border-b border-base-300">
          <div className="btn-group w-full">
            <button
              className={`btn btn-sm flex-1 ${
                selectedPath === "personal" ? "btn-primary" : "btn-ghost"
              }`}
              onClick={() => handlePathToggle("personal")}
            >
              Personal
            </button>
            <button
              className={`btn btn-sm flex-1 ${
                selectedPath === "corporate" ? "btn-primary" : "btn-ghost"
              }`}
              onClick={() => handlePathToggle("corporate")}
            >
              Corporate
            </button>
          </div>
          <div className="text-xs text-center mt-2 opacity-70">
            {selectedPath === "personal" ? "Personal Workflow" : "Corporate Workflow"}
          </div>
        </div>

        {/* Workflow Steps */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {visibleSteps.map((step, index) => {
              const isActive = step.number === currentStep;
              const isCompleted = step.number < currentStep;

              return (
                <button
                  key={step.number}
                  onClick={() => handleStepClick(step.path)}
                  className={`
                    w-full h-16 rounded-lg transition-all duration-200
                    flex items-center gap-3 p-3
                    ${
                      isActive
                        ? "bg-primary text-primary-content shadow-lg"
                        : isCompleted
                        ? "bg-success bg-opacity-20 hover:bg-opacity-30"
                        : "bg-base-100 hover:bg-base-300"
                    }
                  `}
                >
                  {/* Step Number Circle */}
                  <div
                    className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    font-bold text-sm flex-shrink-0
                    ${
                      isActive
                        ? "bg-primary-content text-primary"
                        : isCompleted
                        ? "bg-success text-success-content"
                        : "bg-base-300"
                    }
                  `}
                  >
                    {isCompleted ? "✓" : step.number}
                  </div>

                  {/* Step Content */}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{step.icon}</span>
                      <span className="font-semibold text-sm">
                        {step.name}
                      </span>
                    </div>
                    <p className="text-xs opacity-70 line-clamp-1">
                      {step.description}
                    </p>
                  </div>

                  {/* Active Indicator */}
                  {isActive && (
                    <div className="w-2 h-2 rounded-full bg-primary-content animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Additional Links */}
        <div className="p-4 border-t border-base-300 space-y-2">
          <Link
            href="/training-videos"
            className="btn btn-ghost btn-sm w-full justify-start"
            onClick={() => setMobileMenuOpen(false)}
          >
            🎥 Training Videos
          </Link>
          <Link
            href="/ledger"
            className="btn btn-ghost btn-sm w-full justify-start"
            onClick={() => setMobileMenuOpen(false)}
          >
            📊 Ledger
          </Link>
          {userRole === "admin" && (
            <Link
              href="/admin"
              className="btn btn-ghost btn-sm w-full justify-start"
              onClick={() => setMobileMenuOpen(false)}
            >
              ⚙️ Admin
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}
