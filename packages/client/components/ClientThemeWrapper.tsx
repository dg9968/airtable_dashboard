// components/ClientThemeWrapper.tsx
'use client';

import { useEffect, useState } from 'react';

export default function ClientThemeWrapper({
  children
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Set initial theme from localStorage or default to cupcake
    const savedTheme = localStorage.getItem('theme') || 'cupcake';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div data-theme="cupcake">
        {children}
      </div>
    );
  }

  return <>{children}</>;
}