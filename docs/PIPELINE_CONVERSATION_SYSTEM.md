# Pipeline Conversation System

A message board/conversation system for the Tax Prep Pipeline that allows team members to communicate about specific clients.

## Overview

This system replaces the simple "Notes" field with a full conversation thread that:
- Tracks who said what and when
- Shows message history chronologically
- Displays user avatars and names
- Auto-scrolls to latest messages
- Supports real-time collaboration between team members

## Architecture

### Database Structure

**Airtable Table: Pipeline Notes**

Fields:
- `Subscription` (Link to Subscriptions Personal) - Links to the pipeline record
- `Author Name` (Single line text) - Who wrote the note
- `Author Email` (Email) - Author's email address
- `Note` (Long text) - The actual message/note content
- `Created Time` (Created time) - Auto-populated timestamp
- `Client Name` (Lookup from Subscription → Full Name) - For easy reference

### API Endpoints

**Server Routes:** [packages/server/src/routes/pipeline-notes.ts](../packages/server/src/routes/pipeline-notes.ts)

- `POST /api/pipeline-notes` - Create a new note
- `GET /api/pipeline-notes/subscription/:subscriptionId` - Get all notes for a subscription
- `GET /api/pipeline-notes` - Get all notes (admin)
- `PATCH /api/pipeline-notes/:id` - Update a note
- `DELETE /api/pipeline-notes/:id` - Delete a note

### Frontend Components

**PipelineNotes Component:** [packages/client/components/PipelineNotes.tsx](../packages/client/components/PipelineNotes.tsx)

Features:
- Message thread display with avatars
- Author identification and timestamps
- Relative time display (e.g., "2h ago", "Just now")
- Auto-scroll to latest message
- Text input with Enter to send, Shift+Enter for new line
- Color-coded avatars based on author name
- Responsive design

**Integration:** [packages/client/components/TaxPrepPipeline.tsx](../packages/client/components/TaxPrepPipeline.tsx)

The conversation modal opens when you click the "💬 View" button in the Conversation column.

## Quick Start

📋 **For detailed setup instructions, see [PIPELINE_NOTES_SETUP_CHECKLIST.md](./PIPELINE_NOTES_SETUP_CHECKLIST.md)**

## Setup Instructions

### 1. Create Airtable Table

In your Airtable base, create a new table named **"Pipeline Notes"** with these exact field names:

| Field Name | Field Type | Configuration |
|------------|-----------|---------------|
| Subscription | Link to another record | Link to "Subscriptions Personal" table |
| Author Name | Single line text | - |
| Author Email | Email | - |
| Note | Long text | - |
| Created Time | Created time | Auto-populated |
| Client Name | Lookup | From Subscription → Full Name |

### 2. Restart the Server

The API routes are already registered in the server. Simply restart:

```bash
bun run dev:server
```

### 3. Test the System

1. Navigate to the Tax Prep Pipeline (`/tax-prep-pipeline`)
2. Click the "💬 View" button in the Conversation column for any client
3. Type a message and press Enter
4. Your message should appear in the conversation thread

## Features

### Message Display
- **Avatars**: Color-coded initials based on author name
- **Timestamps**: Relative time (e.g., "5m ago") with full date on hover
- **Author Names**: Clear identification of who wrote each message
- **Auto-scroll**: Automatically scrolls to newest messages
- **Previous Messages**: All previous conversations load automatically when opening the modal
- **Refresh Button**: Manual refresh button to reload the conversation anytime

### Message Input
- **Enter to Send**: Press Enter to send message
- **Shift+Enter**: Add a new line in the message
- **Real-time**: Messages appear immediately after sending
- **User Context**: Automatically uses logged-in user's name and email

### UI/UX
- **Modal Interface**: Opens in a modal overlay
- **Scrollable History**: Max height with scroll for long conversations
- **Loading States**: Shows spinner while loading messages
- **Empty State**: Friendly message when no conversation exists yet

## Usage Examples

### Starting a Conversation

1. Tax preparer assigns themselves to a client
2. Clicks "💬 View" to open the conversation modal
3. **Previous messages load automatically** - any existing conversation history is displayed
4. Writes: "Called client - waiting for W2 documents"
5. Presses Enter to send (or clicks Send button)
6. Message is saved with timestamp and author info
7. Message appears immediately in the conversation thread

### Continuing the Conversation

1. Manager reviews the pipeline
2. Opens the same client's conversation
3. **All previous messages load automatically** - sees the preparer's message from earlier
4. Replies: "Follow up tomorrow if no response"
5. Presses Enter to send
6. Both messages are visible in chronological order
7. Can use the refresh button (↻) to reload and see any new messages from other users

### Conversation Persistence

- **All messages are saved permanently** in Airtable
- **Opening the modal always loads the complete conversation history**
- **Messages are sorted chronologically** (oldest first)
- **Each time you open the conversation**, it fetches the latest data from the server

### Benefits Over Old Notes Field

**Before (Notes field):**
- ❌ No tracking of who wrote what
- ❌ No timestamps
- ❌ Easy to accidentally overwrite
- ❌ Hard to follow conversation flow

**After (Conversation system):**
- ✅ Every message has an author
- ✅ Automatic timestamps
- ✅ Append-only (messages are added, not overwritten)
- ✅ Clear conversation thread
- ✅ Better team collaboration

## Migration Notes

The old `Notes` field in the Subscriptions Personal table is still there but no longer displayed in the UI. If you have existing notes you want to preserve:

1. Manually copy important notes into the new conversation system
2. Or create a migration script to convert old notes into initial messages

## Future Enhancements

Potential improvements:
- [ ] Edit/delete your own messages
- [ ] @mention other team members
- [ ] File attachments in messages
- [ ] Mark conversations as resolved
- [ ] Push notifications for new messages
- [ ] Search across all conversations
- [ ] Filter by author or date range

## Technical Details

### Authentication
Uses NextAuth session to get current user's name and email automatically.

### State Management
React local state with optimistic updates for responsive UI.

### API Communication
Direct calls to Bun server API using fetch with NEXT_PUBLIC_API_URL.

### Styling
Uses DaisyUI components with Tailwind CSS for consistent design.

## Troubleshooting

**Messages not appearing?**
- Check that the Pipeline Notes table exists in Airtable
- Verify field names match exactly (case-sensitive)
- Check server logs for API errors
- Ensure AIRTABLE_BASE_ID and AIRTABLE_PERSONAL_ACCESS_TOKEN are set

**Can't send messages?**
- Ensure you're logged in (session must exist)
- Check browser console for JavaScript errors
- Verify server is running on correct port

**Timestamps showing wrong time?**
- Times are displayed in the user's local timezone
- Airtable stores in UTC, JavaScript converts to local time
