// app/calendar/page.tsx - FIXED VERSION
'use client';

import ServiceTaskCalendar from '@/components/ServiceTaskCalendar';

export default function CalendarPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <ServiceTaskCalendar />
    </div>
  );
}
