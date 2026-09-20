import type { Play, RankingRow } from "./types";

export const sumMinutes = (plays: Play[]) => plays.reduce((sum, play) => sum + play.minutes, 0);

export function ranking(
  plays: Play[],
  keyOf: (play: Play) => string,
  nameOf: (play: Play) => string,
  secondaryOf?: (play: Play) => string,
  uniqueOf?: (play: Play) => string,
): RankingRow[] {
  const rows = new Map<string, RankingRow & { uniques?: Set<string> }>();
  plays.forEach((play) => {
    const key = keyOf(play);
    const current = rows.get(key) ?? {
      key,
      name: nameOf(play),
      secondary: secondaryOf?.(play),
      minutes: 0,
      events: 0,
      streams: 0,
      uniques: uniqueOf ? new Set<string>() : undefined,
    };
    current.minutes += play.minutes;
    current.events += 1;
    if (play.ms >= 30_000) current.streams += 1;
    if (uniqueOf) current.uniques?.add(uniqueOf(play));
    rows.set(key, current);
  });
  return [...rows.values()]
    .map(({ uniques, ...row }) => ({ ...row, unique: uniques?.size }))
    .sort((a, b) => b.minutes - a.minutes || b.streams - a.streams);
}

export function timeSeries(plays: Play[], unit: "month" | "year" | "hour" | "weekday") {
  const values = new Map<string, number>();
  plays.forEach((play) => {
    const key = unit === "month" ? play.month : unit === "year" ? String(play.year) : unit === "hour" ? String(play.hour) : String(play.weekday);
    values.set(key, (values.get(key) ?? 0) + play.minutes);
  });
  return [...values.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => Number.isNaN(Number(a.label)) ? a.label.localeCompare(b.label) : Number(a.label) - Number(b.label));
}

export function longestStreak(plays: Play[]) {
  const days = [...new Set(plays.map((play) => play.day))].sort();
  let longest = 0;
  let current = 0;
  let bestStart = "";
  let bestEnd = "";
  let runStart = "";
  let previous: Date | null = null;
  days.forEach((day) => {
    const date = new Date(`${day}T12:00:00`);
    const consecutive = previous && Math.round((date.getTime() - previous.getTime()) / 86_400_000) === 1;
    if (consecutive) current += 1;
    else {
      current = 1;
      runStart = day;
    }
    if (current > longest) {
      longest = current;
      bestStart = runStart;
      bestEnd = day;
    }
    previous = date;
  });
  return { longest, bestStart, bestEnd };
}

export function sessions(plays: Play[]) {
  const values = new Map<number, { id: number; start: Date; end: Date; minutes: number; events: number; artists: Set<string> }>();
  plays.forEach((play) => {
    const current = values.get(play.sessionId) ?? { id: play.sessionId, start: play.at, end: play.at, minutes: 0, events: 0, artists: new Set<string>() };
    current.end = play.at;
    current.minutes += play.minutes;
    current.events += 1;
    current.artists.add(play.creator);
    values.set(play.sessionId, current);
  });
  return [...values.values()].sort((a, b) => b.minutes - a.minutes);
}

export function daily(plays: Play[]) {
  const values = new Map<string, { day: string; minutes: number; events: number }>();
  plays.forEach((play) => {
    const current = values.get(play.day) ?? { day: play.day, minutes: 0, events: 0 };
    current.minutes += play.minutes;
    current.events += 1;
    values.set(play.day, current);
  });
  return [...values.values()].sort((a, b) => b.minutes - a.minutes);
}

export function discoveries(plays: Play[], entity: "creator" | "uri") {
  const first = new Map<string, Play>();
  plays.forEach((play) => {
    const key = play[entity];
    if (!first.has(key)) first.set(key, play);
  });
  const months = new Map<string, number>();
  first.forEach((play) => months.set(play.month, (months.get(play.month) ?? 0) + 1));
  return [...months.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => a.label.localeCompare(b.label));
}

export function percentage(plays: Play[], field: "shuffle" | "skipped" | "offline" | "incognito") {
  const known = plays.filter((play) => play[field] !== null);
  return known.length ? (known.filter((play) => play[field]).length / known.length) * 100 : 0;
}

export function breakdown(plays: Play[], field: "platform" | "country" | "reasonStart" | "reasonEnd") {
  const values = new Map<string, number>();
  plays.forEach((play) => values.set(play[field], (values.get(play[field]) ?? 0) + play.minutes));
  return [...values.entries()].map(([name, minutes]) => ({ name, minutes })).sort((a, b) => b.minutes - a.minutes);
}
