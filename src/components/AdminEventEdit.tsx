import AdminEventDeleteForm from "@/components/AdminEventDeleteForm";
import type { Event, Tenant } from "@/types";

interface Props {
  tenant: Tenant;
  events: Event[];
}
export default function AdminEventEdit({ tenant, events }: Props) {
  return (
    <div className="admin-grid">
      {/* 이벤트 목록 */}
      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
          <h2 className="card__title" style={{ marginBottom: 0 }}>이벤트 목록</h2>
          <a className="btn btn--primary btn--sm" href={`/admin/events/new?tenant=${encodeURIComponent(tenant.slug)}`}>
            + 이벤트 등록
          </a>
        </div>
        {events.length === 0 ? (
          <p className="empty-state mt-0 mb-0">아직 이벤트가 없습니다. 아래에서 만들어 주세요.</p>
        ) : (
          <ul className="event-admin-list">
            {events.map((ev) => {
              return (
                <li key={ev.id}>
                  <div className="event-admin-item">
                    <div className="event-admin-info">
                      <div className="event-admin-title">{ev.title}</div>
                      <div className="event-admin-date">
                        {new Date(ev.event_date).toISOString().slice(0, 16).replace("T", " ")}
                      </div>
                    </div>
                    <span className={`badge ${ev.is_active ? "badge--on" : "badge--off"}`}>
                      {ev.is_active ? "공개" : "비공개"}
                    </span>
                    {/* 공개/비공개 토글 */}
                    <form
                      method="post"
                      action={`/api/admin/events/${ev.id}/toggle`}
                      style={{ display: "inline" }}
                    >
                      <input type="hidden" name="tenantSlug" value={tenant.slug} />
                      <button className="icon-btn" title={ev.is_active ? "비공개로 전환" : "공개로 전환"}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                    </form>
                    {/* 이벤트 수정 페이지 */}
                    <a
                      className="icon-btn"
                      href={`/admin/events/${ev.id}/edit?tenant=${encodeURIComponent(tenant.slug)}`}
                      title="수정"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </a>
                    {/* 이벤트 보기 */}
                    <a href={`/t/${tenant.slug}/events/${ev.id}`} className="icon-btn" title="보기">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                    <AdminEventDeleteForm eventId={ev.id} tenantSlug={tenant.slug} />
                  </div>

                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
