import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { analyzeSpeech, createSpeech, generateDailyTask, generateWeeklyExam, transcribeAudio } from "../services/ai.js";
import { addDays, calculateStreak, dateFromKey, nextLevel, recentThreeDayAverage, summarizeProgress } from "../services/progress.js";
import { dateKey, weekKey } from "../utils/date.js";

const router = Router();
const upload = multer({ dest: "uploads/" });

router.use(requireAuth, requireRole("STUDENT"));

function studentId(req) {
  return req.user.student.id;
}

const vocabAnswerSchema = z.object({
  word: z.string().min(1),
  selected: z.string().optional().default(""),
  answer: z.string().min(1)
});

const readingSubmitSchema = z.object({
  sentence: z.string().min(1),
  transcript: z.string().optional().default("")
});

const examSubmitSchema = z.object({
  listening: z.array(z.object({ selected: z.string().optional(), answer: z.string().optional() })).optional().default([]),
  vocabulary: z.array(z.object({ selected: z.string().optional(), answer: z.string().optional() })).optional().default([]),
  readingScore: z.coerce.number().min(0).max(100).optional().default(0)
});

async function getProgressFeedback(id) {
  const todayKey = dateKey();
  const yesterdayKey = addDays(todayKey, -1);
  const tomorrowStart = dateFromKey(addDays(todayKey, 1));
  const yesterdayStart = dateFromKey(yesterdayKey);

  const [records, snapshots] = await Promise.all([
    prisma.studyRecord.findMany({
      where: { studentId: id, date: { gte: yesterdayStart, lt: tomorrowStart } },
      orderBy: { date: "asc" }
    }),
    prisma.errorDailyStat.findMany({
      where: { studentId: id, dateKey: { in: [yesterdayKey, todayKey] } }
    })
  ]);

  const snapshotMap = new Map(snapshots.map((item) => [item.dateKey, item.errorCount]));
  const errors = [
    ...Array.from({ length: snapshotMap.get(yesterdayKey) || 0 }, () => ({ updatedAt: dateFromKey(yesterdayKey) })),
    ...Array.from({ length: snapshotMap.get(todayKey) || 0 }, () => ({ updatedAt: dateFromKey(todayKey) }))
  ];

  return summarizeProgress({
    records,
    errors,
    todayKey
  });
}

async function incrementDailyErrorSnapshot(studentId, delta) {
  if (!delta || delta <= 0) return;
  await prisma.errorDailyStat.upsert({
    where: { studentId_dateKey: { studentId, dateKey: dateKey() } },
    update: { errorCount: { increment: delta } },
    create: { studentId, dateKey: dateKey(), errorCount: delta }
  });
}

async function maybeUpdateLevel(id) {
  const threeDaysAgo = dateFromKey(addDays(dateKey(), -2));
  const records = await prisma.studyRecord.findMany({
    where: { studentId: id, date: { gte: threeDaysAgo } },
    orderBy: { date: "desc" }
  });
  if (!records.length) return null;

  const avg3 = recentThreeDayAverage(records);
  if (!avg3) return null;

  const student = await prisma.student.findUnique({ where: { id }, select: { level: true } });
  if (!student) return null;
  let newLevel = student.level;
  if (avg3 > 80) newLevel = nextLevel(student.level, 1);
  if (avg3 < 50) newLevel = nextLevel(student.level, -1);
  if (newLevel !== student.level) {
    await prisma.student.update({ where: { id }, data: { level: newLevel } });
    return { previousLevel: student.level, currentLevel: newLevel, recent3DayAverage: Math.round(avg3) };
  }
  return { previousLevel: student.level, currentLevel: student.level, recent3DayAverage: Math.round(avg3) };
}

