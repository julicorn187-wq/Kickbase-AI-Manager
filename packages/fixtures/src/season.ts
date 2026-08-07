/**
 * OpenLigaDB numbers a Bundesliga season by the year it starts (e.g. season
 * "2026" for the 2026/2027 season, which runs roughly August to May). Given
 * a date, returns that season year: July onward belongs to the season
 * starting that year; before July belongs to the one that started the
 * previous year.
 */
export function getCurrentBundesligaSeasonYear(now: Date = new Date()): number {
  const month = now.getUTCMonth(); // 0-indexed; 6 = July
  return month >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}
