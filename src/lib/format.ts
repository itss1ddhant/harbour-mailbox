// Small text helpers used by the screens.

// Times are shown relative to now ("5 min ago", "in 23 hours"), so they read the same in any time zone.

// A length of time in words, using the largest sensible unit: "5 min", "3 hours", "2 days".
function span(ms: number) {
  const min = Math.round(Math.abs(ms) / 60_000);
  if (min < 1) return "a moment";
  if (min < 60) return `${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

// "5 min ago" for the past, "in 2 days" for the future.
export function timeAgo(at: number, now = Date.now()) {
  return at > now ? `in ${span(at - now)}` : `${span(now - at)} ago`;
}

// The text on a due-date badge: "Due in 1 day" or "Overdue by 3 hours".
export function dueLabel(dueAt: number, now = Date.now()) {
  return dueAt < now ? `Overdue by ${span(now - dueAt)}` : `Due in ${span(dueAt - now)}`;
}

// A one-line preview of a message: line breaks removed, cut to `max` characters with "…".
export function shorten(text: string, max = 140) {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? oneLine.slice(0, max - 1) + "…" : oneLine;
}
