/**
 * DB의 DATE를 input[type=date] 값(YYYY-MM-DD)으로 안전하게 변환.
 * 화면 표시는 항상 KST(Asia/Seoul) 기준 — 서버/DB timezone 차이로 하루가 어긋나는 것을 차단한다.
 */
const KST_YMD = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function toDateInputValue(v: Date | string): string {
  if (v instanceof Date) {
    const parts = KST_YMD.formatToParts(v).reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return toDateInputValue(dt);
  return "";
}

export function formatDateKorean(v: Date | string): string {
  const s = toDateInputValue(v);
  return s ? s.replace(/-/g, ".") : "";
}

function kstYmdFromDate(d: Date): string {
  const parts = KST_YMD.formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** KST(Asia/Seoul) 기준 오늘 날짜 YYYY-MM-DD */
export function getTodayKstYmd(): string {
  return kstYmdFromDate(new Date());
}

/** 행사일이 KST 기준 오늘인지 */
export function isEventDayToday(eventDateYmd: string): boolean {
  const d = eventDateYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  return d === getTodayKstYmd();
}

