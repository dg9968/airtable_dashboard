"use client";

import NotesConversation from "./NotesConversation";

interface BillingNotesProps {
  serviceRenderedId: string;
  clientName: string;
  serviceName: string;
}

export default function BillingNotes({ serviceRenderedId, clientName, serviceName }: BillingNotesProps) {
  return (
    <NotesConversation
      entityId={serviceRenderedId}
      entityIdFieldName="serviceRenderedId"
      apiBasePath="/api/billing-notes"
      fetchSubPath="service"
      title="Billing Notes"
      subtitle={`${clientName} - ${serviceName}`}
    />
  );
}
