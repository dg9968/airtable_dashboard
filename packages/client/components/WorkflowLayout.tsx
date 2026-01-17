"use client";

import { ReactNode } from "react";
import WorkflowSidebar from "./WorkflowSidebar";
import { WorkflowPath } from "@/lib/workflow-utils";

interface WorkflowLayoutProps {
  children: ReactNode;
  currentStep: number;
  workflowPath: WorkflowPath;
}

export default function WorkflowLayout({
  children,
  currentStep,
  workflowPath,
}: WorkflowLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <WorkflowSidebar currentStep={currentStep} activePath={workflowPath} />
      <main className="flex-1 lg:ml-0 p-6 bg-base-100">
        {children}
      </main>
    </div>
  );
}
