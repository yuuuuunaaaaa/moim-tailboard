/**
 * DB의 DATE를 input[type=date] 값(YYYY-MM-DD)으로 안전하게 변환.
 */
export function toDateInputValue(v: Date | string): string {
  if (v instanceof Date) {
    // 로컬 타임존 영향 최소화를 위해 날짜 구성요소로 조립
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v).trim();
  // 이미 YYYY-MM-DD 형태면 그대로
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // 그 외는 Date 파싱 후 변환
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return toDateInputValue(dt);
  return "";
}

export function formatDateKorean(v: Date | string): string {
  const s = toDateInputValue(v);
  return s ? s.replace(/-/g, ".") : "";
}

