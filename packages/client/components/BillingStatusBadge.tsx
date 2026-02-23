'use client';

interface BillingStatusBadgeProps {
  status: 'Unbilled' | 'Billed - Paid' | 'Billed - Unpaid' | 'Waived' | 'Part of Subscription' | string;
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
}

const statusConfig: Record<string, { color: string; label: string; icon: string }> = {
  'Unbilled': {
    color: 'badge-warning',
    label: 'Unbilled',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', // clock
  },
  'Billed - Paid': {
    color: 'badge-success',
    label: 'Paid',
    icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z', // check circle
  },
  'Billed - Unpaid': {
    color: 'badge-error',
    label: 'Unpaid',
    icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z', // exclamation circle
  },
  'Waived': {
    color: 'badge-ghost',
    label: 'Waived',
    icon: 'M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z', // x circle
  },
  'Part of Subscription': {
    color: 'badge-info',
    label: 'Subscription',
    icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z', // credit card
  },
};

export default function BillingStatusBadge({ status, size = 'sm', showLabel = true }: BillingStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig['Unbilled'];
  const sizeClass = size === 'xs' ? 'badge-xs' : size === 'sm' ? 'badge-sm' : 'badge-md';
  const iconSize = size === 'xs' ? 'w-3 h-3' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <span className={`badge ${config.color} ${sizeClass} gap-1`}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className={iconSize}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
      </svg>
      {showLabel && config.label}
    </span>
  );
}

// Compact version for inline use
export function BillingStatusIcon({ status, size = 'sm' }: { status: string; size?: 'xs' | 'sm' | 'md' }) {
  const config = statusConfig[status] || statusConfig['Unbilled'];

  const colorClass: Record<string, string> = {
    'badge-info': 'text-info',
    'badge-warning': 'text-warning',
    'badge-success': 'text-success',
    'badge-error': 'text-error',
    'badge-ghost': 'text-base-content opacity-50',
  };

  const sizeClass = size === 'xs' ? 'w-4 h-4' : size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';

  return (
    <div className="tooltip" data-tip={config.label}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className={`${sizeClass} ${colorClass[config.color] || 'text-base-content'}`}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
      </svg>
    </div>
  );
}
