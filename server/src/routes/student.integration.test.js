import express from "express";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  studyRecord: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
  errorDailyStat: { findMany: vi.fn(), upsert: vi.fn() },
  dailyTask: { findUnique: vi.fn(), deleteMany: vi.fn(), create: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  student: { findUnique: vi.fn(), update: vi.fn() },
  vocabularyStatus: { findUnique: vi.fn(), upsert: vi.fn() },
  errorRecord: { upsert: vi.fn(), findMany: vi.fn() },
  audioRecord: { create: vi.fn() },
  examResult: { create: vi.fn() }
}));

vi.mock("../db.js", () => ({ prisma: prismaMock }));
vi.mock("../middleware/auth.js", () => ({
  requireAuth: (req, _res, next) => {
    req.user = { id: "u1", role: "STUDENT", student: { id: "stu1", level: "A1" } };
    next();
  },
  requireRole: () => (_req, _res, next) => next()
}));
vi.mock("../services/ai.js", () => ({
  generateDailyTask: vi.fn(async () => ({
    readings: [{ id: "r1", title: "朗读1", text: "학교 친구 연습", translation: "t1" }, { id: "r2", title: "朗读2", text: "발음 시장 가족", translation: "t2" }],
    vocabulary: Array.from({ length: 10 }, (_, i) => ({ word: `w${i}`, meaning: `m${i}`, choices: ["a", "b", "c", "d"], answer: "a" })),
    review: [{ content: "발음", errorType: "wrong_word", count: 2 }],
    level: "A1"
  })),
  generateWeeklyExam: vi.fn(async () => ({ listening: [], vocabulary: [], reading: { text: "", prompt: "" }, rubric: {} })),
  analyzeSpeech: vi.fn(async () => ({ score: 80, finalScore: 80, verdict: "correct", missingWords: [], wrongWords: [] })),
  transcribeAudio: vi.fn(async () => ""),
  createSpeech: vi.fn(async () => null)
}));

let studentRouter;

beforeAll(async () => {
  studentRouter = (await import("./student.js")).default;
});

beforeEach(() => {
  vi.clearAllMocks();
});

function appWithRouter() {
  const app = express();
  app.use(express.json());
  app.use("/api/student", studentRouter);
  return app;
}

describe("student routes integration", () => {
  it("returns 409 when daily task already completed", async () => {
    prismaMock.dailyTask.findUnique.mockResolvedValueOnce({
      payload: { completion: { isCompleted: true }, readings: [], vocabulary: [], review: [] }
    });

    const response = await request(appWithRouter()).post("/api/student/daily/generate").send({});
    expect(response.status).toBe(409);
    expect(response.body.message).toContain("今日任务已完成");
  });

  it("returns levelUpdate when recent 3-day average is high", async () => {
    prismaMock.vocabularyStatus.findUnique.mockResolvedValueOnce({ errorCount: 1 });
    prismaMock.vocabularyStatus.upsert.mockResolvedValueOnce({});
    prismaMock.studyRecord.create.mockResolvedValueOnce({});

    // getProgressFeedback
    prismaMock.studyRecord.findMany.mockResolvedValueOnce([
      { date: new Date("2026-04-27T08:00:00.000Z"), score: 80 },
      { date: new Date("2026-04-26T08:00:00.000Z"), score: 70 }
    ]);
    prismaMock.errorDailyStat.findMany.mockResolvedValueOnce([]);

    // maybeCompleteDailyTask (skip completion)
    prismaMock.dailyTask.findUnique.mockResolvedValueOnce(null);

    // maybeUpdateLevel
    prismaMock.studyRecord.findMany.mockResolvedValueOnce([
      { date: new Date("2026-04-27T08:00:00.000Z"), score: 90 },
      { date: new Date("2026-04-26T08:00:00.000Z"), score: 92 },
      { date: new Date("2026-04-25T08:00:00.000Z"), score: 93 }
    ]);
    prismaMock.student.findUnique.mockResolvedValueOnce({ level: "A1" });
    prismaMock.student.update.mockResolvedValueOnce({ level: "A2" });

    // final student fetch
    prismaMock.student.findUnique.mockResolvedValueOnce({ streakDays: 3 });

    const response = await request(appWithRouter())
      .post("/api/student/vocab/answer")
      .send({ word: "학교", selected: "学校", answer: "学校" });

    expect(response.status).toBe(200);
    expect(response.body.levelUpdate.currentLevel).toBe("A2");
  });

  it("returns streak from completed daily task path", async () => {
    prismaMock.vocabularyStatus.findUnique.mockResolvedValueOnce({ errorCount: 0 });
    prismaMock.vocabularyStatus.upsert.mockResolvedValueOnce({});
    prismaMock.studyRecord.create.mockResolvedValueOnce({});

    // getProgressFeedback
    prismaMock.studyRecord.findMany.mockResolvedValueOnce([]);
    prismaMock.errorDailyStat.findMany.mockResolvedValueOnce([]);

    // maybeCompleteDailyTask
    prismaMock.dailyTask.findUnique.mockResolvedValueOnce({ payload: {} });
    prismaMock.studyRecord.count.mockResolvedValueOnce(2).mockResolvedValueOnce(10);
    prismaMock.dailyTask.findMany.mockResolvedValueOnce([{ dateKey: "2026-04-26", payload: { completion: { isCompleted: true } } }]);
    prismaMock.dailyTask.update.mockResolvedValueOnce({});
    prismaMock.student.update.mockResolvedValueOnce({ streakDays: 2 });

    // maybeUpdateLevel (skip due insufficient days)
    prismaMock.studyRecord.findMany.mockResolvedValueOnce([{ date: new Date("2026-04-27T08:00:00.000Z"), score: 80 }]);
    prismaMock.student.findUnique.mockResolvedValueOnce({ level: "A1" });

    // final student fetch
    prismaMock.student.findUnique.mockResolvedValueOnce({ streakDays: 2 });

    const response = await request(appWithRouter())
      .post("/api/student/vocab/answer")
      .send({ word: "친구", selected: "朋友", answer: "朋友" });

    expect(response.status).toBe(200);
    expect(response.body.streak).toBe(2);
  });
});
