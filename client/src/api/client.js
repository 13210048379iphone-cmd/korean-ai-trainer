import { ALL_VOCABULARY, LEVEL_ORDER, READING_BANK, VOCABULARY_BANK } from "../data/koreanPack.js";
import { evaluateSpeech } from "../utils/scoring.js";

const STORAGE_KEY = "korean_static_pack_v1";
const TOKEN_KEY = "token";
const USER_KEY = "user";

export const API_BASE = "";

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function addDays(key, days) {
  const value = new Date(`${key}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function toDate(value) {
  return new Date(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function shuffle(list) {
  return [...list].sort(() => Math.random() - 0.5);
}

function pickRandom(list, count) {
  if (!list.length || count <= 0) return [];
  return shuffle(list).slice(0, count);
}

function uniq(list) {
  return [...new Set(list.filter(Boolean))];
}

function levelIndex(level) {
  const index = LEVEL_ORDER.indexOf(level);
  return index < 0 ? 0 : index;
}

function nextLevel(level, delta) {
  const idx = levelIndex(level);
  return LEVEL_ORDER[clamp(idx + delta, 0, LEVEL_ORDER.length - 1)];
}

const WORD_MAP = new Map(ALL_VOCABULARY.map((item) => [item.word, item]));
const MEANING_POOL = ALL_VOCABULARY.map((item) => item.meaning);

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function getLevelWords(level) {
  return VOCABULARY_BANK[level] || VOCABULARY_BANK.TOPIK0;
}

function buildSeedState() {
  const now = nowIso();
  const users = [
    { id: "u_teacher", email: "teacher@demo.com", password: "pass123456", role: "TEACHER" },
    { id: "u_s1", email: "student@demo.com", password: "pass123456", role: "STUDENT", studentId: "s1" },
    { id: "u_s2", email: "student2@demo.com", password: "pass123456", role: "STUDENT", studentId: "s2" },
    { id: "u_s3", email: "student3@demo.com", password: "pass123456", role: "STUDENT", studentId: "s3" },
    { id: "u_s4", email: "student4@demo.com", password: "pass123456", role: "STUDENT", studentId: "s4" }
  ];
  const students = [
    { id: "s1", userId: "u_s1", name: "Demo Student", level: "TOPIK0", streakDays: 2, createdAt: now, updatedAt: now },
    { id: "s2", userId: "u_s2", name: "Mina", level: "TOPIK1", streakDays: 4, createdAt: now, updatedAt: now },
    { id: "s3", userId: "u_s3", name: "Jay", level: "TOPIK2", streakDays: 1, createdAt: now, updatedAt: now },
    { id: "s4", userId: "u_s4", name: "Sora", level: "TOPIK3", streakDays: 3, createdAt: now, updatedAt: now }
  ];

  const vocabularyStatuses = [];
  const studyRecords = [];
  const errorRecords = [];
  const errorDailyStats = [];

  for (const student of students) {
    const levelWords = getLevelWords(student.level);
    levelWords.slice(0, 24).forEach((item, index) => {
      const isKnown = index % 4 === 0;
      vocabularyStatuses.push({
        id: uid("vs"),
        studentId: student.id,
        word: item.word,
        status: isKnown ? "known" : "unknown",
        errorCount: isKnown ? 0 : (index % 3) + 1,
        streakCorrect: isKnown ? 2 : 0,
        updatedAt: now
      });
    });

    const weakWords = vocabularyStatuses
      .filter((item) => item.studentId === student.id && item.status === "unknown")
      .slice(0, 8)
      .map((item) => item.word);

    weakWords.forEach((word, idx) => {
      errorRecords.push({
        id: uid("er"),
        studentId: student.id,
        content: word,
        errorType: idx % 2 === 0 ? "vocab" : "wrong_word",
        count: (idx % 4) + 1,
        updatedAt: now
      });
    });

    for (let d = 0; d < 5; d += 1) {
      const day = addDays(dateKey(), -d);
      const base = 60 + levelIndex(student.level) * 8;
      studyRecords.push({
        id: uid("sr"),
        studentId: student.id,
        date: `${day}T08:00:00.000Z`,
        type: "reading",
        score: clamp(base + 8 - d * 2, 20, 100)
      });
      studyRecords.push({
        id: uid("sr"),
        studentId: student.id,
        date: `${day}T09:00:00.000Z`,
        type: "vocab",
        score: clamp(base + 5 - d * 2, 20, 100)
      });
    }

    errorDailyStats.push({
      id: uid("eds"),
      studentId: student.id,
      dateKey: addDays(dateKey(), -1),
      errorCount: 6 + levelIndex(student.level)
    });
    errorDailyStats.push({
      id: uid("eds"),
      studentId: student.id,
      dateKey: dateKey(),
      errorCount: 3 + levelIndex(student.level)
    });
  }

  return {
    version: 1,
    users,
    students,
    vocabularyStatuses,
    studyRecords,
    errorRecords,
    errorDailyStats,
    audioRecords: [],
    dailyTasks: [],
    examResults: []
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const state = buildSeedState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1) {
      const state = buildSeedState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return state;
    }
    return parsed;
  } catch {
    const state = buildSeedState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(session) {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getUser() {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

function getAuthedUser(state) {
  const token = getToken();
  if (!token) throw createHttpError(401, "请先登录");
  const user = state.users.find((item) => item.id === token);
  if (!user) throw createHttpError(401, "登录已失效，请重新登录");
  return user;
}

function requireRole(user, role) {
  if (user.role !== role) throw createHttpError(403, "无权限访问该功能");
}

function getStudent(state, studentId) {
  const student = state.students.find((item) => item.id === studentId);
  if (!student) throw createHttpError(404, "学生不存在");
  return student;
}

function getStudentByUser(state, user) {
  if (!user.studentId) throw createHttpError(404, "未绑定学生资料");
  return getStudent(state, user.studentId);
}

function asNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function buildChoices(correct, pool) {
  const wrongs = shuffle(pool.filter((item) => item !== correct)).slice(0, 3);
  while (wrongs.length < 3) wrongs.push(`选项${wrongs.length + 1}`);
  return shuffle([correct, ...wrongs]);
}

function buildVocabQuestion(word) {
  const item = WORD_MAP.get(word);
  const meaning = item?.meaning || `词义：${word}`;
  const pool = item
    ? getLevelWords(item.level).map((entry) => entry.meaning)
    : MEANING_POOL;
  return {
    word,
    meaning,
    choices: buildChoices(meaning, pool),
    answer: meaning
  };
}

function upsertErrorRecord(state, studentId, content, errorType, delta = 1) {
  const existing = state.errorRecords.find(
    (item) => item.studentId === studentId && item.content === content && item.errorType === errorType
  );
  if (existing) {
    existing.count += delta;
    existing.updatedAt = nowIso();
    return existing;
  }
  const record = {
    id: uid("er"),
    studentId,
    content,
    errorType,
    count: delta,
    updatedAt: nowIso()
  };
  state.errorRecords.push(record);
  return record;
}

function incrementDailyErrorStat(state, studentId, delta = 1) {
  if (delta <= 0) return;
  const today = dateKey();
  const existing = state.errorDailyStats.find((item) => item.studentId === studentId && item.dateKey === today);
  if (existing) {
    existing.errorCount += delta;
    return;
  }
  state.errorDailyStats.push({ id: uid("eds"), studentId, dateKey: today, errorCount: delta });
}

function getUnknownWords(state, student) {
  const statusWords = state.vocabularyStatuses
    .filter((item) => item.studentId === student.id && (item.status === "unknown" || item.errorCount > 0))
    .sort((a, b) => b.errorCount - a.errorCount)
    .map((item) => item.word);
  const errorWords = state.errorRecords
    .filter((item) => item.studentId === student.id)
    .sort((a, b) => b.count - a.count)
    .map((item) => item.content);
  const levelWords = getLevelWords(student.level).map((item) => item.word);
  return uniq([...statusWords, ...errorWords, ...levelWords]).slice(0, 30);
}

function pickReadings(level, weakWords) {
  const bank = READING_BANK[level] || READING_BANK.TOPIK0;
  const scored = bank
    .map((item) => ({
      ...item,
      score: item.keywords?.filter((word) => weakWords.includes(word)).length || 0
    }))
    .sort((a, b) => b.score - a.score);

  const picks = pickRandom(scored.slice(0, 8), 2);
  while (picks.length < 2) {
    picks.push(bank[picks.length % bank.length]);
  }
  return picks.map((item, idx) => {
    const injected = weakWords.slice(idx * 3, idx * 3 + 3);
    const mustHave = injected.slice(0, Math.max(2, Math.min(3, injected.length)));
    const missing = mustHave.filter((word) => !item.text.includes(word));
    const text = missing.length ? `${item.text} 오늘은 ${missing.join(", ")}를 다시 연습해요.` : item.text;
    return {
      id: `${item.id}-${idx}`,
      title: item.title,
      text,
      translation: item.translation
    };
  });
}

function buildDailyTask(state, student) {
  const weakWords = getUnknownWords(state, student);
  const readings = pickReadings(student.level, weakWords);
  const targetWeak = Math.ceil(10 * 0.7);
  const weakPart = weakWords.slice(0, targetWeak);
  const levelWords = getLevelWords(student.level).map((item) => item.word);
  const fill = levelWords.filter((word) => !weakPart.includes(word));
  const vocabWords = uniq([...weakPart, ...fill]).slice(0, 10);

  const review = state.errorRecords
    .filter((item) => item.studentId === student.id)
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((item) => ({ content: item.content, errorType: item.errorType, count: item.count }));

  return {
    readings,
    vocabulary: vocabWords.map((word) => buildVocabQuestion(word)),
    review,
    level: student.level,
    completion: { isCompleted: false }
  };
}

function getTodayRecordCount(state, studentId, type) {
  const start = toDate(`${dateKey()}T00:00:00.000Z`);
  const end = toDate(`${addDays(dateKey(), 1)}T00:00:00.000Z`);
  return state.studyRecords.filter((item) => {
    if (item.studentId !== studentId || item.type !== type) return false;
    const d = toDate(item.date);
    return d >= start && d < end;
  }).length;
}

function refreshStreakIfBroken(state, student) {
  if (student.streakDays <= 0) return;
  const completed = state.dailyTasks
    .filter((item) => item.studentId === student.id && item.payload?.completion?.isCompleted)
    .map((item) => item.dateKey)
    .sort((a, b) => (a < b ? 1 : -1));

  const today = dateKey();
  const yesterday = addDays(today, -1);
  if (!completed.length || (completed[0] !== today && completed[0] !== yesterday)) {
    student.streakDays = 0;
    student.updatedAt = nowIso();
  }
}

function maybeCompleteDailyTask(state, student) {
  const today = dateKey();
  const task = state.dailyTasks.find((item) => item.studentId === student.id && item.dateKey === today);
  if (!task || task.payload?.completion?.isCompleted) return null;

  const readingDone = getTodayRecordCount(state, student.id, "reading");
  const vocabDone = getTodayRecordCount(state, student.id, "vocab");
  if (readingDone < 2 || vocabDone < 10) return null;

  task.payload.completion = {
    isCompleted: true,
    completedAt: nowIso(),
    readingCount: readingDone,
    vocabCount: vocabDone
  };

  const completedDates = state.dailyTasks
    .filter((item) => item.studentId === student.id && item.payload?.completion?.isCompleted)
    .map((item) => item.dateKey);

  let streak = 0;
  let cursor = today;
  const set = new Set(completedDates);
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  student.streakDays = streak;
  student.updatedAt = nowIso();
  return { streakDays: streak };
}

function maybeUpdateLevel(state, student) {
  const records = state.studyRecords
    .filter((item) => item.studentId === student.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const dayMap = new Map();
  for (const item of records) {
    const key = String(item.date).slice(0, 10);
    if (!dayMap.has(key)) dayMap.set(key, []);
    dayMap.get(key).push(item.score);
  }
  const dailyAvg = [...dayMap.values()].map((scores) => scores.reduce((sum, v) => sum + v, 0) / scores.length);
  if (dailyAvg.length < 3) return null;
  const recent3 = dailyAvg.slice(0, 3);
  const avg = recent3.reduce((sum, v) => sum + v, 0) / recent3.length;

  const old = student.level;
  if (avg > 80) student.level = nextLevel(student.level, 1);
  if (avg < 50) student.level = nextLevel(student.level, -1);
  if (old !== student.level) student.updatedAt = nowIso();

  return {
    previousLevel: old,
    currentLevel: student.level,
    recent3DayAverage: Math.round(avg)
  };
}

function getProgressFeedback(state, studentId) {
  const today = dateKey();
  const yesterday = addDays(today, -1);
  const start = toDate(`${yesterday}T00:00:00.000Z`);
  const end = toDate(`${addDays(today, 1)}T00:00:00.000Z`);

  const records = state.studyRecords.filter((item) => {
    if (item.studentId !== studentId) return false;
    const d = toDate(item.date);
    return d >= start && d < end;
  });

  const todayRecords = records.filter((item) => String(item.date).startsWith(today));
  const yesterdayRecords = records.filter((item) => String(item.date).startsWith(yesterday));
  const todayAverageScore = todayRecords.length
    ? Math.round(todayRecords.reduce((sum, item) => sum + item.score, 0) / todayRecords.length)
    : 0;
  const yesterdayAverageScore = yesterdayRecords.length
    ? Math.round(yesterdayRecords.reduce((sum, item) => sum + item.score, 0) / yesterdayRecords.length)
    : 0;

  const todayErrorCount = state.errorDailyStats.find((item) => item.studentId === studentId && item.dateKey === today)?.errorCount || 0;
  const yesterdayErrorCount =
    state.errorDailyStats.find((item) => item.studentId === studentId && item.dateKey === yesterday)?.errorCount || 0;

  return {
    todayAverageScore,
    yesterdayAverageScore,
    scoreDelta: todayAverageScore - yesterdayAverageScore,
    todayErrorCount,
    yesterdayErrorCount,
    errorDelta: todayErrorCount - yesterdayErrorCount,
    errorReduction: yesterdayErrorCount - todayErrorCount
  };
}

function getOrCreateTask(state, student) {
  const today = dateKey();
  let task = state.dailyTasks.find((item) => item.studentId === student.id && item.dateKey === today);
  if (!task) {
    task = { id: uid("dt"), studentId: student.id, dateKey: today, payload: buildDailyTask(state, student), createdAt: nowIso() };
    state.dailyTasks.push(task);
  }
  return task;
}

function getTaskProgress(state, studentId) {
  const task = state.dailyTasks.find((item) => item.studentId === studentId && item.dateKey === dateKey());
  return {
    readingDone: getTodayRecordCount(state, studentId, "reading"),
    readingTarget: 2,
    vocabDone: getTodayRecordCount(state, studentId, "vocab"),
    vocabTarget: 10,
    isCompleted: !!task?.payload?.completion?.isCompleted
  };
}

function parsePath(path) {
  return String(path).replace(/\/+$/, "");
}

async function blobToDataUrl(blob) {
  if (!blob) return "";
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function parseBody(options = {}) {
  const body = options.body;
  if (!body) return {};
  if (body instanceof FormData) {
    const data = {};
    for (const [key, value] of body.entries()) {
      if (value instanceof File || value instanceof Blob) {
        data[key] = value;
        if (key === "audio") data.audioDataUrl = await blobToDataUrl(value);
      } else {
        data[key] = value;
      }
    }
    return data;
  }
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (typeof body === "object") return body;
  return {};
}

function withStudentGuard(state) {
  const user = getAuthedUser(state);
  requireRole(user, "STUDENT");
  const student = getStudentByUser(state, user);
  return { user, student };
}

function withTeacherGuard(state) {
  const user = getAuthedUser(state);
  requireRole(user, "TEACHER");
  return { user };
}

function dashboardPayload(state, student) {
  refreshStreakIfBroken(state, student);
  const task = getOrCreateTask(state, student);
  const recentErrors = state.errorRecords
    .filter((item) => item.studentId === student.id)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    student,
    today: {
      readings: task.payload.readings?.length || 0,
      vocabulary: task.payload.vocabulary?.length || 0,
      reviews: recentErrors.length,
      completed: state.studyRecords.filter((item) => item.studentId === student.id && String(item.date).startsWith(dateKey())).length
    },
    task: task.payload,
    recentErrors,
    progressFeedback: getProgressFeedback(state, student.id),
    taskProgress: getTaskProgress(state, student.id)
  };
}

function buildExamPaper(state, student) {
  const weakWords = getUnknownWords(state, student);
  const readings = READING_BANK[student.level] || READING_BANK.TOPIK0;
  const reading = pickRandom(readings, 1)[0] || readings[0];
  const vocabulary = uniq([...weakWords, ...getLevelWords(student.level).map((item) => item.word)])
    .slice(0, 8)
    .map((word) => buildVocabQuestion(word));

  const listening = pickRandom(readings, 5).map((item) => {
    const keyword = (item.keywords || []).find((word) => WORD_MAP.has(word)) || getLevelWords(student.level)[0].word;
    const question = buildVocabQuestion(keyword);
    return {
      audioText: item.text,
      question: `下列哪个意思最接近“${keyword}”？`,
      choices: question.choices,
      answer: question.answer
    };
  });

  return {
    listening,
    vocabulary,
    reading: { text: reading.text, prompt: "请完整朗读这段文字并尽量清晰。" },
    rubric: { listening: 30, vocabulary: 40, reading: 30 }
  };
}

export async function api(path, options = {}) {
  const route = parsePath(path);
  const method = String(options.method || "GET").toUpperCase();
  const body = await parseBody(options);
  const state = loadState();

  try {
    if (route === "/api/auth/login" && method === "POST") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const user = state.users.find((item) => item.email.toLowerCase() === email && item.password === password);
      if (!user) throw createHttpError(401, "账号或密码错误");
      const student = user.studentId ? getStudent(state, user.studentId) : null;
      return {
        token: user.id,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          studentId: student?.id || null,
          name: student?.name || "Teacher"
        }
      };
    }

    if (route === "/api/auth/me" && method === "GET") {
      const user = getAuthedUser(state);
      const student = user.studentId ? getStudent(state, user.studentId) : null;
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        student
      };
    }

    if (route === "/api/student/dashboard" && method === "GET") {
      const { student } = withStudentGuard(state);
      const payload = dashboardPayload(state, student);
      saveState(state);
      return payload;
    }

    if (route === "/api/student/daily/generate" && method === "POST") {
      const { student } = withStudentGuard(state);
      const today = dateKey();
      const existing = state.dailyTasks.find((item) => item.studentId === student.id && item.dateKey === today);
      if (existing?.payload?.completion?.isCompleted) {
        throw createHttpError(409, "今日任务已完成，不能重新生成。请明天继续。");
      }
      state.dailyTasks = state.dailyTasks.filter((item) => !(item.studentId === student.id && item.dateKey === today));
      const task = getOrCreateTask(state, student);
      saveState(state);
      return task.payload;
    }

    if (route === "/api/student/records" && method === "GET") {
      const { student } = withStudentGuard(state);
      const records = state.studyRecords.filter((item) => item.studentId === student.id).sort((a, b) => (a.date < b.date ? -1 : 1));
      const vocabulary = state.vocabularyStatuses
        .filter((item) => item.studentId === student.id)
        .sort((a, b) => b.errorCount - a.errorCount || a.word.localeCompare(b.word));
      const errors = state.errorRecords.filter((item) => item.studentId === student.id).sort((a, b) => b.count - a.count);
      const audio = state.audioRecords.filter((item) => item.studentId === student.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return { records, vocabulary, errors, audio, progressFeedback: getProgressFeedback(state, student.id) };
    }

    if (route === "/api/student/vocab/answer" && method === "POST") {
      const { student } = withStudentGuard(state);
      const word = String(body.word || "").trim();
      const answer = String(body.answer || "");
      const selected = String(body.selected || "");
      if (!word || !answer) throw createHttpError(400, "word and answer are required");

      const correct = selected === answer;
      let status = state.vocabularyStatuses.find((item) => item.studentId === student.id && item.word === word);
      if (!status) {
        status = { id: uid("vs"), studentId: student.id, word, status: "unknown", errorCount: 0, streakCorrect: 0, updatedAt: nowIso() };
        state.vocabularyStatuses.push(status);
      }

      if (correct) {
        status.streakCorrect = (status.streakCorrect || 0) + 1;
        status.errorCount = Math.max(0, status.errorCount - 1);
      } else {
        status.streakCorrect = 0;
        status.errorCount += 1;
      }
      status.status = status.errorCount === 0 && status.streakCorrect >= 2 ? "known" : "unknown";
      status.updatedAt = nowIso();

      state.studyRecords.push({ id: uid("sr"), studentId: student.id, date: nowIso(), type: "vocab", score: correct ? 100 : 0 });

      if (!correct) {
        upsertErrorRecord(state, student.id, word, "vocab", 1);
        incrementDailyErrorStat(state, student.id, 1);
      }

      const streak = maybeCompleteDailyTask(state, student);
      const levelUpdate = maybeUpdateLevel(state, student);
      const progressFeedback = getProgressFeedback(state, student.id);
      saveState(state);

      return {
        correct,
        score: correct ? 100 : 0,
        status: correct ? "correct" : "retry",
        progressFeedback,
        streak: streak?.streakDays ?? student.streakDays,
        levelUpdate
      };
    }

    if (route === "/api/student/reading/submit" && method === "POST") {
      const { student } = withStudentGuard(state);
      const sentence = String(body.sentence || "");
      const transcript = String(body.transcript || "");
      if (!sentence) throw createHttpError(400, "sentence is required");

      const analysis = evaluateSpeech(sentence, transcript);
      const score = analysis.finalScore;
      state.audioRecords.push({
        id: uid("ar"),
        studentId: student.id,
        sentence,
        transcript,
        audioUrl: body.audioDataUrl || "",
        score,
        createdAt: nowIso()
      });
      state.studyRecords.push({ id: uid("sr"), studentId: student.id, date: nowIso(), type: "reading", score });

      for (const word of analysis.missingWords) {
        upsertErrorRecord(state, student.id, word, "missing_word", 1);
      }
      for (const word of analysis.wrongWords) {
        upsertErrorRecord(state, student.id, word, "wrong_word", 1);
      }
      incrementDailyErrorStat(state, student.id, analysis.missingWords.length + analysis.wrongWords.length);

      const streak = maybeCompleteDailyTask(state, student);
      const levelUpdate = maybeUpdateLevel(state, student);
      const progressFeedback = getProgressFeedback(state, student.id);
      saveState(state);

      return {
        score,
        finalScore: analysis.finalScore,
        similarityScore: analysis.similarityScore,
        keywordMatchScore: analysis.keywordMatchScore,
        lengthScore: analysis.lengthScore,
        verdict: analysis.verdict,
        feedback: analysis.message,
        transcript: analysis.recognizedText,
        missingWords: analysis.missingWords,
        wrongWords: analysis.wrongWords,
        progressFeedback,
        streak: streak?.streakDays ?? student.streakDays,
        levelUpdate
      };
    }

    if (route === "/api/student/exam/current" && method === "GET") {
      const { student } = withStudentGuard(state);
      const exam = buildExamPaper(state, student);
      return { weekKey: `${dateKey().slice(0, 7)}-W`, exam };
    }

    if (route === "/api/student/exam/submit" && method === "POST") {
      const { student } = withStudentGuard(state);
      const listening = Array.isArray(body.listening) ? body.listening : [];
      const vocabulary = Array.isArray(body.vocabulary) ? body.vocabulary : [];
      const readingScore = clamp(asNumber(body.readingScore, 0), 0, 100);

      const listeningScore = listening.length
        ? (listening.filter((item) => item.selected === item.answer).length / listening.length) * 30
        : 0;
      const vocabScore = vocabulary.length
        ? (vocabulary.filter((item) => item.selected === item.answer).length / vocabulary.length) * 40
        : 0;
      const total = Math.round(listeningScore + vocabScore + readingScore * 0.3);
      const payload = {
        listeningScore,
        vocabScore,
        readingScore,
        total,
        advice: total >= 85 ? "表现很稳定，建议继续提升语速与连读。" : "建议先复习错词，再重复朗读低分短文。"
      };
      state.examResults.push({
        id: uid("ex"),
        studentId: student.id,
        weekKey: `${dateKey().slice(0, 7)}-W`,
        payload,
        total,
        createdAt: nowIso()
      });
      state.studyRecords.push({ id: uid("sr"), studentId: student.id, date: nowIso(), type: "exam", score: total });
      const levelUpdate = maybeUpdateLevel(state, student);
      const progressFeedback = getProgressFeedback(state, student.id);
      saveState(state);
      return { ...payload, levelUpdate, progressFeedback };
    }

    if (route === "/api/teacher/students" && method === "GET") {
      withTeacherGuard(state);
      return state.students
        .map((student) => {
          const studyRecords = state.studyRecords
            .filter((item) => item.studentId === student.id)
            .sort((a, b) => (a.date < b.date ? 1 : -1))
            .slice(0, 10);
          const errorRecords = state.errorRecords
            .filter((item) => item.studentId === student.id)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
          const audioCount = state.audioRecords.filter((item) => item.studentId === student.id).length;
          return {
            ...student,
            studyRecords,
            errorRecords,
            _count: { audioRecords: audioCount, studyRecords: state.studyRecords.filter((item) => item.studentId === student.id).length }
          };
        })
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    }

    if (route.startsWith("/api/teacher/students/") && method === "GET") {
      withTeacherGuard(state);
      const studentId = route.split("/").pop();
      const student = getStudent(state, studentId);
      return {
        ...student,
        vocabularyStatuses: state.vocabularyStatuses
          .filter((item) => item.studentId === studentId)
          .sort((a, b) => b.errorCount - a.errorCount),
        studyRecords: state.studyRecords
          .filter((item) => item.studentId === studentId)
          .sort((a, b) => (a.date < b.date ? 1 : -1))
          .slice(0, 100),
        errorRecords: state.errorRecords
          .filter((item) => item.studentId === studentId)
          .sort((a, b) => b.count - a.count)
          .slice(0, 50),
        audioRecords: state.audioRecords
          .filter((item) => item.studentId === studentId)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .slice(0, 50),
        examResults: state.examResults
          .filter((item) => item.studentId === studentId)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
          .slice(0, 20)
      };
    }

    if (route === "/api/teacher/audio" && method === "GET") {
      withTeacherGuard(state);
      return state.audioRecords
        .map((item) => ({
          ...item,
          student: getStudent(state, item.studentId)
        }))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    }

    if (route === "/api/teacher/analytics" && method === "GET") {
      withTeacherGuard(state);
      const avgScore = state.studyRecords.length
        ? Math.round(state.studyRecords.reduce((sum, item) => sum + item.score, 0) / state.studyRecords.length)
        : 0;
      const audioAvgScore = state.audioRecords.length
        ? Math.round(state.audioRecords.reduce((sum, item) => sum + item.score, 0) / state.audioRecords.length)
        : 0;
      const topErrors = state.errorRecords
        .map((item) => ({ ...item, student: getStudent(state, item.studentId) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      return {
        students: state.students.length,
        avgScore,
        audioAvgScore,
        audioCount: state.audioRecords.length,
        topErrors
      };
    }

    throw createHttpError(404, "接口不存在");
  } catch (error) {
    throw new Error(error.message || "请求失败");
  } finally {
    saveState(state);
  }
}
