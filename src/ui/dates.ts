// Calendar dates as the app shows and picks them. Dates are "YYYY-MM-DD" in the phone's own
// time zone, so "today" is the day the person sees on their phone.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The local date `daysAgo` days before `now`: localDate(0) is today, localDate(1) yesterday. */
export function localDate(daysAgo: number, now = new Date()): string {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** "Nov 21" for a date in the current year, "Nov 21, 2025" otherwise. */
export function formatDate(date: string, today: string): string {
  const [year, month, day] = date.split('-');
  const short = `${MONTHS[Number(month) - 1] ?? '?'} ${Number(day)}`;
  return year === today.slice(0, 4) ? short : `${short}, ${year}`;
}
