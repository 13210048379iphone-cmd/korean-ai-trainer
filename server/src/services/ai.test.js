import { describe, expect, it } from "vitest";
import { generateDailyTask } from "./ai.js";

function countIncludedUnknownWords(text, unknownWords) {
  return unknownWords.filter((word) => text.includes(word)).length;
}

describe("generateDailyTask personalization constraints", () => {
  it("enforces unknown words in readings and vocab distribution", async () => {
    const unknownWords = ["학교", "친구", "공부하다", "시장", "가족", "연습", "발음"];
    const errors = [
      { content: "발음", errorType: "wrong_word", count: 3 },
      { content: "시장", errorType: "vocab", count: 2 }
    ];
    const records = [
      { type: "reading", score: 60 },
      { type: "vocab", score: 70 }
    ];

    const task = await generateDailyTask({
      level: "A1",
      errors,
      records,
      unknownWords
    });

    expect(task.readings).toHaveLength(2);
    for (const reading of task.readings) {
      expect(countIncludedUnknownWords(reading.text, unknownWords)).toBeGreaterThanOrEqual(2);
    }

    expect(task.vocabulary).toHaveLength(10);
    const fromUnknown = task.vocabulary.filter((item) => unknownWords.includes(item.word)).length;
    expect(fromUnknown).toBeGreaterThanOrEqual(7);

    const errorContents = new Set(errors.map((item) => item.content));
    expect(task.review.length).toBeGreaterThan(0);
    for (const item of task.review) {
      expect(errorContents.has(item.content)).toBe(true);
    }
  });
});
