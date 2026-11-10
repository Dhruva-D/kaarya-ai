import { describe, expect, it } from "vitest";
import { missingTaskDetails, taskDetailQuestion } from "./task-slots";

const action = { tool: "tasks.create_task" as const, args: { title: "Prepare synthetic demo", dueDate: "2026-11-11" } };

describe("Google Tasks detail gate", () => {
  it("does not turn a timed reminder into an unannounced date-only task", () => {
    expect(missingTaskDetails(["Remind me to Prepare synthetic demo at 5 PM tomorrow"], action)).toEqual(["timed"]);
    expect(taskDetailQuestion(["timed"], "kn-IN")).toContain("ದಿನಾಂಕವನ್ನು ಮಾತ್ರ");
    expect(missingTaskDetails(["Remind me to Prepare synthetic demo at 5 PM tomorrow", "Yes, date only"], action)).toEqual([]);
  });
  it("asks when the task title is invented", () => {
    expect(missingTaskDetails(["Make a task for tomorrow"], action)).toEqual(["title"]);
  });
  it("does not mistake a different Calendar action time for a timed Task", () => {
    expect(missingTaskDetails(["Schedule a meeting tomorrow at 7 PM. Also create a task called Prepare synthetic demo due tomorrow"], action)).toEqual([]);
    expect(missingTaskDetails(["Schedule a meeting tomorrow at 7 PM. Also create a task called Prepare synthetic demo due tomorrow", "Yes, create the task as date-only. Keep the calendar event at 7 PM"], action)).toEqual([]);
  });
});
