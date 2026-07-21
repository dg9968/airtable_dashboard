/**
 * Shared in-progress status vocabulary for the corporate and personal work
 * pipelines (corporate_pipeline_tickets.status / personal_pipeline_tickets.status).
 * Both columns are free text at the DB level (legacy Airtable single-select
 * fields, and some historical rows carry values outside this list — e.g.
 * personal's legacy "Filed" status), so this is a UI-level source of truth,
 * not a DB constraint. Kept as one shared list so the two pipeline screens
 * can't drift apart the way Subscriptions.tsx and CorporateServicesPipeline.tsx
 * once did over the same kind of status column.
 *
 * Each pipeline has its own terminal status/statuses (corporate: "Complete
 * Service"; personal: "File Return" / "Filed Elsewhere") layered on top of
 * this shared in-progress list.
 */

export interface PipelineStatusOption {
  value: string;
  actionLabel: string; // shown on the "Change Status" modal button, with emoji
  badgeColor: string; // DaisyUI color suffix, e.g. 'warning' -> 'bg-warning' / 'badge-warning'
  badgeLabel: string; // shown in the compact status badge
}

export const PIPELINE_IN_PROGRESS_STATUSES: PipelineStatusOption[] = [
  { value: 'Active', actionLabel: '▶️ Set Active', badgeColor: 'info', badgeLabel: 'Active' },
  { value: 'Hold for Customer', actionLabel: '⏸️ Hold for Customer', badgeColor: 'warning', badgeLabel: 'On Hold' },
  { value: 'Ready for Customer Review', actionLabel: '👀 Ready for Customer Review', badgeColor: 'secondary', badgeLabel: 'Ready for Review' },
  { value: 'Escalate to Manager', actionLabel: '⬆️ Escalate to Manager', badgeColor: 'error', badgeLabel: 'Escalated' },
];

export interface PipelineBadgeProps {
  badgeColor: string;
  badgeLabel: string;
}

/**
 * Resolve badge color/label for a status value, checking the shared
 * in-progress list first, then a pipeline-specific terminal-status map
 * passed in by the caller, falling back to the "Active" look for anything
 * unrecognized (including legacy/no-status rows).
 */
export function resolvePipelineStatusBadge(
  status: string | undefined,
  terminalStatuses: Record<string, PipelineBadgeProps>
): PipelineBadgeProps {
  if (status) {
    const shared = PIPELINE_IN_PROGRESS_STATUSES.find((s) => s.value === status);
    if (shared) return { badgeColor: shared.badgeColor, badgeLabel: shared.badgeLabel };
    if (terminalStatuses[status]) return terminalStatuses[status];
  }
  return { badgeColor: 'info', badgeLabel: 'Active' };
}
