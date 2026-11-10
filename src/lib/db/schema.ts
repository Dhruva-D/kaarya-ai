import { randomUUID } from "node:crypto";
import type { AdapterAccountType } from "next-auth/adapters";
import {
  foreignKey,
  index,
  integer,
  jsonb,
  boolean,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const time = (name: string) => timestamp(name, { withTimezone: true });

// Auth.js compatible user fields; account/session tables are added with the auth slice.
export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: time("email_verified"),
  image: text("image"),
});

export const accounts = pgTable("accounts", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<AdapterAccountType>().notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })]);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: time("expires").notNull(),
});

export const googleConnections = pgTable("google_connections", {
  id: uuid("id").primaryKey().$defaultFn(() => randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  providerSubject: text("provider_subject").notNull(),
  scopes: text("scopes").notNull(),
  accessTokenCiphertext: text("access_token_ciphertext").notNull(),
  refreshTokenCiphertext: text("refresh_token_ciphertext"),
  keyVersion: integer("key_version").notNull().default(1),
  expiresAt: time("expires_at"),
  status: varchar("status", { length: 24 }).notNull().default("connected"),
  updatedAt: time("updated_at").notNull().defaultNow(),
}, (table) => [uniqueIndex("google_connections_user_subject_uq").on(table.userId, table.providerSubject)]);

export const providerRateLimits = pgTable("provider_rate_limits", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  operation: varchar("operation", { length: 24 }).notNull(),
  windowStart: time("window_start").notNull(),
  count: integer("count").notNull().default(0),
}, (table) => [primaryKey({ columns: [table.userId, table.operation, table.windowStart] })]);

export const profiles = pgTable("profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  preferredLanguage: varchar("preferred_language", { length: 16 }).notNull().default("hi-IN"),
  timezone: varchar("timezone", { length: 64 }).notNull().default("Asia/Kolkata"),
  createdAt: time("created_at").notNull().defaultNow(),
  updatedAt: time("updated_at").notNull().defaultNow(),
});

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().$defaultFn(() => randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 160 }).notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
  updatedAt: time("updated_at").notNull().defaultNow(),
  archivedAt: time("archived_at"),
}, (table) => [
  uniqueIndex("conversations_id_user_uq").on(table.id, table.userId),
  index("conversations_user_created_idx").on(table.userId, table.createdAt),
]);

export const messageRole = pgEnum("message_role", ["user", "assistant"]);
export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().$defaultFn(() => randomUUID()),
  conversationId: uuid("conversation_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: messageRole("role").notNull(),
  content: varchar("content", { length: 4_000 }).notNull(),
  inputMode: varchar("input_mode", { length: 16 }),
  languageCode: varchar("language_code", { length: 16 }),
  providerModel: varchar("provider_model", { length: 80 }),
  clientRequestId: uuid("client_request_id"),
  createdAt: time("created_at").notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.conversationId, table.userId], foreignColumns: [conversations.id, conversations.userId] }).onDelete("cascade"),
  index("messages_conversation_created_idx").on(table.conversationId, table.createdAt),
  uniqueIndex("messages_user_request_uq").on(table.userId, table.clientRequestId),
]);

export const planStatus = pgEnum("plan_status", [
  "draft", "needs_details", "awaiting_approval", "executing", "succeeded", "failed", "unknown", "rejected", "expired", "superseded",
]);
export const actionPlans = pgTable("action_plans", {
  id: uuid("id").primaryKey().$defaultFn(() => randomUUID()),
  conversationId: uuid("conversation_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  status: planStatus("status").notNull().default("awaiting_approval"),
  canonicalHash: varchar("canonical_hash", { length: 64 }).notNull(),
  expiresAt: time("expires_at").notNull(),
  approvedAt: time("approved_at"),
  approvalUserId: text("approval_user_id").references(() => users.id),
  approvalEventId: uuid("approval_event_id"),
  createdAt: time("created_at").notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.conversationId, table.userId], foreignColumns: [conversations.id, conversations.userId] }).onDelete("cascade"),
  uniqueIndex("action_plans_id_user_uq").on(table.id, table.userId),
  index("action_plans_user_status_idx").on(table.userId, table.status),
]);

export const actionStatus = pgEnum("action_status", ["pending", "executing", "succeeded", "failed", "unknown"]);
export const actions = pgTable("actions", {
  id: uuid("id").primaryKey().$defaultFn(() => randomUUID()),
  planId: uuid("plan_id").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 64 }).notNull(),
  argumentsJson: jsonb("arguments_json").notNull(),
  status: actionStatus("status").notNull().default("pending"),
  sequenceNo: integer("sequence_no").notNull().default(0),
  executionKey: uuid("execution_key").notNull(),
  provider: varchar("provider", { length: 32 }),
  providerObjectId: varchar("provider_object_id", { length: 256 }),
  providerLink: text("provider_link"),
  errorCode: varchar("error_code", { length: 64 }),
  attemptedAt: time("attempted_at"),
  completedAt: time("completed_at"),
  createdAt: time("created_at").notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.planId, table.userId], foreignColumns: [actionPlans.id, actionPlans.userId] }).onDelete("cascade"),
  uniqueIndex("actions_execution_key_uq").on(table.executionKey),
  index("actions_user_created_idx").on(table.userId, table.createdAt),
  index("actions_provider_object_idx").on(table.provider, table.providerObjectId),
]);

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().$defaultFn(() => randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  displayName: varchar("display_name", { length: 120 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  isConfirmed: boolean("is_confirmed").notNull().default(false),
  createdAt: time("created_at").notNull().defaultNow(),
}, (table) => [index("contacts_user_name_idx").on(table.userId, table.displayName)]);

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: time("expires").notNull(),
}, (table) => [primaryKey({ columns: [table.identifier, table.token] })]);
