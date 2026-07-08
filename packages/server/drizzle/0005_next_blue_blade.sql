CREATE TYPE "public"."envelope_status" AS ENUM('Created', 'Sent', 'Delivered', 'Viewed', 'Signed', 'Completed', 'Declined', 'Voided');--> statement-breakpoint
CREATE TABLE "communications_corporate" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text,
	"corporation_id" text,
	"status" text,
	"description" text,
	"batch_id" text,
	"personalized_subject" text,
	"personalized_content" text,
	"variable_values" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"email_subject" text,
	"email_content" text,
	"is_batch_message" boolean DEFAULT false NOT NULL,
	"batch_id" text,
	"template_used_id" text,
	"variables_used" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signing_envelopes" (
	"id" text PRIMARY KEY NOT NULL,
	"status" "envelope_status" DEFAULT 'Created' NOT NULL,
	"client_type" text,
	"signer_email" text,
	"signer_name" text,
	"signer2_email" text,
	"signer2_name" text,
	"tax_year" text,
	"document_type" text,
	"source_drive_file_id" text,
	"created_by" text,
	"document_id" text,
	"personal_id" text,
	"corporation_id" text,
	"template_used_id" text,
	"envelope_id" text,
	"error_message" text,
	"sent_at" text,
	"completed_at" text,
	"signed_drive_file_id" text,
	"voided_at" text,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "communications_corporate" ADD CONSTRAINT "communications_corporate_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communications_corporate" ADD CONSTRAINT "communications_corporate_corporation_id_corporations_id_fk" FOREIGN KEY ("corporation_id") REFERENCES "public"."corporations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_template_used_id_message_templates_id_fk" FOREIGN KEY ("template_used_id") REFERENCES "public"."message_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_envelopes" ADD CONSTRAINT "signing_envelopes_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_envelopes" ADD CONSTRAINT "signing_envelopes_personal_id_personal_id_fk" FOREIGN KEY ("personal_id") REFERENCES "public"."personal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_envelopes" ADD CONSTRAINT "signing_envelopes_corporation_id_corporations_id_fk" FOREIGN KEY ("corporation_id") REFERENCES "public"."corporations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_envelopes" ADD CONSTRAINT "signing_envelopes_template_used_id_signing_templates_id_fk" FOREIGN KEY ("template_used_id") REFERENCES "public"."signing_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "communications_corporate_corporation_idx" ON "communications_corporate" USING btree ("corporation_id");--> statement-breakpoint
CREATE INDEX "communications_corporate_batch_idx" ON "communications_corporate" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "messages_batch_id_idx" ON "messages" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "signing_envelopes_status_idx" ON "signing_envelopes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "signing_envelopes_envelope_id_idx" ON "signing_envelopes" USING btree ("envelope_id");--> statement-breakpoint
CREATE INDEX "signing_envelopes_document_idx" ON "signing_envelopes" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "signing_envelopes_personal_idx" ON "signing_envelopes" USING btree ("personal_id");--> statement-breakpoint
CREATE INDEX "signing_envelopes_corporation_idx" ON "signing_envelopes" USING btree ("corporation_id");