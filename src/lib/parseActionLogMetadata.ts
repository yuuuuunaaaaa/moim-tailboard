export function parseActionLogMetadata(meta: unknown): Record<string, unknown> | null {
  if (meta == null) return null;
  if (typeof meta === "string") {
    const s = meta.trim();
    if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
      try {
        const parsed = JSON.parse(s);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
        return null;
      } catch {
        return null;
      }
    }
    return null;
  }
  if (meta && typeof meta === "object" && !Array.isArray(meta)) return meta as Record<string, unknown>;
  return null;
}

export function summarizeActionLogMetadata(meta: unknown): string {
  const obj = parseActionLogMetadata(meta);
  if (!obj) return "";
  const parts: string[] = [];
  if (typeof obj.name === "string" && obj.name.trim()) parts.push(obj.name.trim());
  if (typeof obj.title === "string" && obj.title.trim()) parts.push(obj.title.trim());
  if (typeof obj.newName === "string" && obj.newName.trim()) parts.push(`→ ${obj.newName.trim()}`);
  if (typeof obj.username === "string" && obj.username.trim()) parts.push(`@${obj.username.trim()}`);
  return parts.join(" · ");
}
