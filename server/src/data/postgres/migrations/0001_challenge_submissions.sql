CREATE TABLE "challenge_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"problem_slug" text NOT NULL,
	"org_id" text NOT NULL,
	"status" text NOT NULL,
	"deploy_id" text,
	"files" jsonb NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "challenge_submissions_user_problem_idx" ON "challenge_submissions" USING btree ("user_id","problem_slug","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_submissions_one_running_idx" ON "challenge_submissions" USING btree ("user_id") WHERE "challenge_submissions"."status" = 'running';