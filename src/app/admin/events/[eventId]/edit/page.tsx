import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { queryFirst, queryRows } from "@/lib/queryRows";
import { getPageContext } from "@/lib/auth";
import {
  redirectAdminIfChoose,
  redirectUnlessAdminTenantParam,
  resolveAdminTenant,
} from "@/lib/adminTenant";
import { TENANT_COOKIE_NAME } from "@/lib/tenantRestrict";
import Header from "@/components/Header";
import TenantSlugPersist from "@/components/TenantSlugPersist";
import AdminEventDeleteForm from "@/components/AdminEventDeleteForm";
import AdminEventVisibilityToggle from "@/components/AdminEventVisibilityToggle";
import AdminEventClosedToggle from "@/components/AdminEventClosedToggle";
import AutoToast from "@/components/AutoToast";
import AdminOptionItemsField from "@/components/AdminOptionItemsField";
import AdminAddOptionGroupForm from "@/components/AdminAddOptionGroupForm";
import type { Event, OptionGroup, OptionItem } from "@/types";
import { toDateInputValue } from "@/lib/dateOnly";

interface Props {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ tenant?: string; toast?: string }>;
}

export const metadata = { title: "수정 · 꼬리달기" };

const TOAST_TEXT: Record<string, string> = {
  row_saved: "저장되었습니다.",
  event_toggled_active: "공개로 전환했습니다.",
  event_toggled_inactive: "비공개로 전환했습니다.",
  event_closed_on: "마감했습니다.",
  event_closed_off: "마감을 해제했습니다.",
};

export default async function AdminEventEditPage({ params, searchParams }: Props) {
  const [{ admin, membership, isAdmin }, { eventId: eventIdStr }, sp, cookieStore] =
    await Promise.all([getPageContext(), params, searchParams, cookies()]);

  if (!admin || !membership) redirect("/login");

  const eventId = Number(eventIdStr);
  if (!Number.isFinite(eventId)) {
    return <div style={{ padding: "48px", textAlign: "center" }}>꼬리달기 ID가 올바르지 않습니다.</div>;
  }

  const slugParam = (sp.tenant ?? "").trim();
  const toast = (sp.toast ?? "").trim();
  const toastText = TOAST_TEXT[toast] ?? "";
  const allowedSlug = cookieStore.get(TENANT_COOKIE_NAME)?.value;

  redirectUnlessAdminTenantParam(slugParam, membership, allowedSlug);

  const res = resolveAdminTenant(membership, slugParam);

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
  redirectAdminIfChoose(res);

  const { tenant } = res;

  const event = await queryFirst<Event>(
    "SELECT * FROM event WHERE id = ? AND tenant_id = ? LIMIT 1",
    [eventId, tenant.id],
  );
  if (!event) {
    return <div style={{ padding: "48px", textAlign: "center" }}>꼬리달기를 찾을 수 없습니다.</div>;
  }

  const optionGroups = await queryRows<OptionGroup>(
    "SELECT * FROM option_group WHERE event_id = ? ORDER BY sort_order ASC",
    [event.id],
  );

  const optionItems =
    optionGroups.length === 0
      ? []
      : await queryRows<OptionItem>(
          "SELECT * FROM option_item WHERE option_group_id IN (?) ORDER BY option_group_id, sort_order ASC",
          [optionGroups.map((g) => g.id)],
        );

  // 파생 자료구조: O(n+m)으로 준비
  const itemsByGroup = new Map<number, OptionItem[]>();
  for (const g of optionGroups) itemsByGroup.set(g.id, []);
  for (const oi of optionItems) {
    const arr = itemsByGroup.get(oi.option_group_id);
    if (arr) arr.push(oi);
  }
  const groupsWithItems = optionGroups.map((g) => ({ ...g, items: itemsByGroup.get(g.id) ?? [] }));

  const eventDateVal = toDateInputValue(event.event_date);
  const clearHref = `/admin/events/${event.id}/edit?tenant=${encodeURIComponent(tenant.slug)}`;
  const isClosed = !!event.is_closed;

  return (
    <div className="page-admin-edit">
      <TenantSlugPersist slug={tenant.slug} />
      <Header isAdmin={isAdmin} tenantSlug={tenant.slug} tenantName={tenant.name} showAdminLink showEventListLink />
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
            <AdminEventClosedToggle
              eventId={event.id}
              tenantSlug={tenant.slug}
              returnTo={clearHref}
              isClosed={isClosed}
            />
            <AdminEventVisibilityToggle
              eventId={event.id}
              tenantSlug={tenant.slug}
              returnTo={clearHref}
              isActive={!!event.is_active}
            />
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
                          <AdminOptionItemsField initialItems={g.items} />
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
            <AdminAddOptionGroupForm tenantSlug={tenant.slug} eventId={event.id} />
          </div>

          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <h2 className="card__title">참여자 관리</h2>
            <p className="form-hint" style={{ marginTop: 0, marginBottom: "12px" }}>
              참여자 이름·옵션 수정과 삭제는 꼬리달기 상세 화면에서 합니다.
            </p>
            <a
              className="btn btn--secondary"
              href={`/t/${encodeURIComponent(tenant.slug)}/events/${event.id}`}
            >
              참여자 보기
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
