ALTER TABLE "action_plans" ADD COLUMN "approval_user_id" text;--> statement-breakpoint
ALTER TABLE "action_plans" ADD COLUMN "approval_event_id" uuid;--> statement-breakpoint
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_approval_user_id_users_id_fk" FOREIGN KEY ("approval_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;