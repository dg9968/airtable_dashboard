# Pipeline Notes Setup Checklist

Follow these steps to set up the conversation system for the Tax Prep Pipeline.

## ✅ Step 1: Create the Airtable Table

1. Open your Airtable base
2. Click the `+` button to add a new table
3. Name it exactly: **Pipeline Notes** (case-sensitive)

## ✅ Step 2: Add the Required Fields

In the Pipeline Notes table, create these fields with **exact names**:

| Field Name | Field Type | Configuration | Notes |
|------------|-----------|---------------|--------|
| **Subscription** | Link to another record | → Subscriptions Personal | Links to the pipeline record |
| **Author Name** | Single line text | - | Required field |
| **Author Email** | Email | - | Optional but recommended |
| **Note** | Long text | - | Required field for message content |
| **Created Time** | Created time | Auto-populated | Required for sorting |
| **Client Name** | Lookup | From Subscription → Full Name | Optional, for easy reference |

### Detailed Instructions for Each Field:

**1. Subscription (Link to another record)**
- Click "+ Add field"
- Select "Link to another record"
- Choose "Subscriptions Personal" from the list
- Name: "Subscription"
- Click "Create field"

**2. Author Name (Single line text)**
- Click "+ Add field"
- Select "Single line text"
- Name: "Author Name"
- Click "Create field"

**3. Author Email (Email)**
- Click "+ Add field"
- Select "Email"
- Name: "Author Email"
- Click "Create field"

**4. Note (Long text)**
- Click "+ Add field"
- Select "Long text"
- Name: "Note"
- Enable "Enable rich text formatting" if desired
- Click "Create field"

**5. Created Time (Created time)**
- Click "+ Add field"
- Select "Created time"
- Name: "Created Time"
- Click "Create field"

**6. Client Name (Lookup) - Optional**
- Click "+ Add field"
- Select "Lookup"
- Name: "Client Name"
- Choose "Subscription" as the linked record field
- Choose "Full Name" as the lookup field
- Click "Create field"

## ✅ Step 3: Verify the Table Structure

Your Pipeline Notes table should look like this:

```
| Subscription | Author Name | Author Email | Note | Created Time | Client Name |
|--------------|-------------|--------------|------|--------------|-------------|
| (empty)      | (empty)     | (empty)      | ... | (auto)       | (lookup)    |
```

## ✅ Step 4: Test the System

1. Restart your development server:
   ```bash
   bun run dev:server
   ```

2. Navigate to the Tax Prep Pipeline in your browser:
   ```
   http://localhost:3000/tax-prep-pipeline
   ```

3. Click the "💬 View" button on any client

4. The conversation modal should open with an empty state message

5. Type a test message and press Enter

6. The message should appear in the conversation thread

7. Close and reopen the modal - your message should still be there!

## ✅ Step 5: Verify in Airtable

1. Go back to your Airtable base
2. Open the "Pipeline Notes" table
3. You should see your test message with:
   - Subscription linked to the client
   - Your name as Author Name
   - Your email as Author Email
   - The message text in Note
   - Automatic timestamp in Created Time
   - Client name showing via lookup

## 🔧 Troubleshooting

### Error: "Could not find table Pipeline Notes"
- **Solution**: Make sure the table name is exactly "Pipeline Notes" (with capital P and N)
- Check that you're in the correct Airtable base
- Verify your `AIRTABLE_BASE_ID` environment variable is correct

### Messages not appearing after sending
- Open browser console (F12) and check for errors
- Look at server logs for API errors
- Verify the "Subscription" field is properly linked to "Subscriptions Personal"

### Can't see previous messages when reopening modal
- Check browser console for "[PipelineNotes] Loaded X messages"
- Verify the Airtable filter formula is working (check server logs)
- Make sure "Created Time" field exists and is populated

### "Author Name" is blank
- Ensure you're logged in with NextAuth
- Check that your session has a valid user.name
- Verify in browser console that `session.user.name` exists

## 📊 Expected Behavior

### When opening the conversation modal:
1. Loading spinner appears briefly
2. All previous messages load automatically
3. Messages are sorted oldest-first (chronological order)
4. Auto-scrolls to the newest message
5. Empty state shows if no messages exist

### When sending a message:
1. Message appears immediately in the thread (optimistic update)
2. API call creates the record in Airtable
3. Conversation refreshes after 500ms to get server timestamp
4. Message persists when you close and reopen the modal

### When multiple users are chatting:
1. Each user sees their own messages immediately
2. Other users' messages appear when they refresh (click ↻ button)
3. All messages show author name and timestamp
4. Color-coded avatars help distinguish between users

## 🎉 Success!

Once you see messages appearing and persisting, the conversation system is fully functional!

You can now:
- Have team conversations about each client
- Track communication history
- See who said what and when
- Collaborate effectively on tax preparation

For more details, see [PIPELINE_CONVERSATION_SYSTEM.md](./PIPELINE_CONVERSATION_SYSTEM.md)
