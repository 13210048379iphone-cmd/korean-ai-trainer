import { describe, expect, it } from "vitest";
import { evaluateSpeech } from "./scoring.js";

describe("evaluateSpeech", () => {
  it("returns retry for empty recognition", () => {
    const result = evaluateSpeech("안녕하세요 저는 학생입니다", "");
    expect(result.finalScore).toBe(0);
    expect(result.verdict).toBe("retry");
    expect(result.message).toBe("未识别清晰，请重新朗读");
  });

  it("returns retry for non-korean recognition", () => {
    const result = evaluateSpeech("안녕하세요 저는 학생입니다", "hello world");
    expect(result.finalScore).toBe(0);
    expect(result.verdict).toBe("retry");
  });

  it("returns correct for close match", () => {
    const result = evaluateSpeech("저는 오늘 학교에 가요", "저는 오늘 학교에 가요");
    expect(result.finalScore).toBeGreaterThanOrEqual(80);
    expect(result.verdict).toBe("correct");
  });

  it("returns partial or retry for short reading", () => {
    const result = evaluateSpeech("저는 오늘 학교에 가요 친구와 같이 공부해요", "저는 오늘 학교");
    expect(result.lengthScore).toBeLessThan(80);
    expect(["partial", "retry"]).toContain(result.verdict);
  });
});
