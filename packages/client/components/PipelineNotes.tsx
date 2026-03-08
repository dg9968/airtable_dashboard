"use client";

import NotesConversation from "./NotesConversation";

interface PipelineNotesProps {
  subscriptionId: string;
  clientName: string;
}

export default function PipelineNotes({ subscriptionId, clientName }: PipelineNotesProps) {
  return (
    <NotesConversation
      entityId={subscriptionId}
      entityIdFieldName="subscriptionId"
      apiBasePath="/api/pipeline-notes"
      fetchSubPath="subscription"
      title="💬 Conversation"
      subtitle={`for ${clientName}`}
    />
  );
}
