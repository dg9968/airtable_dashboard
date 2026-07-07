CREATE TABLE "company_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text,
	"corporation_id" text,
	"role" text,
	"is_primary_contact" boolean DEFAULT false NOT NULL,
	"work_email" text,
	"work_phone" text,
	"department" text,
	"start_date" text,
	"end_date" text,
	"status" text,
	"legacy_auto_number" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "corporations" (
	"id" text PRIMARY KEY NOT NULL,
	"company" text,
	"ein" text,
	"client_code" text,
	"client_code_override" text,
	"email" text,
	"phone" text,
	"language_preference" text,
	"address" text,
	"city" text,
	"state" text,
	"zip" text,
	"sunbiz_document_number" text,
	"entity_number" text,
	"type_of_entity" text,
	"type" text,
	"date_incorporated" text,
	"fiscal_year_end" text,
	"registered_agent" text,
	"contact" text,
	"industry" text,
	"website" text,
	"notas" text,
	"notes" text,
	"st_certificate_number_ids" text[],
	"st_certificate_values" text[],
	"business_partner_numbers" text[],
	"tax_returns_2025_ids" text[],
	"unemployment_account_ids" text[],
	"communications_corporate_ids" text[],
	"subscriptions_ids" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text,
	"last_name" text,
	"client_code" text,
	"client_code_override" text,
	"ssn" text,
	"tax_year" integer,
	"date_of_birth" text,
	"mailing_address" text,
	"city" text,
	"state" text,
	"zip" text,
	"email" text,
	"prior_year_agi" numeric,
	"phone" text,
	"status" text,
	"filing_status" text,
	"account_type" text,
	"preferred_contact" text,
	"associate_responsible" text[],
	"occupation" text,
	"driver_license" text,
	"identity_protection_pin" text,
	"bank_name" text,
	"account_number" text,
	"routing_number" text,
	"secondary_phone" text,
	"corporate_name" text,
	"spouse_name" text,
	"spouse_ssn" text,
	"spouse_dob" text,
	"spouse_occupation" text,
	"subscriptions_personal_ids" text[],
	"tax_documents_ids" text[],
	"signing_envelopes_ids" text[],
	"bank_info_ids" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_relationships" (
	"id" text PRIMARY KEY NOT NULL,
	"personal_id" text NOT NULL,
	"related_personal_id" text NOT NULL,
	"relationship" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_contact_id_personal_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."personal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_corporation_id_corporations_id_fk" FOREIGN KEY ("corporation_id") REFERENCES "public"."corporations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_relationships" ADD CONSTRAINT "personal_relationships_personal_id_personal_id_fk" FOREIGN KEY ("personal_id") REFERENCES "public"."personal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_relationships" ADD CONSTRAINT "personal_relationships_related_personal_id_personal_id_fk" FOREIGN KEY ("related_personal_id") REFERENCES "public"."personal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_contacts_contact_idx" ON "company_contacts" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "company_contacts_corporation_idx" ON "company_contacts" USING btree ("corporation_id");--> statement-breakpoint
CREATE INDEX "corporations_client_code_idx" ON "corporations" USING btree ("client_code");--> statement-breakpoint
CREATE INDEX "corporations_ein_idx" ON "corporations" USING btree ("ein");--> statement-breakpoint
CREATE INDEX "corporations_company_idx" ON "corporations" USING btree ("company");--> statement-breakpoint
CREATE INDEX "personal_client_code_idx" ON "personal" USING btree ("client_code");--> statement-breakpoint
CREATE INDEX "personal_email_idx" ON "personal" USING btree ("email");--> statement-breakpoint
CREATE INDEX "personal_ssn_idx" ON "personal" USING btree ("ssn");--> statement-breakpoint
CREATE INDEX "personal_last_name_idx" ON "personal" USING btree ("last_name");--> statement-breakpoint
CREATE UNIQUE INDEX "personal_relationships_unique_idx" ON "personal_relationships" USING btree ("personal_id","related_personal_id","relationship");--> statement-breakpoint
CREATE INDEX "personal_relationships_personal_idx" ON "personal_relationships" USING btree ("personal_id");--> statement-breakpoint
CREATE INDEX "personal_relationships_related_idx" ON "personal_relationships" USING btree ("related_personal_id");