async function refreshStreakIfBroken(id) {
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student || student.streakDays <= 0) return student;
  const tasks = await prisma.dailyTask.findMany({
    where: { studentId: id },
    orderBy: { dateKey: "desc" },
    take: 30
  });
  const completed = tasks
    .filter((item) => item.payload?.completion?.isCompleted)
    .map((item) => item.dateKey)
    .sort((a, b) => (a < b ? 1 : -1));
  if (!completed.length) {
    return prisma.student.update({ where: { id }, data: { streakDays: 0 } });
  }

  const today = dateKey();
  const yesterday = addDays(today, -1);
  if (completed[0] !== today && completed[0] !== yesterday) {
    return prisma.student.update({ where: { id }, data: { streakDays: 0 } });
  }
  return student;
}

async function maybeCompleteDailyTask(id) {
  const today = dateKey();
  const currentTask = await prisma.dailyTask.findUnique({
    where: { studentId_dateKey: { studentId: id, dateKey: today } }
  });
  if (!currentTask) return null;
  if (currentTask.payload?.completion?.isCompleted) return null;

  const todayStart = dateFromKey(today);
  const tomorrowStart = dateFromKey(addDays(today, 1));
  const [readingCount, vocabCount, recentTasks] = await Promise.all([
    prisma.studyRecord.count({ where: { studentId: id, type: "reading", date: { gte: todayStart, lt: tomorrowStart } } }),
    prisma.studyRecord.count({ where: { studentId: id, type: "vocab", date: { gte: todayStart, lt: tomorrowStart } } }),
    prisma.dailyTask.findMany({ where: { studentId: id }, orderBy: { dateKey: "desc" }, take: 60 })
  ]);

  if (readingCount < 2 || vocabCount < 10) return null;

  const completion = {
    isCompleted: true,
    completedAt: new Date().toISOString(),
    readingCount,
    vocabCount
  };

  await prisma.dailyTask.update({
    where: { studentId_dateKey: { studentId: id, dateKey: today } },
    data: { payload: { ...currentTask.payload, completion } }
  });

  const completedDates = recentTasks
    .filter((item) => item.payload?.completion?.isCompleted)
    .map((item) => item.dateKey);
  completedDates.push(today);
  const set = new Set(completedDates);

  const streak = calculateStreak([...set], today);
  const student = await prisma.student.update({ where: { id }, data: { streakDays: streak } });
  return { streakDays: student.streakDays };
}

async function getRecentContext(id) {
  const [errors, records, vocabularyStatuses] = await Promise.all([
    prisma.errorRecord.findMany({ where: { studentId: id }, orderBy: { updatedAt: "desc" }, take: 12 }),
    prisma.studyRecord.findMany({ where: { studentId: id }, orderBy: { date: "desc" }, take: 20 }),
    prisma.vocabularyStatus.findMany({
      where: {
        studentId: id,
        OR: [{ status: "unknown" }, { errorCount: { gt: 0 } }]
      },
      orderBy: [{ errorCount: "desc" }, { updatedAt: "desc" }],
      take: 30
    })
  ]);
  return { errors, records, vocabularyStatuses };
}

async function getOrCreateDailyTask(id, student) {
  const key = dateKey();
  const existing = await prisma.dailyTask.findUnique({ where: { studentId_dateKey: { studentId: id, dateKey: key } } });
  if (existing) return existing.payload;

  const context = await getRecentContext(id);
  const unknownWords = context.vocabularyStatuses.map((item) => item.word);
  const payload = await generateDailyTask({
    level: student.level,
    errors: context.errors,
    records: context.records,
    unknownWords
  });
  await prisma.dailyTask.create({ data: { studentId: id, dateKey: key, payload } });
  return payload;
}

