"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

interface PipelineNote {
  id: string;
  fields: {
    "Author Name": string;
    "Author Email"?: string;
    "Note": string;
    "Created Time": string;
  };
}

interface PipelineNotesProps {
  subscriptionId: string;
  clientName: string;
}

export default function PipelineNotes({ subscriptionId, clientName }: PipelineNotesProps) {
  const { data: session } = useSession();
  const [notes, setNotes] = useState<PipelineNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const notesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    notesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionId]);

  useEffect(() => {
    scrollToBottom();
  }, [notes]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      console.log('[PipelineNotes] Fetching notes for subscription:', subscriptionId);

      const response = await fetch(`/api/pipeline-notes/subscription/${subscriptionId}`);
      const data = await response.json();

      console.log('[PipelineNotes] Response:', data);

      if (data.success) {
        // Sort notes from oldest to newest by Created Time
        const sortedNotes = [...data.data].sort((a: PipelineNote, b: PipelineNote) => {
          const timeA = new Date(a.fields["Created Time"]).getTime();
          const timeB = new Date(b.fields["Created Time"]).getTime();
          return timeA - timeB; // Ascending order (oldest first)
        });
        setNotes(sortedNotes);
        console.log('[PipelineNotes] Loaded', sortedNotes.length, 'messages');
      } else {
        console.error('[PipelineNotes] Failed to fetch notes:', data.error);
        // If table doesn't exist, show helpful message
        if (data.error?.includes('Could not find table') || data.error?.includes('NOT_FOUND')) {
          alert('⚠️ Pipeline Notes table not found in Airtable.\n\nPlease create the table as described in the documentation:\ndocs/PIPELINE_CONVERSATION_SYSTEM.md');
        }
      }
    } catch (error) {
      console.error("[PipelineNotes] Error fetching notes:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newNote.trim() || !session?.user) return;

    try {
      setSubmitting(true);

      const response = await fetch(`/api/pipeline-notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscriptionId,
          authorName: session.user.name || "Unknown User",
          authorEmail: session.user.email || "",
          note: newNote.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Optimistically add the new message
        setNotes([...notes, data.data]);
        setNewNote("");

        // Refresh the full conversation to ensure we have the latest data
        // This also gets the correct server timestamp
        setTimeout(() => fetchNotes(), 500);
      } else {
        alert("Failed to add note: " + (data.error || "Unknown error"));
      }
    } catch (error) {
      console.error("Error adding note:", error);
      alert("Failed to add note. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-primary",
      "bg-secondary",
      "bg-accent",
      "bg-info",
      "bg-success",
      "bg-warning",
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="card-title text-lg">
            💬 Conversation
            <span className="text-sm font-normal opacity-70">for {clientName}</span>
          </h3>
          <button
            className="btn btn-ghost btn-sm btn-circle"
            onClick={() => fetchNotes()}
            disabled={loading}
            title="Refresh conversation"
          >
            {loading ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </button>
        </div>

        {/* Messages Container */}
        <div className="bg-base-200 rounded-lg p-4 mb-4 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <span className="loading loading-spinner loading-md"></span>
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8 opacity-60">
              <div className="text-4xl mb-2">💭</div>
              <p className="text-sm">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.id} className="flex gap-3">
                  {/* Avatar */}
                  <div className={`avatar placeholder shrink-0`}>
                    <div className={`${getAvatarColor(note.fields["Author Name"])} text-neutral-content rounded-full w-10 h-10`}>
                      <span className="text-xs font-semibold">
                        {getInitials(note.fields["Author Name"])}
                      </span>
                    </div>
                  </div>

                  {/* Message Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-semibold text-sm">
                        {note.fields["Author Name"]}
                      </span>
                      <span className="text-xs opacity-60">
                        {formatTimestamp(note.fields["Created Time"])}
                      </span>
                    </div>
                    <div className="bg-base-100 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words">
                      {note.fields["Note"]}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={notesEndRef} />
            </div>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <textarea
            className="textarea textarea-bordered flex-1 min-h-[2.5rem] max-h-32 resize-y text-sm"
            placeholder="Type a message..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            disabled={submitting}
            rows={1}
          />
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={submitting || !newNote.trim()}
          >
            {submitting ? (
              <span className="loading loading-spinner loading-xs"></span>
            ) : (
              "Send"
            )}
          </button>
        </form>
        <p className="text-xs opacity-60 mt-1">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
