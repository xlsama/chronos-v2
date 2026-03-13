ALTER TABLE "incidents" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "incidents" ALTER COLUMN "status" SET DEFAULT 'new'::text;--> statement-breakpoint
UPDATE "incidents" SET "status" = 'completed' WHERE "status" = 'closed';--> statement-breakpoint
DROP TYPE "public"."incident_status";--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('new', 'triaging', 'in_progress', 'waiting_human', 'resolved', 'summarizing', 'completed');--> statement-breakpoint
ALTER TABLE "incidents" ALTER COLUMN "status" SET DEFAULT 'new'::"public"."incident_status";--> statement-breakpoint
ALTER TABLE "incidents" ALTER COLUMN "status" SET DATA TYPE "public"."incident_status" USING "status"::"public"."incident_status";
