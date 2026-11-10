import { describe, expect, it } from "vitest";
import { calendarDetailQuestion, missingCalendarDetails } from "./calendar-slots";

describe("Calendar detail gate", () => {
  it("stops guessed one-hour plans and generic titles", () => {
    expect(missingCalendarDetails(["Set up a meeting at 5 PM titled new feature discussion"], "new feature discussion")).toEqual(["duration"]);
    expect(missingCalendarDetails(["ನಾಳೆ ಸಂಜೆ ಐದು ಗಂಟೆಗೆ ಮೀಟಿಂಗ್ ಇಡಿ"], "ಮೀಟಿಂಗ್")).toEqual(["title", "duration"]);
    expect(calendarDetailQuestion(["duration"], "kn-IN")).toContain("30 ನಿಮಿಷ");
  });

  it("accepts details stated across turns", () => {
    expect(missingCalendarDetails(["Create a synthetic project meeting tomorrow at 5 PM", "For 30 minutes"], "synthetic project meeting")).toEqual([]);
  });
});
