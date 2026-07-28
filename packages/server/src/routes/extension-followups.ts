/**
 * GET /api/extension-followups
 *
 * Clients whose extension was filed and now have an open follow-up ticket
 * (auto-created by extensions.ts / extensions-personal.ts on Extension
 * Status -> Filed, see ../lib/extension-followup.ts) tracking the actual
 * return, sorted soonest-deadline-first so staff can see who's at risk of
 * missing the extended due date.
 */

import { Hono } from 'hono';
import { alias } from 'drizzle-orm/pg-core';
import { and, eq, isNull, ne, notInArray, or } from 'drizzle-orm';
import { getDb } from '../db/client';
import { corporatePipelineTickets, personalPipelineTickets, corporations, personal } from '../db/schema';
import { getExtensionDueDatePersonal, toDateOnlyString } from '../lib/extension-deadlines';

const app = new Hono();

const CORPORATE_TERMINAL_STATUS = 'Complete Service';
const PERSONAL_TERMINAL_STATUSES = ['File Return', 'Filed Elsewhere'];

app.get('/', async (c) => {
  try {
    const db = getDb();
    const corpFollowUp = alias(corporatePipelineTickets, 'corp_follow_up');
    const personalFollowUp = alias(personalPipelineTickets, 'personal_follow_up');

    const corporateRows = await db
      .select({
        extensionTicketId: corporatePipelineTickets.id,
        corporationId: corporatePipelineTickets.corporationId,
        companyName: corporations.company,
        extensionTaxYear: corporatePipelineTickets.extensionTaxYear,
        extensionFiledDate: corporatePipelineTickets.extensionFiledDate,
        followUpTicketId: corpFollowUp.id,
        followUpStatus: corpFollowUp.status,
        dueDate: corpFollowUp.dueDate,
      })
      .from(corporatePipelineTickets)
      .innerJoin(corpFollowUp, eq(corporatePipelineTickets.extensionFollowUpTicketId, corpFollowUp.id))
      .leftJoin(corporations, eq(corporatePipelineTickets.corporationId, corporations.id))
      .where(
        and(
          eq(corporatePipelineTickets.extensionStatus, 'Filed'),
          or(isNull(corpFollowUp.status), ne(corpFollowUp.status, CORPORATE_TERMINAL_STATUS))
        )
      );

    const personalRows = await db
      .select({
        extensionTicketId: personalPipelineTickets.id,
        personalId: personalPipelineTickets.personalId,
        clientFirstName: personal.firstName,
        clientLastName: personal.lastName,
        extensionTaxYear: personalPipelineTickets.extensionTaxYear,
        extensionFiledDate: personalPipelineTickets.extensionFiledDate,
        followUpTicketId: personalFollowUp.id,
        followUpStatus: personalFollowUp.status,
      })
      .from(personalPipelineTickets)
      .innerJoin(personalFollowUp, eq(personalPipelineTickets.extensionFollowUpTicketId, personalFollowUp.id))
      .leftJoin(personal, eq(personalPipelineTickets.personalId, personal.id))
      .where(
        and(
          eq(personalPipelineTickets.extensionStatus, 'Filed'),
          or(isNull(personalFollowUp.status), notInArray(personalFollowUp.status, PERSONAL_TERMINAL_STATUSES))
        )
      );

    const corporate = corporateRows
      .map((r) => ({
        extensionTicketId: r.extensionTicketId,
        corporationId: r.corporationId,
        followUpTicketId: r.followUpTicketId,
        followUpStatus: r.followUpStatus,
        name: r.companyName ?? '(unnamed)',
        taxYear: r.extensionTaxYear,
        filedDate: r.extensionFiledDate,
        dueDate: r.dueDate,
      }))
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));

    const personalList = personalRows
      .map((r) => {
        const taxYear = r.extensionTaxYear ?? new Date().getFullYear() - 1;
        return {
          extensionTicketId: r.extensionTicketId,
          personalId: r.personalId,
          followUpTicketId: r.followUpTicketId,
          followUpStatus: r.followUpStatus,
          name: [r.clientFirstName, r.clientLastName].filter(Boolean).join(' ') || '(unnamed)',
          taxYear: r.extensionTaxYear,
          filedDate: r.extensionFiledDate,
          dueDate: toDateOnlyString(getExtensionDueDatePersonal(taxYear)),
        };
      })
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));

    return c.json({ success: true, data: { corporate, personal: personalList } });
  } catch (error) {
    console.error('GET /api/extension-followups error:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load extension follow-ups' },
      500
    );
  }
});

export default app;