router.get("/dashboard", async (req, res) => {
  const id = studentId(req);
  await refreshStreakIfBroken(id);
  const task = await getOrCreateDailyTask(id, req.user.student);
  const todayStart = dateFromKey(dateKey());
  const tomorrowStart = dateFromKey(addDays(dateKey(), 1));
  const [recordCount, recentErrors, progressFeedback, updatedStudent, readingDone, vocabDone] = await Promise.all([
    prisma.studyRecord.count({ where: { studentId: id, date: { gte: new Date(dateKey()) } } }),
    prisma.errorRecord.findMany({ where: { studentId: id }, orderBy: { count: "desc" }, take: 5 }),
    getProgressFeedback(id),
    prisma.student.findUnique({ where: { id } }),
    prisma.studyRecord.count({ where: { studentId: id, type: "reading", date: { gte: todayStart, lt: tomorrowStart } } }),
    prisma.studyRecord.count({ where: { studentId: id, type: "vocab", date: { gte: todayStart, lt: tomorrowStart } } })
  ]);

  res.json({
    student: updatedStudent,
    today: {
      readings: task.readings?.length || 0,
      vocabulary: task.vocabulary?.length || 0,
      reviews: recentErrors.length,
      completed: recordCount
    },
    task,
    recentErrors,
    progressFeedback,
    taskProgress: {
      readingDone,
      readingTarget: 2,
      vocabDone,
      vocabTarget: 10,
      isCompleted: !!task?.completion?.isCompleted
    }
  });
});

router.post("/daily/generate", async (req, res) => {
  const id = studentId(req);
  const today = dateKey();
  const existing = await prisma.dailyTask.findUnique({
    where: { studentId_dateKey: { studentId: id, dateKey: today } }
  });
  if (existing?.payload?.completion?.isCompleted) {
    return res.status(409).json({
      message: "今日任务已完成，不能重新生成。请明天继续。",
      task: existing.payload
    });
  }
  await prisma.dailyTask.deleteMany({ where: { studentId: id, dateKey: today } });
  const student = await prisma.student.findUnique({ where: { id } });
  const task = await getOrCreateDailyTask(id, student || req.user.student);
  res.json(task);
});

router.get("/records", async (req, res) => {
  const id = studentId(req);
  const [records, vocabulary, errors, audio] = await Promise.all([
    prisma.studyRecord.findMany({ where: { studentId: id }, orderBy: { date: "asc" }, take: 100 }),
    prisma.vocabularyStatus.findMany({ where: { studentId: id }, orderBy: [{ errorCount: "desc" }, { word: "asc" }] }),
    prisma.errorRecord.findMany({ where: { studentId: id }, orderBy: { count: "desc" }, take: 50 }),
    prisma.audioRecord.findMany({ where: { studentId: id }, orderBy: { createdAt: "desc" }, take: 20 })
  ]);
  const progressFeedback = await getProgressFeedback(id);
  res.json({ records, vocabulary, errors, audio, progressFeedback });
});

router.post("/vocab/answer", async (req, res) => {
  const parsed = vocabAnswerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid vocab payload" });
  const { word, selected, answer } = parsed.data;

  const id = studentId(req);
  const correct = selected === answer;
  const existing = await prisma.vocabularyStatus.findUnique({
    where: { studentId_word: { studentId: id, word } }
  });
  const previousErrors = existing?.errorCount || 0;
  const nextErrorCount = correct ? Math.max(previousErrors - 1, 0) : previousErrors + 1;
  const nextStatus = nextErrorCount === 0 ? "known" : "unknown";

  await prisma.vocabularyStatus.upsert({
    where: { studentId_word: { studentId: id, word } },
    update: {
      status: nextStatus,
      errorCount: nextErrorCount
    },
    create: { studentId: id, word, status: nextStatus, errorCount: nextErrorCount }
  });
  await prisma.studyRecord.create({ data: { studentId: id, type: "vocab", score: correct ? 100 : 0 } });

  if (!correct) {
    await prisma.errorRecord.upsert({
      where: { studentId_content_errorType: { studentId: id, content: word, errorType: "vocab" } },
      update: { count: { increment: 1 } },
      create: { studentId: id, content: word, errorType: "vocab", count: 1 }
    });
    await incrementDailyErrorSnapshot(id, 1);
  }

  const [progressFeedback, streak, levelUpdate, student] = await Promise.all([
    getProgressFeedback(id),
    maybeCompleteDailyTask(id),
    maybeUpdateLevel(id),
    prisma.student.findUnique({ where: { id } })
  ]);

  res.json({
    correct,
    score: correct ? 100 : 0,
    status: correct ? "correct" : "retry",
    progressFeedback,
    streak: streak?.streakDays ?? student?.streakDays ?? 0,
    levelUpdate
  });
});

