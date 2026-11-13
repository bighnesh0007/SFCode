ALTER TABLE "oauth_pending" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "oauth_pending" ADD COLUMN "client_secret_enc" text;--> statement-breakpoint
ALTER TABLE "salesforce_connections" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "salesforce_connections" ADD COLUMN "client_secret_enc" text;