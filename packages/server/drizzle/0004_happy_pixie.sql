CREATE TYPE "public"."tax_notice_status" AS ENUM('New Notice', 'Scanned / Uploaded', 'Initial Review', 'Waiting on Client', 'Research / Drafting', 'Drafting Response', 'Awaiting Client Signature', 'Response Signed', 'Needs Daniel Review', 'Ready to Submit', 'Submitted', 'Waiting on Agency', 'Resolved', 'Closed / Archived');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"client_code" text,
	"tax_year" text,
	"file_name" text,
	"original_name" text,
	"upload_date" text,
	"file_size" integer,
	"file_type" text,
	"uploaded_by" text,
	"google_drive_file_id" text,
	"web_view_link" text,
	"web_content_link" text,
	"document_category" text,
	"bank_name" text,
	"signing_envelopes_ids" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_notice_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"tax_notice_id" text,
	"file_name" text,
	"drive_id" text,
	"view_url" text,
	"file_type" text,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_notice_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"tax_notice_id" text,
	"author_name" text,
	"author_email" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_notices" (
	"id" text PRIMARY KEY NOT NULL,
	"status" "tax_notice_status" DEFAULT 'New Notice' NOT NULL,
	"client_name" text,
	"entity_name" text,
	"notice_agency" text,
	"notice_number" text,
	"tax_year" text,
	"tax_type" text,
	"date_received" text,
	"response_due_date" text,
	"amount_due" numeric,
	"notice_category" text,
	"assigned_owner" text,
	"supporting_team_member" text,
	"priority" text,
	"daniel_review_required" boolean DEFAULT false NOT NULL,
	"client_documents_needed" text,
	"response_filed_date" text,
	"proof_of_submission_uploaded" boolean DEFAULT false NOT NULL,
	"final_resolution" text,
	"created_by" text,
	"letter_drive_id" text,
	"letter_view_url" text,
	"letter_file_name" text,
	"response_sent_to_client_date" text,
	"client_signature_date" text,
	"response_sent_to_agency_date" text,
	"response_submission_method" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tax_notice_attachments" ADD CONSTRAINT "tax_notice_attachments_tax_notice_id_tax_notices_id_fk" FOREIGN KEY ("tax_notice_id") REFERENCES "public"."tax_notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_notice_notes" ADD CONSTRAINT "tax_notice_notes_tax_notice_id_tax_notices_id_fk" FOREIGN KEY ("tax_notice_id") REFERENCES "public"."tax_notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_client_year_idx" ON "documents" USING btree ("client_code","tax_year");--> statement-breakpoint
CREATE INDEX "documents_gdrive_idx" ON "documents" USING btree ("google_drive_file_id");--> statement-breakpoint
CREATE INDEX "tax_notice_attachments_notice_idx" ON "tax_notice_attachments" USING btree ("tax_notice_id");--> statement-breakpoint
CREATE INDEX "tax_notice_notes_notice_idx" ON "tax_notice_notes" USING btree ("tax_notice_id");--> statement-breakpoint
CREATE INDEX "tax_notices_status_idx" ON "tax_notices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tax_notices_due_date_idx" ON "tax_notices" USING btree ("response_due_date");