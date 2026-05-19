/**
 * 화면 표시용 한국 시간 포맷 헬퍼.
 * DB 는 MySQL CURRENT_TIMESTAMP(3) (서버 timezone) 기준으로 저장되고,
 * mysql2 는 그 값을 Node 프로세스 TZ 로 해석한다.
 * 운영 환경(서버/DB)에 상관없이 표시는 항상 KST(Asia/Seoul) 로 강제한다.
 */
const KST_DATE_TIME = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const KST_DATE = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `YYYY-MM-DD HH:mm` (KST) */
export function formatKstDateTime(value: Date | string | number | null | undefined): string {
  const d = toDate(value);
  if (!d) return "";
  const parts = KST_DATE_TIME.formatToParts(d).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

/** `YYYY-MM-DD` (KST) */
export function formatKstDate(value: Date | string | number | null | undefined): string {
  const d = toDate(value);
  if (!d) return "";
  return KST_DATE.format(d).replace(/\.\s*/g, "-").replace(/-$/, "");
}
