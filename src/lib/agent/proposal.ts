import { z } from "zod";

const calendarArgs = z.strictObject({
  title: z.string().trim().min(1).max(120),
  startIso: z.iso.datetime({ offset: true }),
  endIso: z.iso.datetime({ offset: true }),
  timezone: z.string().min(1).max(64),
  attendees: z.array(z.email().max(320)).max(3).optional(),
  addMeet: z.boolean().optional(),
}).refine((value) => Date.parse(value.endIso) > Date.parse(value.startIso), {
  message: "Event end must be after start",
});

export const calendarActionSchema = z.strictObject({
  tool: z.literal("calendar.create_event"),
  args: calendarArgs,
});

const taskArgs = z.strictObject({
  title: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(1_000).optional(),
  dueDate: z.iso.date().optional(),
});

export const taskActionSchema = z.strictObject({
  tool: z.literal("tasks.create_task"),
  args: taskArgs,
});

export const mailActionSchema = z.strictObject({
  tool: z.literal("gmail.send"),
  args: z.strictObject({
    to: z.email().max(320),
    subject: z.string().trim().min(1).max(150).refine((value) => !/[\r\n]/u.test(value)),
    body: z.string().trim().min(1).max(4_000),
  }),
});

export const proposedActionSchema = z.discriminatedUnion("tool", [calendarActionSchema, taskActionSchema, mailActionSchema]);

export const proposalSchema = z.strictObject({
  kind: z.enum(["action_plan", "needs_clarification", "unsupported"]),
  assistantMessage: z.string().trim().min(1).max(500),
  questions: z.array(z.string().trim().min(1).max(200)).max(3),
  actions: z.array(proposedActionSchema).max(1),
}).superRefine((value, ctx) => {
  if (value.kind === "action_plan" && value.actions.length !== 1) {
    ctx.addIssue({ code: "custom", message: "An action plan requires one action" });
  }
  if (value.kind !== "action_plan" && value.actions.length !== 0) {
    ctx.addIssue({ code: "custom", message: "Only action plans may include actions" });
  }
  if (value.kind === "needs_clarification" && value.questions.length === 0) {
    ctx.addIssue({ code: "custom", message: "Clarification requires a question" });
  }
  if (value.questions.join(" ").length > 500) {
    ctx.addIssue({ code: "custom", message: "Clarification is too long for voice" });
  }
});

export type Proposal = z.infer<typeof proposalSchema>;

/** Provider guidance with per-tool shapes; the stricter Zod contract remains authoritative. */
export const providerProposalSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["action_plan", "needs_clarification", "unsupported"] },
    assistantMessage: { type: "string" },
    questions: { type: "array", items: { type: "string" } },
    actions: {
      type: "array",
      maxItems: 1,
      items: { anyOf: [
        {
          type: "object", title: "CalendarEvent",
          properties: {
            tool: { type: "string", enum: ["calendar.create_event"] },
            args: { type: "object", properties: {
              title: { type: "string" }, startIso: { type: "string" }, endIso: { type: "string" }, timezone: { type: "string" },
              attendees: { type: "array", maxItems: 3, items: { type: "string" } }, addMeet: { type: "boolean" },
            }, required: ["title", "startIso", "endIso", "timezone"] },
          }, required: ["tool", "args"],
        },
        {
          type: "object", title: "GoogleTask",
          properties: {
            tool: { type: "string", enum: ["tasks.create_task"] },
            args: { type: "object", properties: { title: { type: "string" }, notes: { type: "string" }, dueDate: { type: "string" } }, required: ["title"] },
          }, required: ["tool", "args"],
        },
        {
          type: "object", title: "GmailSend",
          properties: {
            tool: { type: "string", enum: ["gmail.send"] },
            args: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject", "body"] },
          }, required: ["tool", "args"],
        },
      ] },
    },
  },
  required: ["kind", "assistantMessage", "questions", "actions"],
} as const;
