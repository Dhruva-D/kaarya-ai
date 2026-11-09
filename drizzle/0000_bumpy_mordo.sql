CREATE TYPE "public"."action_status" AS ENUM('pending', 'executing', 'succeeded', 'failed', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."plan_status" AS ENUM('draft', 'needs_details', 'awaiting_approval', 'executing', 'succeeded', 'failed', 'unknown', 'rejected', 'expired', 'superseded');--> statement-breakpoint
CREATE TABLE "action_plans" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "plan_status" DEFAULT 'awaiting_approval' NOT NULL,
	"canonical_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"plan_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"type" varchar(64) NOT NULL,
	"arguments_json" jsonb NOT NULL,
	"status" "action_status" DEFAULT 'pending' NOT NULL,
	"sequence_no" integer DEFAULT 0 NOT NULL,
	"execution_key" uuid NOT NULL,
	"provider" varchar(32),
	"provider_object_id" varchar(256),
	"provider_link" text,
	"error_code" varchar(64),
	"attempted_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"email" varchar(320) NOT NULL,
	"is_confirmed" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "message_role" NOT NULL,
	"content" varchar(4000) NOT NULL,
	"input_mode" varchar(16),
	"provider_model" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"preferred_language" varchar(16) DEFAULT 'hi-IN' NOT NULL,
	"timezone" varchar(64) DEFAULT 'Asia/Kolkata' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"email_verified" timestamp with time zone,
	"image" text,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_id_user_uq" ON "conversations" USING btree ("id","user_id");--> statement-breakpoint
ALTER TABLE "action_plans" ADD CONSTRAINT "action_plans_conversation_id_user_id_conversations_id_user_id_fk" FOREIGN KEY ("conversation_id","user_id") REFERENCES "public"."conversations"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "action_plans_id_user_uq" ON "action_plans" USING btree ("id","user_id");--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_plan_id_user_id_action_plans_id_user_id_fk" FOREIGN KEY ("plan_id","user_id") REFERENCES "public"."action_plans"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_user_id_conversations_id_user_id_fk" FOREIGN KEY ("conversation_id","user_id") REFERENCES "public"."conversations"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_plans_user_status_idx" ON "action_plans" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "actions_execution_key_uq" ON "actions" USING btree ("execution_key");--> statement-breakpoint
CREATE INDEX "actions_user_created_idx" ON "actions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "actions_provider_object_idx" ON "actions" USING btree ("provider","provider_object_id");--> statement-breakpoint
CREATE INDEX "contacts_user_name_idx" ON "contacts" USING btree ("user_id","display_name");--> statement-breakpoint
CREATE INDEX "conversations_user_created_idx" ON "conversations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");
