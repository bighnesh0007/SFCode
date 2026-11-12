CREATE TABLE "cert_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"exam" text NOT NULL,
	"question_id" text NOT NULL,
	"correct" boolean NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "cert_attempts_user_exam_idx" ON "cert_attempts" USING btree ("user_id","exam","answered_at");