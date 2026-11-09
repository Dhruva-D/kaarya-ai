CREATE TABLE "provider_rate_limits" (
	"user_id" text NOT NULL,
	"operation" varchar(24) NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "provider_rate_limits_user_id_operation_window_start_pk" PRIMARY KEY("user_id","operation","window_start")
);
--> statement-breakpoint
ALTER TABLE "provider_rate_limits" ADD CONSTRAINT "provider_rate_limits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;