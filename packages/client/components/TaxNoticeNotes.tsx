"use client";

import NotesConversation from "./NotesConversation";

interface TaxNoticeNotesProps {
  noticeId: string;
  clientName: string;
}

export default function TaxNoticeNotes({ noticeId, clientName }: TaxNoticeNotesProps) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  return (
    <NotesConversation
      entityId={noticeId}
      entityIdFieldName="noticeId"
      apiBasePath={`${apiUrl}/api/tax-notice-notes`}
      fetchSubPath="notice"
      title="Activity Notes"
      subtitle={`for ${clientName}`}
    />
  );
}
