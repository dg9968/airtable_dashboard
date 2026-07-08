ALTER TABLE "ledger" ALTER COLUMN "amount_charged" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "services_rendered" ALTER COLUMN "amount_charged" SET DATA TYPE numeric;--> statement-breakpoint
ALTER TABLE "subscriptions_corporate" ALTER COLUMN "billing_amount" SET DATA TYPE numeric;