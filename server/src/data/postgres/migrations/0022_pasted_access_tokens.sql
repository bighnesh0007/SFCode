ALTER TABLE "salesforce_connections" ALTER COLUMN "refresh_token_enc" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "salesforce_connections" ADD COLUMN "auth_type" text DEFAULT 'oauth' NOT NULL;