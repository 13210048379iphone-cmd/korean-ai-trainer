export function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function weekKey(date = new Date()) {
  const firstDay = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const day = Math.floor((date - firstDay) / 86400000);
  const week = Math.ceil((day + firstDay.getUTCDay() + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
