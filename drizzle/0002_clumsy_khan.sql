ALTER TABLE "messages" ADD COLUMN "client_request_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_user_request_uq" ON "messages" USING btree ("user_id","client_request_id");