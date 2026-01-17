"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";
import WorkflowLayout from "./WorkflowLayout";
import {
  isWorkflowRoute,
  detectWorkflowStep,
  detectWorkflowPath,
} from "@/lib/workflow-utils";

interface ClientLayoutWrapperProps {
  children: ReactNode;
}

export default function ClientLayoutWrapper({
  children,
}: ClientLayoutWrapperProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // Only run on client side after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // During server-side rendering or initial client render, show default layout
  if (!mounted) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    );
  }

  const isWorkflow = isWorkflowRoute(pathname || "/");
  const currentStep = detectWorkflowStep(pathname || "/");
  const workflowPath = detectWorkflowPath(pathname || "/");

  if (isWorkflow) {
    return (
      <WorkflowLayout currentStep={currentStep} workflowPath={workflowPath}>
        {children}
      </WorkflowLayout>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
