import { z } from "zod";

const calendarArgs = z.strictObject({
  title: z.string().trim().min(1).max(120),
  startIso: z.iso.datetime({ offset: true }),
  endIso: z.iso.datetime({ offset: true }),
  timezone: z.string().min(1).max(64),
}).refine((value) => Date.parse(value.endIso) > Date.parse(value.startIso), {
  message: "Event end must be after start",
});

export const calendarActionSchema = z.strictObject({
  tool: z.literal("calendar.create_event"),
  args: calendarArgs,
});

export const proposalSchema = z.strictObject({
  kind: z.enum(["action_plan", "needs_clarification", "unsupported"]),
  assistantMessage: z.string().trim().min(1).max(500),
  questions: z.array(z.string().trim().min(1).max(200)).max(3),
  actions: z.array(calendarActionSchema).max(1),
}).superRefine((value, ctx) => {
  if (value.kind === "action_plan" && value.actions.length !== 1) {
    ctx.addIssue({ code: "custom", message: "An action plan requires one Calendar action" });
  }
  if (value.kind !== "action_plan" && value.actions.length !== 0) {
    ctx.addIssue({ code: "custom", message: "Only action plans may include actions" });
  }
  if (value.kind === "needs_clarification" && value.questions.length === 0) {
    ctx.addIssue({ code: "custom", message: "Clarification requires a question" });
  }
});

export type Proposal = z.infer<typeof proposalSchema>;

/** Simple provider schema; the stricter Zod contract remains authoritative. */
export const providerProposalSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ["action_plan", "needs_clarification", "unsupported"] },
    assistantMessage: { type: "string" },
    questions: { type: "array", items: { type: "string" } },
    actions: {
      type: "array",
      maxItems: 1,
      items: {
        type: "object",
        properties: {
          tool: { type: "string", enum: ["calendar.create_event"] },
          args: {
            type: "object",
            properties: {
              title: { type: "string" },
              startIso: { type: "string" },
              endIso: { type: "string" },
              timezone: { type: "string" },
            },
            required: ["title", "startIso", "endIso", "timezone"],
          },
        },
        required: ["tool", "args"],
      },
    },
  },
  required: ["kind", "assistantMessage", "questions", "actions"],
} as const;
