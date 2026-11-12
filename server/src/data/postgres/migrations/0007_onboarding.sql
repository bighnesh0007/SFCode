CREATE TABLE "user_onboarding" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"level" text NOT NULL,
	"goal" text NOT NULL,
	"hours" text NOT NULL,
	"roadmap_id" text NOT NULL,
	"read_nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
