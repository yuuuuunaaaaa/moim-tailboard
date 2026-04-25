import { redirect } from "next/navigation";
import { queryFirst, queryRows } from "@/lib/queryRows";
import { getPageContext } from "@/lib/auth";
import { resolveAdminTenant } from "@/lib/adminTenant";
import Header from "@/components/Header";
import TenantSlugPersist from "@/components/TenantSlugPersist";
import AdminParticipantOptionsGrid from "@/components/AdminParticipantOptionsGrid";
import AdminEventDeleteForm from "@/components/AdminEventDeleteForm";
import AutoToast from "@/components/AutoToast";
import type { Event, OptionGroup, OptionItem, Participant, ParticipantOption } from "@/types";
import { toDateInputValue } from "@/lib/dateOnly";

interface Props {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ tenant?: string; toast?: string }>;
}

export const metadata = { title: "수정 · 꼬리달기" };

const TOAST_TEXT: Record<string, string> = {
  row_saved: "저장되었습니다.",
  participant_deleted: "참여 기록을 삭제했습니다.",
  event_toggled_active: "공개로 전환했습니다.",
  event_toggled_inactive: "비공개로 전환했습니다.",
};

export default async function AdminEventEditPage({ params, searchParams }: Props) {
  const [{ admin, username, isAdmin, canChooseTenant }, { eventId: eventIdStr }, sp] =
    await Promise.all([getPageContext(), params, searchParams]);

  if (!admin) redirect("/login");

  const eventId = Number(eventIdStr);
  if (!Number.isFinite(eventId)) {
    return <div style={{ padding: "48px", textAlign: "center" }}>꼬리달기 ID가 올바르지 않습니다.</div>;
  }

  const slugParam = (sp.tenant ?? "").trim();
  const toast = (sp.toast ?? "").trim();
  const toastText = TOAST_TEXT[toast] ?? "";

  const res = await resolveAdminTenant(admin, slugParam);

  if (res.kind === "missing") {
    return (
      <div style={{ padding: "48px", textAlign: "center" }}>
        {res.reason === "admin_tenant_not_found" ? "소속 지역을 찾을 수 없습니다." : "지역을 찾을 수 없습니다."}
      </div>
    );
  }
  if (res.kind === "redirect") {
    redirect(`/admin/events/${eventId}/edit?tenant=${encodeURIComponent(res.canonicalSlug)}`);
  }
  if (res.kind === "choose") {
    return (
      <>
        <Header username={username} isAdmin={isAdmin} canChooseTenant={canChooseTenant} showAdminLink />
        <main className="container">
          <h1>꼬리달기 수정</h1>
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

  // 이벤트가 확정된 뒤: 옵션 그룹·참여자는 서로 독립 → 병렬
  const [optionGroups, participants] = await Promise.all([
    queryRows<OptionGroup>(
      "SELECT * FROM option_group WHERE event_id = ? ORDER BY sort_order ASC",
      [event.id],
    ),
    queryRows<Participant>(
      "SELECT * FROM participant WHERE event_id = ? ORDER BY id ASC",
      [event.id],
    ),
  ]);

  const [optionItems, participantOptions] = await Promise.all([
    optionGroups.length === 0
      ? Promise.resolve<OptionItem[]>([])
      : queryRows<OptionItem>(
          "SELECT * FROM option_item WHERE option_group_id IN (?) ORDER BY option_group_id, sort_order ASC",
          [optionGroups.map((g) => g.id)],
        ),
    participants.length === 0
      ? Promise.resolve<ParticipantOption[]>([])
      : queryRows<ParticipantOption>(
          "SELECT po.*, oi.option_group_id FROM participant_option po JOIN option_item oi ON po.option_item_id = oi.id WHERE po.participant_id IN (?)",
          [participants.map((p) => p.id)],
        ),
  ]);

  // 파생 자료구조: O(n+m)으로 준비
  const itemsByGroup = new Map<number, OptionItem[]>();
  for (const g of optionGroups) itemsByGroup.set(g.id, []);
  for (const oi of optionItems) {
    const arr = itemsByGroup.get(oi.option_group_id);
    if (arr) arr.push(oi);
  }
  const groupsWithItems = optionGroups.map((g) => ({ ...g, items: itemsByGroup.get(g.id) ?? [] }));

  const participantOptIds: Record<number, number[]> = {};
  for (const p of participants) participantOptIds[p.id] = [];
  for (const po of participantOptions) {
    const arr = participantOptIds[po.participant_id];
    if (arr) arr.push(po.option_item_id);
  }

  const eventDateVal = toDateInputValue(event.event_date);
  const clearHref = `/admin/events/${event.id}/edit?tenant=${encodeURIComponent(tenant.slug)}`;

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
        <a href={`/admin?tenant=${encodeURIComponent(tenant.slug)}`} className="back-link">← 관리</a>

        {/*
         * 페이지 헤더 액션바: 모바일은 세로 스택, 넓은 화면은 한 줄로.
         * - 공개/비공개 토글: 변경 후 이 페이지로 다시 돌아오도록 returnTo 를 함께 보낸다.
         * - 삭제: 여기서만 가능. 삭제 후엔 관리 메인으로 이동.
         */}
        <div className="admin-edit-header">
          <h1 style={{ margin: 0 }}>꼬리달기 수정</h1>
          <div className="admin-edit-header-actions">
            <form method="post" action={`/api/admin/events/${event.id}/toggle`}>
              <input type="hidden" name="tenantSlug" value={tenant.slug} />
              <input type="hidden" name="returnTo" value={clearHref} />
              <button
                type="submit"
                className={`badge ${event.is_active ? "badge--on" : "badge--off"}`}
                title={event.is_active ? "비공개로 전환" : "공개로 전환"}
                style={{ cursor: "pointer", border: 0, minHeight: 32 }}
              >
                {event.is_active ? "공개" : "비공개"}
              </button>
            </form>
            <AdminEventDeleteForm eventId={event.id} tenantSlug={tenant.slug} />
          </div>
        </div>
        {toastText && <AutoToast message={toastText} clearHref={clearHref} timeoutMs={2000} />}

        <div className="admin-grid" style={{ marginTop: "12px" }}>
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <h2 className="card__title">꼬리달기 정보</h2>
            <form method="post" action={`/api/admin/events/${event.id}/update`}>
              <input type="hidden" name="tenantSlug" value={tenant.slug} />
              <div className="row admin-edit-row admin-event-field">
                <input type="text" name="title" defaultValue={event.title} required placeholder="제목" />
              </div>
              <div className="row admin-edit-row admin-event-field">
                <input type="date" name="eventDate" defaultValue={eventDateVal} required />
              </div>
              <div className="row admin-edit-row admin-event-field">
                <textarea name="description" defaultValue={event.description ?? ""} placeholder="설명(선택)" />
              </div>
              <div className="row admin-edit-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "10px" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: "0.8125rem" }}>참가 신청 방 알림 말머리</label>
                  <input
                    type="text"
                    name="eventTelegramJoinPrefix"
                    maxLength={64}
                    placeholder="비우면 👤"
                    defaultValue={event.telegram_participant_join_prefix ?? ""}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0, marginTop: 10 }}>
                  <label style={{ fontSize: "0.8125rem" }}>참가 취소 방 알림 말머리</label>
                  <input
                    type="text"
                    name="eventTelegramLeavePrefix"
                    maxLength={64}
                    placeholder="비우면 👤"
                    defaultValue={event.telegram_participant_leave_prefix ?? ""}
                  />
                </div>
              </div>
              <div className="admin-edit-actions">
                <button className="btn btn--primary btn--sm" type="submit">저장</button>
              </div>
            </form>
          </div>

          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <h2 className="card__title">옵션 그룹 수정</h2>
            {groupsWithItems.length === 0 ? (
              <p className="empty-state mt-0 mb-0">옵션 그룹이 없습니다.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {groupsWithItems.map((g) => {
                  const itemsText = g.items.map((i) => i.name).join("\n");
                  return (
                    <div key={g.id} className="option-group-card">
                      <div className="admin-og-row">
                        <form
                          method="post"
                          action={`/api/admin/option-groups/${g.id}/update`}
                          style={{ flex: "1 1 240px", minWidth: 0 }}
                        >
                          <input type="hidden" name="tenantSlug" value={tenant.slug} />
                          <input type="hidden" name="eventId" value={event.id} />
                          <div className="option-group-edit-head">
                            <input
                              type="text"
                              name="groupName"
                              className="option-group-edit-name"
                              defaultValue={g.name}
                              required
                              placeholder="옵션 그룹 이름"
                              autoComplete="off"
                            />
                            <div className="option-group-edit-actions">
                              <label className="option-group-edit-check">
                                <input
                                  type="checkbox"
                                  name="multipleSelect"
                                  value="true"
                                  defaultChecked={!!g.multiple_select}
                                />
                                복수선택
                              </label>
                              <button className="btn btn--secondary option-group-edit-btn" type="submit">
                                저장
                              </button>
                            </div>
                          </div>
                          <textarea
                            name="itemsText"
                            defaultValue={itemsText}
                            placeholder={"항목 (한 줄에 하나)\n예: 식사 O\n식사 X"}
                            style={{ height: "88px", width: "100%" }}
                          />
                        </form>
                        <form
                          method="post"
                          action={`/api/admin/option-groups/${g.id}/delete`}
                          style={{ flexShrink: 0 }}
                        >
                          <input type="hidden" name="tenantSlug" value={tenant.slug} />
                          <button type="submit" className="btn btn--danger option-group-edit-btn">
                            삭제
                          </button>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <h2 className="card__title">옵션 그룹 추가</h2>
            <form method="post" action="/api/admin/options">
              <input type="hidden" name="tenantSlug" value={tenant.slug} />
              <input type="hidden" name="eventId" value={event.id} />
              <div className="option-group-edit-head">
                <input
                  type="text"
                  name="groupName"
                  className="option-group-edit-name"
                  required
                  placeholder="그룹 이름 (예: 식사)"
                  autoComplete="off"
                />
                <div className="option-group-edit-actions">
                  <label className="option-group-edit-check">
                    <input type="checkbox" name="multipleSelect" value="true" />
                    복수선택
                  </label>
                </div>
              </div>
              <div className="row" style={{ marginTop: "8px" }}>
                <textarea name="options" placeholder={"항목 (한 줄에 하나)\n예: 식사 O\n식사 X"} />
              </div>
              <button className="btn btn--secondary option-group-edit-btn" type="submit" style={{ marginTop: "10px" }}>
                추가
              </button>
            </form>
          </div>

          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <h2 className="card__title">참여자 옵션 배치 수정</h2>
            {participants.length === 0 ? (
              <p className="empty-state mt-0 mb-0">참여자가 없습니다.</p>
            ) : groupsWithItems.length === 0 ? (
              <p className="empty-state mt-0 mb-0">옵션 그룹이 없습니다.</p>
            ) : (
              <>
                <p className="form-hint" style={{ marginTop: 0 }}>
                  맨 오른쪽 <strong>수정</strong>은 해당 참여자 옵션만 저장하고,{" "}
                  <strong>참여 삭제</strong>는 목록에서 제거합니다(텔레그램 방 알림은 가지 않습니다).
                </p>
                <AdminParticipantOptionsGrid
                  eventId={event.id}
                  tenantSlug={tenant.slug}
                  groups={groupsWithItems}
                  participants={participants}
                  participantOptMap={participantOptIds}
                />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
