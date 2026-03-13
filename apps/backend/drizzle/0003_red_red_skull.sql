DROP TABLE "agent_runs" CASCADE;--> statement-breakpoint
DROP TABLE "workflow_approvals" CASCADE;--> statement-breakpoint
ALTER TABLE "incidents" DROP COLUMN "processing_mode";--> statement-breakpoint
ALTER TABLE "project_documents" DROP COLUMN "slug";--> statement-breakpoint
ALTER TABLE "project_documents" DROP COLUMN "checksum";--> statement-breakpoint
DROP TYPE "public"."agent_run_status";--> statement-breakpoint
DROP TYPE "public"."approval_mode";--> statement-breakpoint
DROP TYPE "public"."approval_status";--> statement-breakpoint
DROP TYPE "public"."processing_mode";--> statement-breakpoint
DROP TYPE "public"."risk_level";