router.post("/reading/submit", upload.single("audio"), async (req, res) => {
  const id = studentId(req);
  const parsed = readingSubmitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "sentence is required" });

  const audioPath = req.file ? path.resolve(req.file.path) : "";
  const audioUrl = req.file ? `/uploads/${req.file.filename}` : "";
  const { sentence } = parsed.data;
  const transcript = parsed.data.transcript || (audioPath ? await transcribeAudio(audioPath) : "");
  const result = await analyzeSpeech({ standard: sentence, transcript });
  const score = Number(result.score ?? result.finalScore ?? 0);

  await prisma.audioRecord.create({
    data: { studentId: id, sentence, transcript, audioUrl, score }
  });
  await prisma.studyRecord.create({ data: { studentId: id, type: "reading", score } });

  for (const word of result.missingWords || []) {
    await prisma.errorRecord.upsert({
      where: { studentId_content_errorType: { studentId: id, content: word, errorType: "missing_word" } },
      update: { count: { increment: 1 } },
      create: { studentId: id, content: word, errorType: "missing_word", count: 1 }
    });
  }
  for (const word of result.wrongWords || []) {
    await prisma.errorRecord.upsert({
      where: { studentId_content_errorType: { studentId: id, content: word, errorType: "wrong_word" } },
      update: { count: { increment: 1 } },
      create: { studentId: id, content: word, errorType: "wrong_word", count: 1 }
    });
  }
  const errorEvents = (result.missingWords?.length || 0) + (result.wrongWords?.length || 0);
  await incrementDailyErrorSnapshot(id, errorEvents);

  const [progressFeedback, streak, levelUpdate, student] = await Promise.all([
    getProgressFeedback(id),
    maybeCompleteDailyTask(id),
    maybeUpdateLevel(id),
    prisma.student.findUnique({ where: { id } })
  ]);

  res.json({
    ...result,
    score,
    progressFeedback,
    streak: streak?.streakDays ?? student?.streakDays ?? 0,
    levelUpdate
  });
});

router.get("/tts", async (req, res) => {
  const text = String(req.query.text || "");
  if (!text) return res.status(400).json({ message: "text is required" });
  const audio = await createSpeech(text);
  if (!audio) return res.status(204).end();
  res.setHeader("Content-Type", "audio/mpeg");
  res.send(audio);
});

router.get("/exam/current", async (req, res) => {
  const id = studentId(req);
  const context = await getRecentContext(id);
  const exam = await generateWeeklyExam({ level: req.user.student.level, errors: context.errors });
  res.json({ weekKey: weekKey(), exam });
});

router.post("/exam/submit", async (req, res) => {
  const id = studentId(req);
  const parsed = examSubmitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid exam payload" });
  const { listening = [], vocabulary = [], readingScore = 0 } = parsed.data;
  const listeningScore = listening.length ? (listening.filter((x) => x.selected === x.answer).length / listening.length) * 30 : 0;
  const vocabScore = vocabulary.length ? (vocabulary.filter((x) => x.selected === x.answer).length / vocabulary.length) * 40 : 0;
  const total = Math.round(listeningScore + vocabScore + Number(readingScore || 0) * 0.3);
  const payload = {
    listeningScore,
    vocabScore,
    readingScore,
    total,
    advice: total >= 85 ? "本周表现稳定，可以增加语速训练。" : "建议复习错词，并每天重复朗读低分句子。"
  };
  await prisma.examResult.create({ data: { studentId: id, weekKey: weekKey(), total, payload } });
  await prisma.studyRecord.create({ data: { studentId: id, type: "exam", score: total } });
  const [progressFeedback, levelUpdate] = await Promise.all([getProgressFeedback(id), maybeUpdateLevel(id)]);
  res.json({ ...payload, progressFeedback, levelUpdate });
});

export default router;
