'use client';

import { useEffect } from 'react';

// The initial data-theme is set synchronously by the inline script in layout.tsx
// (before first paint, no flash). This component just syncs on mount as a safety net
// in case the script is blocked (CSP, etc.).
export default function ClientThemeWrapper({
  children
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!document.documentElement.hasAttribute('data-theme')) {
      const t = localStorage.getItem('app-theme') || 'cupcake';
      document.documentElement.setAttribute('data-theme', t);
    }
  }, []);

  return <>{children}</>;
}
