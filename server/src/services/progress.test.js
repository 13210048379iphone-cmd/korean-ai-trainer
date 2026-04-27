import { describe, expect, it } from "vitest";
import { addDays, calculateStreak, nextLevel, recentThreeDayAverage, summarizeProgress } from "./progress.js";

describe("progress service", () => {
  it("summarizes today vs yesterday progress", () => {
    const todayKey = "2026-04-27";
    const today = new Date("2026-04-27T10:00:00.000Z");
    const yesterday = new Date("2026-04-26T10:00:00.000Z");
    const output = summarizeProgress({
      todayKey,
      records: [
        { date: today, score: 80 },
        { date: today, score: 100 },
        { date: yesterday, score: 60 }
      ],
      errors: [{ updatedAt: today }, { updatedAt: yesterday }, { updatedAt: yesterday }]
    });

    expect(output.todayAverageScore).toBe(90);
    expect(output.yesterdayAverageScore).toBe(60);
    expect(output.scoreDelta).toBe(30);
    expect(output.errorReduction).toBe(1);
  });

  it("computes recent 3 day average", () => {
    const records = [
      { date: new Date("2026-04-27T08:00:00.000Z"), score: 90 },
      { date: new Date("2026-04-26T08:00:00.000Z"), score: 80 },
      { date: new Date("2026-04-25T08:00:00.000Z"), score: 70 }
    ];
    expect(Math.round(recentThreeDayAverage(records))).toBe(80);
  });

  it("computes level and streak helpers", () => {
    expect(nextLevel("A1", 1)).toBe("A2");
    expect(nextLevel("A6", 1)).toBe("A6");
    const streak = calculateStreak(["2026-04-27", "2026-04-26", "2026-04-25"], "2026-04-27");
    expect(streak).toBe(3);
    expect(addDays("2026-04-27", -1)).toBe("2026-04-26");
  });
});
