"use client";

import NotesConversation from "./NotesConversation";

interface CorporatePipelineNotesProps {
  subscriptionId: string;
  companyName: string;
}

export default function CorporatePipelineNotes({ subscriptionId, companyName }: CorporatePipelineNotesProps) {
  return (
    <NotesConversation
      entityId={subscriptionId}
      entityIdFieldName="subscriptionId"
      apiBasePath="/api/corporate-pipeline-notes"
      fetchSubPath="subscription"
      title="Conversation"
      subtitle={`for ${companyName}`}
    />
  );
}
