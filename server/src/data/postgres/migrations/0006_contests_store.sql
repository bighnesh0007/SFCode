CREATE TABLE "contest_entries" (
	"contest_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contest_entries_contest_id_user_id_pk" PRIMARY KEY("contest_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "contest_problems" (
	"contest_id" uuid NOT NULL,
	"problem_slug" text NOT NULL,
	"position" integer NOT NULL,
	"points" integer NOT NULL,
	CONSTRAINT "contest_problems_contest_id_problem_slug_pk" PRIMARY KEY("contest_id","problem_slug")
);
--> statement-breakpoint
CREATE TABLE "contests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_purchases" (
	"user_id" text NOT NULL,
	"item_id" text NOT NULL,
	"price" integer NOT NULL,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_purchases_user_id_item_id_pk" PRIMARY KEY("user_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "user_equipped" (
	"user_id" text NOT NULL,
	"slot" text NOT NULL,
	"item_id" text NOT NULL,
	CONSTRAINT "user_equipped_user_id_slot_pk" PRIMARY KEY("user_id","slot")
);
--> statement-breakpoint
ALTER TABLE "challenge_submissions" ADD COLUMN "contest_id" uuid;--> statement-breakpoint
ALTER TABLE "contest_entries" ADD CONSTRAINT "contest_entries_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contest_problems" ADD CONSTRAINT "contest_problems_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contests_slug_idx" ON "contests" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "contests_starts_idx" ON "contests" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "challenge_submissions_contest_idx" ON "challenge_submissions" USING btree ("contest_id");