import { dateKey } from "../utils/date.js";

export function dateFromKey(key) {
  return new Date(`${key}T00:00:00.000Z`);
}

export function addDays(key, days) {
  const value = dateFromKey(key);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function nextLevel(level, delta) {
  const match = String(level || "A1").match(/^([A-Z])(\d+)$/);
  if (!match) return level || "A1";
  const group = match[1];
  const base = Number(match[2]);
  const min = 1;
  const max = 6;
  const value = Math.max(min, Math.min(max, base + delta));
  return `${group}${value}`;
}

export function summarizeProgress({ records, errors, todayKey = dateKey() }) {
  const todayStart = dateFromKey(todayKey);
  const todayRecords = records.filter((item) => item.date >= todayStart);
  const yesterdayRecords = records.filter((item) => item.date < todayStart);
  const todayAvg = todayRecords.length
    ? Math.round(todayRecords.reduce((sum, item) => sum + item.score, 0) / todayRecords.length)
    : 0;
  const yesterdayAvg = yesterdayRecords.length
    ? Math.round(yesterdayRecords.reduce((sum, item) => sum + item.score, 0) / yesterdayRecords.length)
    : 0;

  const todayErrors = errors.filter((item) => item.updatedAt >= todayStart).length;
  const yesterdayErrors = errors.filter((item) => item.updatedAt < todayStart).length;

  return {
    todayAverageScore: todayAvg,
    yesterdayAverageScore: yesterdayAvg,
    scoreDelta: todayAvg - yesterdayAvg,
    todayErrorCount: todayErrors,
    yesterdayErrorCount: yesterdayErrors,
    errorDelta: todayErrors - yesterdayErrors,
    errorReduction: yesterdayErrors - todayErrors
  };
}

export function recentThreeDayAverage(records) {
  const byDay = new Map();
  for (const item of records) {
    const key = item.date.toISOString().slice(0, 10);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(item.score);
  }
  const dailyAverages = [...byDay.values()].map((scores) => scores.reduce((sum, v) => sum + v, 0) / scores.length);
  const recent3 = dailyAverages.slice(0, 3);
  if (recent3.length < 3) return null;
  return recent3.reduce((sum, v) => sum + v, 0) / recent3.length;
}

export function calculateStreak(completedDates, today = dateKey()) {
  const set = new Set(completedDates);
  let streak = 0;
  let cursor = today;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
