/**
 * Auto-creates (or re-links to) the "real work" ticket that tracks actual
 * tax-return preparation once an Extensions/File Extension ticket is marked
 * Filed. Without this, the extension being filed was the only record of
 * that client's extended deadline — nothing tracked the follow-up work of
 * actually completing the return before it hit.
 *
 * Idempotent: if the extension ticket is already linked to a follow-up
 * ticket that's still open, does nothing. Failures (missing corporation/
 * person data, missing catalog service) are logged and swallowed — marking
 * an extension Filed must still succeed even if auto-linking can't happen.
 */

import { eq } from 'drizzle-orm';
import type { getDb } from '../db/client';
import {
  corporatePipelineTickets,
  personalPipelineTickets,
  servicesCorporate,
  personalServices,
  corporations,
  personal,
} from '../db/schema';
import { getExtensionDueDateCorporate, getExtensionDueDatePersonal, toDateOnlyString } from './extension-deadlines';

type Db = ReturnType<typeof getDb>;

const CORPORATE_TERMINAL_STATUS = 'Complete Service';
const PERSONAL_TERMINAL_STATUSES = ['File Return', 'Filed Elsewhere'];

const CORPORATE_FOLLOW_UP_SERVICE = 'Tax Returns';
const PERSONAL_FOLLOW_UP_SERVICE = 'Tax Prep Pipeline';

export async function ensureCorporateExtensionFollowUp(db: Db, ticketId: string): Promise<void> {
  const [ticket] = await db
    .select()
    .from(corporatePipelineTickets)
    .where(eq(corporatePipelineTickets.id, ticketId))
    .limit(1);
  if (!ticket) return;

  if (ticket.extensionFollowUpTicketId) {
    const [existing] = await db
      .select({ status: corporatePipelineTickets.status })
      .from(corporatePipelineTickets)
      .where(eq(corporatePipelineTickets.id, ticket.extensionFollowUpTicketId))
      .limit(1);
    if (existing && existing.status !== CORPORATE_TERMINAL_STATUS) return; // still open, nothing to do
  }

  if (!ticket.corporationId) {
    console.error(`ensureCorporateExtensionFollowUp: ticket ${ticketId} has no linked corporation, skipping`);
    return;
  }

  const [corp] = await db.select().from(corporations).where(eq(corporations.id, ticket.corporationId)).limit(1);
  if (!corp) {
    console.error(`ensureCorporateExtensionFollowUp: corporation ${ticket.corporationId} not found, skipping`);
    return;
  }

  const [service] = await db
    .select({ id: servicesCorporate.id })
    .from(servicesCorporate)
    .where(eq(servicesCorporate.name, CORPORATE_FOLLOW_UP_SERVICE))
    .limit(1);
  if (!service) {
    console.error(`ensureCorporateExtensionFollowUp: catalog service "${CORPORATE_FOLLOW_UP_SERVICE}" not found, skipping`);
    return;
  }

  const taxYear = ticket.extensionTaxYear ?? new Date().getFullYear() - 1;
  const dueDate = getExtensionDueDateCorporate(corp.typeOfEntity || '', corp.fiscalYearEnd || '12/31', taxYear);
  const filedDate = ticket.extensionFiledDate || toDateOnlyString(new Date());

  const [followUp] = await db
    .insert(corporatePipelineTickets)
    .values({
      corporationId: ticket.corporationId,
      serviceId: service.id,
      dueDate: toDateOnlyString(dueDate),
      notes: `Auto-created: extension filed ${filedDate}, return due ${toDateOnlyString(dueDate)}.`,
    })
    .returning();

  await db
    .update(corporatePipelineTickets)
    .set({ extensionFollowUpTicketId: followUp.id })
    .where(eq(corporatePipelineTickets.id, ticketId));
}

export async function ensurePersonalExtensionFollowUp(db: Db, ticketId: string): Promise<void> {
  const [ticket] = await db
    .select()
    .from(personalPipelineTickets)
    .where(eq(personalPipelineTickets.id, ticketId))
    .limit(1);
  if (!ticket) return;

  if (ticket.extensionFollowUpTicketId) {
    const [existing] = await db
      .select({ status: personalPipelineTickets.status })
      .from(personalPipelineTickets)
      .where(eq(personalPipelineTickets.id, ticket.extensionFollowUpTicketId))
      .limit(1);
    if (existing && !PERSONAL_TERMINAL_STATUSES.includes(existing.status ?? '')) return; // still open
  }

  if (!ticket.personalId) {
    console.error(`ensurePersonalExtensionFollowUp: ticket ${ticketId} has no linked personal record, skipping`);
    return;
  }

  const [person] = await db.select().from(personal).where(eq(personal.id, ticket.personalId)).limit(1);
  if (!person) {
    console.error(`ensurePersonalExtensionFollowUp: personal record ${ticket.personalId} not found, skipping`);
    return;
  }

  const [service] = await db
    .select({ id: personalServices.id })
    .from(personalServices)
    .where(eq(personalServices.name, PERSONAL_FOLLOW_UP_SERVICE))
    .limit(1);
  if (!service) {
    console.error(`ensurePersonalExtensionFollowUp: catalog service "${PERSONAL_FOLLOW_UP_SERVICE}" not found, skipping`);
    return;
  }

  const taxYear = ticket.extensionTaxYear ?? new Date().getFullYear() - 1;
  const dueDate = getExtensionDueDatePersonal(taxYear);
  const filedDate = ticket.extensionFiledDate || toDateOnlyString(new Date());

  const [followUp] = await db
    .insert(personalPipelineTickets)
    .values({
      personalId: ticket.personalId,
      serviceId: service.id,
      notes: `Auto-created: extension filed ${filedDate}, return due ${toDateOnlyString(dueDate)}.`,
    })
    .returning();

  await db
    .update(personalPipelineTickets)
    .set({ extensionFollowUpTicketId: followUp.id })
    .where(eq(personalPipelineTickets.id, ticketId));
}
