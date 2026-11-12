CREATE TABLE "daily_challenges" (
	"day" text PRIMARY KEY NOT NULL,
	"problem_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
