import { redirect } from "next/navigation";
import { getPageContext } from "@/lib/auth";
import { resolveAdminTenant } from "@/lib/adminTenant";
import { queryFirst, queryRows } from "@/lib/queryRows";
import Header from "@/components/Header";
import TenantSlugPersist from "@/components/TenantSlugPersist";
import type { Event } from "@/types";

interface Props {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ tenant?: string }>;
}

export const metadata = { title: "로그 · 꼬리달기" };

type ActionLogRow = {
  id: number;
  action: string;
  created_at: Date | string;
  metadata: unknown;
};

const ACTION_LABEL: Record<string, string> = {
  JOIN_EVENT: "참여",
  CANCEL_EVENT: "취소",
};

function formatTs(v: Date | string) {
  const d = typeof v === "string" ? new Date(v) : v;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return String(v);
  // YYYY-MM-DD HH:mm
  const iso = d.toISOString().replace("T", " ").slice(0, 16);
  return iso;
}

function parseMetadata(meta: unknown): Record<string, unknown> | null {
  if (meta == null) return null;
  if (typeof meta === "string") {
    const s = meta.trim();
    if ((s.startsWith("{") && s.endsWith("}")) || (s.startsWith("[") && s.endsWith("]"))) {
      try {
        const parsed = JSON.parse(s);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
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

function extractNameFromMetadata(meta: unknown): string {
  const obj = parseMetadata(meta);
  const name = obj?.name;
  if (typeof name === "string") return name;
  return "";
}

export default async function AdminEventLogsPage({ params, searchParams }: Props) {
  const [{ admin, username, isAdmin, canChooseTenant }, { eventId: eventIdStr }, sp] =
    await Promise.all([getPageContext(), params, searchParams]);

  if (!admin) redirect("/login");

  const eventId = Number(eventIdStr);
  if (!Number.isFinite(eventId)) {
    return <div style={{ padding: "48px", textAlign: "center" }}>꼬리달기 ID가 올바르지 않습니다.</div>;
  }

  const slugParam = (sp.tenant ?? "").trim();
  const res = await resolveAdminTenant(admin, slugParam);

  if (res.kind === "missing") {
    return (
      <div style={{ padding: "48px", textAlign: "center" }}>
        {res.reason === "admin_tenant_not_found" ? "소속 지역을 찾을 수 없습니다." : "지역을 찾을 수 없습니다."}
      </div>
    );
  }
  if (res.kind === "redirect") {
    redirect(`/admin/events/${eventId}/logs?tenant=${encodeURIComponent(res.canonicalSlug)}`);
  }
  if (res.kind === "choose") {
    return (
      <>
        <Header username={username} isAdmin={isAdmin} canChooseTenant={canChooseTenant} showAdminLink />
        <main className="container">
          <h1>참여/취소 로그</h1>
          <p className="page-subtitle">최고 관리자는 지역을 먼저 선택해 주세요.</p>
          <p><a href="/admin" className="btn btn--secondary">관리로 이동</a></p>
        </main>
      </>
    );
  }

  const { tenant } = res;

  const event = await queryFirst<Event>(
    "SELECT * FROM event WHERE id = ? AND tenant_id = ? LIMIT 1",
    [eventId, tenant.id],
  );
  if (!event) {
    return <div style={{ padding: "48px", textAlign: "center" }}>꼬리달기를 찾을 수 없습니다.</div>;
  }

  const logs = await queryRows<ActionLogRow>(
    `
    SELECT
      al.id,
      al.action,
      al.created_at,
      al.metadata
    FROM action_log al
    WHERE al.tenant_id = ? AND al.event_id = ?
      AND al.action IN ('JOIN_EVENT', 'CANCEL_EVENT')
    ORDER BY al.created_at DESC, al.id DESC
    LIMIT 300
    `,
    [tenant.id, event.id],
  );

  const clearTenant = encodeURIComponent(tenant.slug);
  const backToAdmin = `/admin?tenant=${clearTenant}`;

  return (
    <div className="page-admin-edit">
      <TenantSlugPersist slug={tenant.slug} />
      <Header
        username={username}
        isAdmin={isAdmin}
        canChooseTenant={canChooseTenant}
        tenantSlug={tenant.slug}
        showAdminLink
        showEventsLink
      />
      <main className="container container--wide">
        <a href={backToAdmin} className="back-link">← 관리</a>

        <h1 style={{ marginBottom: 6 }}>참여/취소 로그</h1>
        <p className="page-subtitle" style={{ marginTop: 0 }}>
          {event.title}
        </p>

        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <h2 className="card__title">최근 기록</h2>
          {logs.length === 0 ? (
            <p className="empty-state mt-0 mb-0">아직 기록이 없습니다.</p>
          ) : (
            <div style={{ overflowX: "auto", maxWidth: "100%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9375rem" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                      구분
                    </th>
                    <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>
                      이름
                    </th>
                    <th style={{ textAlign: "left", padding: "10px 8px", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                      일시
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => {
                    const actionText = ACTION_LABEL[l.action] ?? l.action;
                    const name = extractNameFromMetadata(l.metadata) || "—";
                    const isJoin = l.action === "JOIN_EVENT";
                    const isCancel = l.action === "CANCEL_EVENT";
                    const symbol = isJoin ? "+" : isCancel ? "−" : "";
                    const symbolBg = isJoin
                      ? "rgba(34,197,94,0.14)"
                      : isCancel
                        ? "rgba(239,68,68,0.14)"
                        : "rgba(0,0,0,0.06)";
                    const symbolColor = isJoin ? "#16a34a" : isCancel ? "#dc2626" : "var(--text)";
                    return (
                      <tr key={l.id}>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                          <span
                            aria-hidden
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 18,
                              height: 18,
                              borderRadius: 6,
                              marginRight: 8,
                              background: symbolBg,
                              color: symbolColor,
                              fontWeight: 800,
                              lineHeight: 1,
                              fontSize: "0.875rem",
                              flex: "0 0 auto",
                            }}
                          >
                            {symbol}
                          </span>
                          {actionText}
                        </td>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid var(--border)" }}>
                          {name}
                        </td>
                        <td style={{ padding: "10px 8px", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                          {formatTs(l.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

