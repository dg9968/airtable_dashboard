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

  // During SSR / before hydration, render nothing interactive.
  // Any component calling authClient.useSession() (Header, HomePage, etc.) will
  // crash on the server because better-auth's ESM bundle calls useRef before
  // React's hook dispatcher is initialised. Suppress the entire tree until the
  // client has mounted, then let React hydrate normally.
  if (!mounted) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="navbar bg-primary text-primary-content shadow-lg" />
        <main className="flex-1" />
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
