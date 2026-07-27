/**
 * Notifies a Corporate Services processor by email when they're assigned to
 * a corporate_pipeline_tickets row — the Postgres-era replacement for the
 * old Airtable "email the responsible party" automation.
 *
 * Delivery reuses the same n8n webhook (N8N_WEBHOOK_URL) that
 * communications-webhook.ts / communications-batch.ts already use for real
 * email dispatch — this is a distinct payload shape (mode: 'ticket-assigned')
 * since it's an internal staff notification, not a client communication tied
 * to the messages/communications_corporate tables. The n8n workflow needs a
 * branch that recognizes this mode and sends via `to` / `emailSubject` /
 * `emailContent`.
 *
 * Best-effort: never throws. A failure here must not fail the PATCH request
 * that triggered it — same contract as the existing webhook call sites.
 */

interface NotifyProcessorAssignedParams {
  ticketId: string;
  processor: { name: string; email: string };
  company: string;
  serviceName: string;
}

export async function notifyProcessorAssigned({
  ticketId,
  processor,
  company,
  serviceName,
}: NotifyProcessorAssignedParams): Promise<void> {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn(`[notify-processor-assigned] N8N_WEBHOOK_URL not configured, skipping notification for ticket ${ticketId}`);
    return;
  }

  const payload = {
    mode: 'ticket-assigned',
    ticketId,
    timestamp: new Date().toISOString(),
    to: processor.email,
    processorName: processor.name,
    company,
    serviceName,
    emailSubject: `You've been assigned: ${company} — ${serviceName}`,
    emailContent: `Hi ${processor.name},\n\nYou've been assigned the "${serviceName}" ticket for ${company}.\n\nTicket ID: ${ticketId}`,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[notify-processor-assigned] Webhook failed for ticket ${ticketId}: ${response.statusText} - ${errorText}`);
      return;
    }

    console.log(`[notify-processor-assigned] Notified ${processor.email} for ticket ${ticketId}`);
  } catch (error) {
    console.error(`[notify-processor-assigned] Webhook error for ticket ${ticketId}:`, error);
  }
}
