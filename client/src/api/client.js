import {
  ALL_VOCABULARY,
  DAILY_TARGET,
  FULL_VOCABULARY_BANK,
  LEVEL_ORDER,
  READING_BANK,
  READING_COMPONENTS
} from "../data/koreanPack.js";
import { evaluateSpeech } from "../utils/scoring.js";

const STATE_VERSION = 2;
const STORAGE_KEY = "korean_static_pack_v2";
const ACTIVE_STUDENT_KEY = "korean_static_active_student_v1";

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

function asNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
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

function mean(list) {
  if (!list.length) return 0;
  return list.reduce((sum, value) => sum + value, 0) / list.length;
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function hashInt(input) {
  let hash = 0;
  const text = String(input);
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function levelIndex(level) {
  const index = LEVEL_ORDER.indexOf(level);
  return index < 0 ? 0 : index;
}

function nextLevel(level, delta) {
  const idx = levelIndex(level);
  return LEVEL_ORDER[clamp(idx + delta, 0, LEVEL_ORDER.length - 1)];
}

function getLevelWords(level) {
  return FULL_VOCABULARY_BANK[level] || FULL_VOCABULARY_BANK.TOPIK0;
}

function normalizeName(name) {
  return String(name || "")
    .trim()
    .slice(0, 18);
}

function getWeekStartKey(inputDate) {
  const date = new Date(`${String(inputDate).slice(0, 10)}T00:00:00.000Z`);
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

function getWeekRangeLabel(weekStartKey) {
  const end = addDays(weekStartKey, 6);
  return `${weekStartKey} ~ ${end}`;
}

const WORD_MAP = new Map(ALL_VOCABULARY.map((item) => [item.word, item]));
const MEANING_POOL = ALL_VOCABULARY.map((item) => item.meaning);
const AUDIO_KEEP_LIMIT = 30;
const STATUS_LABEL = {
  known: "已掌握",
  unknown: "待强化"
};
const ERROR_TYPE_LABEL = {
  vocab: "词汇题错误",
  missing_word: "漏词",
  wrong_word: "错词"
};

function buildChoices(correct, pool) {
  const wrongs = shuffle(pool.filter((item) => item !== correct)).slice(0, 3);
  while (wrongs.length < 3) wrongs.push(`选项${wrongs.length + 1}`);
  return shuffle([correct, ...wrongs]);
}

function buildVocabQuestion(word) {
  const item = WORD_MAP.get(word);
  const meaning = item?.meaning || `词义：${word}`;
  const pool = item ? getLevelWords(item.level).map((entry) => entry.meaning) : MEANING_POOL;
  return {
    word,
    meaning,
    choices: buildChoices(meaning, pool),
    answer: meaning
  };
}

function getWordMeaning(word) {
  return WORD_MAP.get(word)?.meaning || "";
}

function mapStatusLabel(status) {
  return STATUS_LABEL[status] || "待强化";
}

function mapErrorTypeLabel(errorType) {
  return ERROR_TYPE_LABEL[errorType] || "其他错误";
}

function buildSeedState() {
  const now = nowIso();
  const students = [
    { id: "s1", name: "学习者A", level: "TOPIK0", streakDays: 2, createdAt: now, updatedAt: now },
    { id: "s2", name: "学习者B", level: "TOPIK1", streakDays: 4, createdAt: now, updatedAt: now },
    { id: "s3", name: "学习者C", level: "TOPIK2", streakDays: 1, createdAt: now, updatedAt: now },
    { id: "s4", name: "学习者D", level: "TOPIK3", streakDays: 3, createdAt: now, updatedAt: now }
  ];

  const vocabularyStatuses = [];
  const studyRecords = [];
  const errorRecords = [];
  const errorDailyStats = [];

  for (const student of students) {
    const levelWords = getLevelWords(student.level);
    levelWords.slice(0, 36).forEach((item, index) => {
      const isKnown = index % 5 === 0;
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
      .slice(0, 12)
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

    for (let d = 0; d < 9; d += 1) {
      const day = addDays(dateKey(), -d);
      const base = 62 + levelIndex(student.level) * 7;
      studyRecords.push({
        id: uid("sr"),
        studentId: student.id,
        date: `${day}T08:00:00.000Z`,
        type: "reading",
        score: clamp(base + 8 - d, 20, 100)
      });
      studyRecords.push({
        id: uid("sr"),
        studentId: student.id,
        date: `${day}T09:00:00.000Z`,
        type: "vocab",
        score: clamp(base + 4 - d, 20, 100)
      });
    }

    for (let d = 0; d < 14; d += 1) {
      errorDailyStats.push({
        id: uid("eds"),
        studentId: student.id,
        dateKey: addDays(dateKey(), -d),
        errorCount: clamp(8 - d + levelIndex(student.level), 1, 20)
      });
    }
  }

  return {
    version: STATE_VERSION,
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
    if (parsed?.version !== STATE_VERSION) {
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

function getStudent(state, studentId) {
  const student = state.students.find((item) => item.id === studentId);
  if (!student) throw createHttpError(404, "学习者不存在");
  return student;
}

function initializeStudentVocabularyStatus(state, studentId, level) {
  const now = nowIso();
  getLevelWords(level)
    .slice(0, 36)
    .forEach((item, index) => {
      state.vocabularyStatuses.push({
        id: uid("vs"),
        studentId,
        word: item.word,
        status: index % 5 === 0 ? "known" : "unknown",
        errorCount: index % 5 === 0 ? 0 : 1,
        streakCorrect: index % 5 === 0 ? 2 : 0,
        updatedAt: now
      });
    });
}

function ensureActiveStudentId(state) {
  const storedId = localStorage.getItem(ACTIVE_STUDENT_KEY);
  if (storedId && state.students.some((item) => item.id === storedId)) return storedId;
  const fallback = state.students[0]?.id || "";
  if (fallback) localStorage.setItem(ACTIVE_STUDENT_KEY, fallback);
  return fallback;
}

function setActiveStudentId(studentId) {
  localStorage.setItem(ACTIVE_STUDENT_KEY, studentId);
}

function getActiveStudent(state) {
  return getStudent(state, ensureActiveStudentId(state));
}

function getProfilesPayload(state) {
  const activeStudentId = ensureActiveStudentId(state);
  const profiles = [...state.students]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((item) => ({
      id: item.id,
      name: item.name,
      level: item.level,
      streakDays: item.streakDays
    }));
  return { activeStudentId, profiles };
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
  return uniq([...statusWords, ...errorWords, ...levelWords]).slice(0, 60);
}

function getHighPriorityWeakWords(state, student) {
  const errorWords = state.errorRecords
    .filter((item) => item.studentId === student.id)
    .sort((a, b) => b.count - a.count)
    .map((item) => item.content);

  const unknownWords = state.vocabularyStatuses
    .filter((item) => item.studentId === student.id && (item.status === "unknown" || item.errorCount > 0))
    .sort((a, b) => b.errorCount - a.errorCount)
    .map((item) => item.word);

  return uniq([...errorWords, ...unknownWords]).slice(0, 60);
}

function toLocationKo(placeKo) {
  if (placeKo.endsWith("에서") || placeKo.endsWith("에")) return placeKo;
  return `${placeKo}에서`;
}

function buildFocusWords(state, student, unknownWords) {
  const highPriorityWeakWords = getHighPriorityWeakWords(state, student);
  const levelWords = getLevelWords(student.level).map((item) => item.word);
  return uniq([...highPriorityWeakWords, ...unknownWords, ...levelWords]).slice(0, 90);
}

function pickFocusSubset(focusWords, seed, desiredCount) {
  if (!focusWords.length) return [];
  const set = [];
  let cursor = hashInt(seed) % focusWords.length;
  while (set.length < desiredCount && set.length < focusWords.length) {
    set.push(focusWords[cursor]);
    cursor = (cursor + 7) % focusWords.length;
  }
  return set;
}

function pickWeakWordsForReading(highPriorityWeakWords, seed) {
  if (!highPriorityWeakWords.length) return [];
  const targetCount = highPriorityWeakWords.length >= 3 ? 3 : Math.min(2, highPriorityWeakWords.length);
  return pickFocusSubset(highPriorityWeakWords, seed, targetCount);
}

function composeReading(level, studentId, day, order, focusWords, highPriorityWeakWords) {
  const pool = READING_COMPONENTS[level] || READING_COMPONENTS.TOPIK0;
  const baseSeed = `${studentId}-${level}-${day}-${order}`;

  const subject = pool.subjects[hashInt(`${baseSeed}-subject`) % pool.subjects.length];
  const time = pool.times[hashInt(`${baseSeed}-time`) % pool.times.length];
  const place = pool.places[hashInt(`${baseSeed}-place`) % pool.places.length];
  const action = pool.actions[hashInt(`${baseSeed}-action`) % pool.actions.length];
  const plan = pool.plans[hashInt(`${baseSeed}-plan`) % pool.plans.length];

  const forcedWeakWords = pickWeakWordsForReading(highPriorityWeakWords, `${baseSeed}-forced-focus`);
  const fallbackFocus = pickFocusSubset(focusWords, `${baseSeed}-fallback-focus`, 3);
  const selectedFocus = uniq([...forcedWeakWords, ...fallbackFocus]).slice(
    0,
    forcedWeakWords.length >= 3 ? 3 : Math.max(2, forcedWeakWords.length)
  );
  const focusMeaning = selectedFocus.map((word) => WORD_MAP.get(word)?.meaning || word);

  const weakKo = selectedFocus.length
    ? `특히 ${selectedFocus.join(", ")} 같은 취약 단어를 반복해서 또렷하게 말하는 연습을 했어요`
    : "핵심 표현을 정확하게 말하는 연습을 했어요";
  const weakZh = selectedFocus.length
    ? `重点反复练习 ${selectedFocus.join("、")}（${focusMeaning.join("、")}）这些薄弱词，确保发音清晰`
    : "重点练习核心表达并清晰开口";

  const text = `${time.ko} ${subject.ko} ${toLocationKo(place.ko)} ${action.ko}. ${weakKo}. ${plan.ko}.`;
  const translation = `${time.zh}，${subject.zh}在${place.zh}${action.zh}。${weakZh}。${plan.zh}。`;

  const readingId = [
    level,
    day,
    hashInt(`${baseSeed}-subject`) % pool.subjects.length,
    hashInt(`${baseSeed}-time`) % pool.times.length,
    hashInt(`${baseSeed}-place`) % pool.places.length,
    hashInt(`${baseSeed}-action`) % pool.actions.length,
    hashInt(`${baseSeed}-plan`) % pool.plans.length
  ].join("-");

  return {
    id: `rd-${readingId}`,
    title: `口语朗读 ${order + 1}`,
    text,
    translation,
    keywords: uniq([...(action.words || []), ...selectedFocus]).slice(0, 10)
  };
}

function buildReadings(state, student, focusWords) {
  const day = dateKey();
  const highPriorityWeakWords = getHighPriorityWeakWords(state, student);
  const readings = [];
  for (let i = 0; i < DAILY_TARGET.reading; i += 1) {
    readings.push(composeReading(student.level, student.id, day, i, focusWords, highPriorityWeakWords));
  }
  return readings;
}

function buildDailyTask(state, student) {
  const unknownWords = getUnknownWords(state, student);
  const focusWords = buildFocusWords(state, student, unknownWords);
  const readings = buildReadings(state, student, focusWords);

  const vocabTarget = DAILY_TARGET.vocabulary;
  const unknownQuota = Math.max(1, Math.ceil(vocabTarget * 0.75));
  const weakPart = focusWords.slice(0, unknownQuota);
  const levelWords = getLevelWords(student.level).map((item) => item.word);
  const fillPart = levelWords.filter((word) => !weakPart.includes(word));
  const vocabWords = uniq([...weakPart, ...fillPart]).slice(0, vocabTarget);

  const review = state.errorRecords
    .filter((item) => item.studentId === student.id)
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .map((item) => ({
      content: item.content,
      contentMeaning: getWordMeaning(item.content),
      errorType: item.errorType,
      errorTypeLabel: mapErrorTypeLabel(item.errorType),
      count: item.count
    }));

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
  if (readingDone < DAILY_TARGET.reading || vocabDone < DAILY_TARGET.vocabulary) return null;

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

  const dailyAvg = [...dayMap.values()].map((scores) => mean(scores));
  if (dailyAvg.length < 3) return null;

  const recent3 = dailyAvg.slice(0, 3);
  const avg = mean(recent3);
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

  const todayAverageScore = todayRecords.length ? Math.round(mean(todayRecords.map((item) => item.score))) : 0;
  const yesterdayAverageScore = yesterdayRecords.length ? Math.round(mean(yesterdayRecords.map((item) => item.score))) : 0;

  const todayErrorCount =
    state.errorDailyStats.find((item) => item.studentId === studentId && item.dateKey === today)?.errorCount || 0;
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
    task = {
      id: uid("dt"),
      studentId: student.id,
      dateKey: today,
      payload: buildDailyTask(state, student),
      createdAt: nowIso()
    };
    state.dailyTasks.push(task);
  }
  return task;
}

function getTaskProgress(state, studentId) {
  const task = state.dailyTasks.find((item) => item.studentId === studentId && item.dateKey === dateKey());
  return {
    readingDone: getTodayRecordCount(state, studentId, "reading"),
    readingTarget: DAILY_TARGET.reading,
    vocabDone: getTodayRecordCount(state, studentId, "vocab"),
    vocabTarget: DAILY_TARGET.vocabulary,
    isCompleted: !!task?.payload?.completion?.isCompleted
  };
}

function buildWeeklyReport(state, studentId) {
  const map = new Map();

  const ensure = (weekStart) => {
    if (!map.has(weekStart)) {
      map.set(weekStart, {
        weekStart,
        weekRange: getWeekRangeLabel(weekStart),
        sessionCount: 0,
        avgScore: 0,
        readingAvg: 0,
        vocabAvg: 0,
        examAvg: 0,
        errorCount: 0,
        _scores: [],
        _reading: [],
        _vocab: [],
        _exam: []
      });
    }
    return map.get(weekStart);
  };

  state.studyRecords
    .filter((item) => item.studentId === studentId)
    .forEach((item) => {
      const weekStart = getWeekStartKey(item.date);
      const row = ensure(weekStart);
      row.sessionCount += 1;
      row._scores.push(item.score);
      if (item.type === "reading") row._reading.push(item.score);
      if (item.type === "vocab") row._vocab.push(item.score);
      if (item.type === "exam") row._exam.push(item.score);
    });

  state.errorDailyStats
    .filter((item) => item.studentId === studentId)
    .forEach((item) => {
      const weekStart = getWeekStartKey(item.dateKey);
      const row = ensure(weekStart);
      row.errorCount += item.errorCount;
    });

  return [...map.values()]
    .map((row) => ({
      weekStart: row.weekStart,
      weekRange: row.weekRange,
      sessionCount: row.sessionCount,
      avgScore: Math.round(mean(row._scores)),
      readingAvg: row._reading.length ? Math.round(mean(row._reading)) : 0,
      vocabAvg: row._vocab.length ? Math.round(mean(row._vocab)) : 0,
      examAvg: row._exam.length ? Math.round(mean(row._exam)) : 0,
      errorCount: row.errorCount
    }))
    .sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))
    .slice(0, 12);
}

function dashboardPayload(state, student) {
  refreshStreakIfBroken(state, student);
  const task = getOrCreateTask(state, student);
  const recentErrors = state.errorRecords
    .filter((item) => item.studentId === student.id)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map((item) => ({
      ...item,
      contentMeaning: getWordMeaning(item.content),
      errorTypeLabel: mapErrorTypeLabel(item.errorType)
    }));

  return {
    student,
    today: {
      readings: task.payload.readings?.length || 0,
      vocabulary: task.payload.vocabulary?.length || 0,
      reviews: recentErrors.length,
      completed: state.studyRecords.filter(
        (item) => item.studentId === student.id && String(item.date).startsWith(dateKey())
      ).length
    },
    task: task.payload,
    recentErrors,
    progressFeedback: getProgressFeedback(state, student.id),
    taskProgress: getTaskProgress(state, student.id)
  };
}

function buildExamPaper(state, student) {
  const unknownWords = getUnknownWords(state, student);
  const focusWords = buildFocusWords(state, student, unknownWords);
  const reading = composeReading(student.level, student.id, dateKey(), 99, focusWords);
  const readings = READING_BANK[student.level] || READING_BANK.TOPIK0;

  const vocabulary = uniq([...focusWords, ...getLevelWords(student.level).map((item) => item.word)])
    .slice(0, 8)
    .map((word) => buildVocabQuestion(word));

  const listening = pickRandom(readings, 5).map((item) => {
    const keyword =
      (item.keywords || []).find((word) => WORD_MAP.has(word)) || getLevelWords(student.level)[0]?.word || "한국어";
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
    rubric: { listening: 30, vocabulary: 20, reading: 50 }
  };
}

function applyAudioRetention(state, studentId, keepCount = AUDIO_KEEP_LIMIT) {
  const audios = state.audioRecords
    .filter((item) => item.studentId === studentId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  audios.forEach((item, index) => {
    if (index >= keepCount) item.audioUrl = "";
  });
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

function handleProfilesRoute(state, route, method, body) {
  if (route === "/api/profiles" && method === "GET") {
    return getProfilesPayload(state);
  }

  if (route === "/api/profiles/select" && method === "POST") {
    const studentId = String(body.studentId || "");
    if (!studentId) throw createHttpError(400, "studentId is required");
    getStudent(state, studentId);
    setActiveStudentId(studentId);
    return getProfilesPayload(state);
  }

  if (route === "/api/profiles/create" && method === "POST") {
    const name = normalizeName(body.name);
    const level = LEVEL_ORDER.includes(body.level) ? body.level : "TOPIK0";
    if (!name) throw createHttpError(400, "请输入学习者名字");

    const student = {
      id: uid("s"),
      name,
      level,
      streakDays: 0,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    state.students.push(student);
    initializeStudentVocabularyStatus(state, student.id, level);
    state.errorDailyStats.push({ id: uid("eds"), studentId: student.id, dateKey: dateKey(), errorCount: 0 });
    setActiveStudentId(student.id);
    return getProfilesPayload(state);
  }

  return null;
}

export async function api(path, options = {}) {
  const route = parsePath(path);
  const method = String(options.method || "GET").toUpperCase();
  const body = await parseBody(options);
  const state = loadState();

  try {
    const profileResult = handleProfilesRoute(state, route, method, body);
    if (profileResult) {
      saveState(state);
      return profileResult;
    }

    const student = getActiveStudent(state);

    if (route === "/api/student/dashboard" && method === "GET") {
      const payload = dashboardPayload(state, student);
      saveState(state);
      return payload;
    }

    if (route === "/api/student/daily/generate" && method === "POST") {
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
      const records = state.studyRecords.filter((item) => item.studentId === student.id).sort((a, b) => (a.date < b.date ? -1 : 1));
      const vocabulary = state.vocabularyStatuses
        .filter((item) => item.studentId === student.id)
        .sort((a, b) => b.errorCount - a.errorCount || a.word.localeCompare(b.word))
        .map((item) => ({
          ...item,
          meaning: getWordMeaning(item.word),
          statusLabel: mapStatusLabel(item.status)
        }));
      const errors = state.errorRecords
        .filter((item) => item.studentId === student.id)
        .sort((a, b) => b.count - a.count)
        .map((item) => ({
          ...item,
          contentMeaning: getWordMeaning(item.content),
          errorTypeLabel: mapErrorTypeLabel(item.errorType)
        }));
      const audio = state.audioRecords
        .filter((item) => item.studentId === student.id)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map((item) => ({
          ...item,
          hasAudio: Boolean(item.audioUrl)
        }));
      return {
        records,
        vocabulary,
        errors,
        audio,
        progressFeedback: getProgressFeedback(state, student.id),
        weeklyReport: buildWeeklyReport(state, student.id)
      };
    }

    if (route === "/api/student/vocab/answer" && method === "POST") {
      const word = String(body.word || "").trim();
      const answer = String(body.answer || "");
      const selected = String(body.selected || "");
      if (!word || !answer) throw createHttpError(400, "word and answer are required");

      const correct = selected === answer;
      let status = state.vocabularyStatuses.find((item) => item.studentId === student.id && item.word === word);
      if (!status) {
        status = {
          id: uid("vs"),
          studentId: student.id,
          word,
          status: "unknown",
          errorCount: 0,
          streakCorrect: 0,
          updatedAt: nowIso()
        };
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
      applyAudioRetention(state, student.id);
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
      const missingWordsDetailed = analysis.missingWords.map((word) => ({
        word,
        meaning: getWordMeaning(word)
      }));
      const wrongWordsDetailed = analysis.wrongWords.map((word) => ({
        word,
        meaning: getWordMeaning(word)
      }));
      saveState(state);

      return {
        score,
        finalScore: analysis.finalScore,
        similarityScore: analysis.similarityScore,
        keywordMatchScore: analysis.keywordMatchScore,
        lengthScore: analysis.lengthScore,
        segmentCoverageScore: analysis.segmentCoverageScore,
        verdict: analysis.verdict,
        feedback: analysis.message,
        transcript: analysis.recognizedText,
        missingWords: analysis.missingWords,
        wrongWords: analysis.wrongWords,
        missingWordsDetailed,
        wrongWordsDetailed,
        progressFeedback,
        streak: streak?.streakDays ?? student.streakDays,
        levelUpdate
      };
    }

    if (route === "/api/student/exam/current" && method === "GET") {
      const exam = buildExamPaper(state, student);
      return { weekKey: `${dateKey().slice(0, 7)}-W`, exam };
    }

    if (route === "/api/student/exam/submit" && method === "POST") {
      const listening = Array.isArray(body.listening) ? body.listening : [];
      const vocabulary = Array.isArray(body.vocabulary) ? body.vocabulary : [];
      const readingScore = clamp(asNumber(body.readingScore, 0), 0, 100);

      const listeningScore = listening.length
        ? (listening.filter((item) => item.selected === item.answer).length / listening.length) * 30
        : 0;
      const vocabScore = vocabulary.length
        ? (vocabulary.filter((item) => item.selected === item.answer).length / vocabulary.length) * 20
        : 0;
      const total = Math.round(listeningScore + vocabScore + readingScore * 0.5);
      const payload = {
        listeningScore,
        vocabScore,
        readingScore,
        total,
        advice:
          total >= 85
            ? "口语表现很稳定，继续保持每天开口朗读。"
            : "建议先复习本周错词，再重点重读低分句子。"
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

    throw createHttpError(404, "接口不存在");
  } catch (error) {
    throw new Error(error.message || "请求失败");
  } finally {
    saveState(state);
  }
}

export function getToken() {
  return "static-mode";
}

export function setSession() {}

export function clearSession() {}

export function getUser() {
  const state = loadState();
  const student = getActiveStudent(state);
  return { id: student.id, role: "STUDENT", name: student.name, studentId: student.id };
}
