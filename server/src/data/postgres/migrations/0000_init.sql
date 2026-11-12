CREATE TABLE "oauth_pending" (
	"nonce" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"login_url" text NOT NULL,
	"code_verifier_enc" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salesforce_connections" (
	"user_id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"sf_user_id" text NOT NULL,
	"username" text NOT NULL,
	"instance_url" text NOT NULL,
	"login_url" text NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
