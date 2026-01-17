/**
 * Workflow Navigation Utilities
 * Helpers for detecting workflow steps and paths based on routes
 */

export type WorkflowPath = 'personal' | 'corporate';

/**
 * Workflow routes configuration
 */
export const WORKFLOW_ROUTES = [
  '/client-intake',
  '/corporate-client-intake',
  '/tax-prep-pipeline',
  '/corporate-services-pipeline',
  '/billing',
  '/document-management',
  '/corporate-document-management',
];

/**
 * Check if the given pathname is a workflow route
 */
export function isWorkflowRoute(pathname: string): boolean {
  return WORKFLOW_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * Detect which workflow step the user is on based on pathname
 * Returns 1-4 for valid workflow steps, 0 for non-workflow pages
 */
export function detectWorkflowStep(pathname: string): number {
  // Step 1: Client Intake
  if (pathname.startsWith('/client-intake')) {
    return 1;
  }
  if (pathname.startsWith('/corporate-client-intake')) {
    return 1;
  }

  // Step 2: Documents
  if (pathname.startsWith('/document-management') || pathname.startsWith('/corporate-document-management')) {
    return 2;
  }

  // Step 3: Pipeline
  if (pathname.startsWith('/tax-prep-pipeline')) {
    return 3;
  }
  if (pathname.startsWith('/corporate-services-pipeline')) {
    return 3;
  }

  // Step 4: Billing
  if (pathname.startsWith('/billing')) {
    return 4;
  }

  return 0;
}

/**
 * Detect which workflow path (personal/corporate) based on pathname
 * Defaults to 'personal' if ambiguous
 */
export function detectWorkflowPath(pathname: string): WorkflowPath {
  // Corporate routes
  if (
    pathname.startsWith('/corporate-client-intake') ||
    pathname.startsWith('/corporate-services-pipeline') ||
    pathname.startsWith('/corporate-document-management') ||
    pathname.includes('type=corporate')
  ) {
    return 'corporate';
  }

  // Personal routes (default)
  return 'personal';
}

/**
 * Get the next step path based on current step and workflow path
 */
export function getNextStepPath(currentStep: number, workflowPath: WorkflowPath): string | null {
  if (workflowPath === 'personal') {
    switch (currentStep) {
      case 1:
        return '/document-management';
      case 2:
        return '/tax-prep-pipeline';
      case 3:
        return '/billing?type=personal';
      case 4:
        return null; // Final step
      default:
        return null;
    }
  } else {
    // Corporate path
    switch (currentStep) {
      case 1:
        return '/corporate-document-management';
      case 2:
        return '/corporate-services-pipeline';
      case 3:
        return '/billing?type=corporate';
      case 4:
        return null; // Final step
      default:
        return null;
    }
  }
}

/**
 * Get the previous step path based on current step and workflow path
 */
export function getPreviousStepPath(currentStep: number, workflowPath: WorkflowPath): string | null {
  if (workflowPath === 'personal') {
    switch (currentStep) {
      case 2:
        return '/client-intake';
      case 3:
        return '/document-management';
      case 4:
        return '/tax-prep-pipeline';
      case 1:
        return null; // First step
      default:
        return null;
    }
  } else {
    // Corporate path
    switch (currentStep) {
      case 2:
        return '/corporate-client-intake';
      case 3:
        return '/corporate-document-management';
      case 4:
        return '/corporate-services-pipeline';
      case 1:
        return null; // First step
      default:
        return null;
    }
  }
}

/**
 * Get step name based on step number
 */
export function getStepName(step: number, workflowPath: WorkflowPath): string {
  if (workflowPath === 'personal') {
    switch (step) {
      case 1:
        return 'Client Intake';
      case 2:
        return 'Documents';
      case 3:
        return 'Tax Pipeline';
      case 4:
        return 'Billing';
      default:
        return '';
    }
  } else {
    switch (step) {
      case 1:
        return 'Company Intake';
      case 2:
        return 'Documents';
      case 3:
        return 'Services Pipeline';
      case 4:
        return 'Billing';
      default:
        return '';
    }
  }
}
