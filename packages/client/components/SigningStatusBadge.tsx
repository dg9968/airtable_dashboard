'use client';

interface SigningStatusBadgeProps {
  status: 'none' | 'Created' | 'Sent' | 'Delivered' | 'Viewed' | 'Signed' | 'Completed' | 'Declined' | 'Voided';
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
}

const statusConfig: Record<string, { color: string; label: string; icon: string }> = {
  'none': { color: '', label: '', icon: '' },
  'Created': { color: 'badge-ghost', label: 'Created', icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6' },
  'Sent': { color: 'badge-info', label: 'Sent', icon: 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5' },
  'Delivered': { color: 'badge-info', label: 'Delivered', icon: 'M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75' },
  'Viewed': { color: 'badge-warning', label: 'Viewed', icon: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178zM15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  'Signed': { color: 'badge-success', label: 'Signed', icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  'Completed': { color: 'badge-success', label: 'Completed', icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  'Declined': { color: 'badge-error', label: 'Declined', icon: 'M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  'Voided': { color: 'badge-neutral', label: 'Voided', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
};

export default function SigningStatusBadge({ status, size = 'sm', showLabel = true }: SigningStatusBadgeProps) {
  if (status === 'none') {
    return null;
  }

  const config = statusConfig[status] || statusConfig['none'];
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
export function SigningStatusIcon({ status, size = 'sm' }: { status: string; size?: 'xs' | 'sm' | 'md' }) {
  const config = statusConfig[status] || statusConfig['none'];
  if (!config.icon) return null;

  const colorClass = {
    'badge-info': 'text-info',
    'badge-warning': 'text-warning',
    'badge-success': 'text-success',
    'badge-error': 'text-error',
    'badge-neutral': 'text-base-content opacity-50',
    'badge-ghost': 'text-base-content opacity-50',
  }[config.color] || 'text-base-content';

  const sizeClass = size === 'xs' ? 'w-4 h-4' : size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';

  return (
    <div className="tooltip" data-tip={config.label}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className={`${sizeClass} ${colorClass}`}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
      </svg>
    </div>
  );
}
