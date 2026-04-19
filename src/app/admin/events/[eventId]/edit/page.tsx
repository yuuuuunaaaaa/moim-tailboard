import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getPageContext } from "@/lib/auth";
import Header from "@/components/Header";
import TenantSlugPersist from "@/components/TenantSlugPersist";
import AdminParticipantOptionsGrid from "@/components/AdminParticipantOptionsGrid";
import AutoToast from "@/components/AutoToast";
import type { Event, OptionGroup, OptionItem, Participant, ParticipantOption, Tenant } from "@/types";
import { toDateInputValue } from "@/lib/dateOnly";

interface Props {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ tenant?: string; toast?: string }>;
}

export const metadata = { title: "수정 · 꼬리달기" };

export default async function AdminEventEditPage({ params, searchParams }: Props) {
  const { admin, username, isAdmin, canChooseTenant } = await getPageContext();
  if (!admin) redirect("/login");

  const { eventId: eventIdStr } = await params;
  const eventId = Number(eventIdStr);
  if (!Number.isFinite(eventId)) {
    return <div style={{ padding: "48px", textAlign: "center" }}>꼬리달기 ID가 올바르지 않습니다.</div>;
  }

  const sp = await searchParams;
  const slugParam = (sp.tenant ?? "").trim();
  const toast = (sp.toast ?? "").trim();

  let tenant: Tenant;
  if (admin.is_superadmin) {
    if (!slugParam) {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [[row]] = await pool.query<any[]>(
      "SELECT id, slug, name FROM tenant WHERE slug = ? LIMIT 1",
      [slugParam],
    );
    if (!row) return <div style={{ padding: "48px", textAlign: "center" }}>지역을 찾을 수 없습니다.</div>;
    tenant = row as Tenant;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [[row]] = await pool.query<any[]>(
      "SELECT id, slug, name FROM tenant WHERE id = ? LIMIT 1",
      [admin.tenant_id],
    );
    if (!row) return <div style={{ padding: "48px", textAlign: "center" }}>소속 지역을 찾을 수 없습니다.</div>;
    tenant = row as Tenant;
    if (slugParam && slugParam !== tenant.slug) {
      redirect(
        `/admin/events/${eventId}/edit?tenant=${encodeURIComponent(tenant.slug)}`,
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [[eventRow]] = await pool.query<any[]>(
    "SELECT * FROM event WHERE id = ? AND tenant_id = ? LIMIT 1",
    [eventId, tenant.id],
  );
  if (!eventRow) return <div style={{ padding: "48px", textAlign: "center" }}>꼬리달기를 찾을 수 없습니다.</div>;
  const event = eventRow as Event;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [groupRows] = await pool.query<any[]>(
    "SELECT * FROM option_group WHERE event_id = ? ORDER BY sort_order ASC",
    [event.id],
  );
  const optionGroups = groupRows as OptionGroup[];

  let optionItems: OptionItem[] = [];
  if (optionGroups.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [itemRows] = await pool.query<any[]>(
      "SELECT * FROM option_item WHERE option_group_id IN (?) ORDER BY option_group_id, sort_order ASC",
      [optionGroups.map((g) => g.id)],
    );
    optionItems = itemRows as OptionItem[];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [participantRows] = await pool.query<any[]>(
    "SELECT * FROM participant WHERE event_id = ? ORDER BY id ASC",
    [event.id],
  );
  const participants = participantRows as Participant[];

  let participantOptions: ParticipantOption[] = [];
  if (participants.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [poRows] = await pool.query<any[]>(
      "SELECT po.*, oi.option_group_id FROM participant_option po JOIN option_item oi ON po.option_item_id = oi.id WHERE po.participant_id IN (?)",
      [participants.map((p) => p.id)],
    );
    participantOptions = poRows as ParticipantOption[];
  }

  const participantOptMap: Record<number, Set<number>> = {};
  participantOptions.forEach((po) => {
    if (!participantOptMap[po.participant_id]) participantOptMap[po.participant_id] = new Set();
    participantOptMap[po.participant_id].add(po.option_item_id);
  });
  const participantOptIds: Record<number, number[]> = {};
  participants.forEach((p) => {
    participantOptIds[p.id] = Array.from(participantOptMap[p.id] ?? []);
  });

  const groupsWithItems = optionGroups.map((g) => ({
    ...g,
    items: optionItems.filter((oi) => oi.option_group_id === g.id),
  }));

  const eventDateVal = toDateInputValue(event.event_date);

  return (
    <>
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
        <h1>꼬리달기 수정</h1>
        {toast === "row_saved" && (
          <AutoToast
            message="저장되었습니다."
            clearHref={`/admin/events/${event.id}/edit?tenant=${encodeURIComponent(tenant.slug)}`}
            timeoutMs={2000}
          />
        )}
        {toast === "participant_deleted" && (
          <AutoToast
            message="참여 기록을 삭제했습니다."
            clearHref={`/admin/events/${event.id}/edit?tenant=${encodeURIComponent(tenant.slug)}`}
            timeoutMs={2000}
          />
        )}

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
                <div className="form-group" style={{ marginBottom: 0 , marginTop: 10 }}>
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
                      <div
                        className="admin-og-row"
                      >
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
                          <button
                            type="submit"
                            className="btn btn--danger option-group-edit-btn"
                          >
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
      <style>{`
        /* Prevent page-level horizontal overflow on mobile.
           Tables are allowed to scroll inside .participants-wrap. */
        .container--wide {
          overflow-x: hidden;
        }
        .admin-grid,
        .card {
          min-width: 0;
          max-width: 100%;
        }
        .admin-og-row {
          min-width: 0;
        }

        .admin-event-field {
          margin-top: 12px;
          margin-bottom: 12px;
        }
        .admin-event-field:first-of-type {
          margin-top: 4px;
        }
        .admin-edit-actions {
          display: flex;
          gap: 8px;
          margin-top: 14px;
          flex-wrap: wrap;
        }
        .admin-edit-actions .btn {
          min-height: 44px;
        }

        .admin-og-row {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .admin-og-row .option-group-edit-btn {
          min-height: 44px;
        }

        .admin-participants-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .admin-participants-wrap .table {
          min-width: 720px;
        }

        /* Mobile-first: stack rows and make inputs full width */
        @media (max-width: 640px) {
          .admin-edit-row {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .admin-edit-row input,
          .admin-edit-row textarea {
            width: 100%;
          }
          .admin-edit-actions {
            flex-direction: column;
            align-items: stretch;
          }
          .admin-edit-actions .btn {
            width: 100%;
          }
          .option-group-edit-head {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
          }
          .option-group-edit-actions {
            width: 100%;
            justify-content: space-between;
          }
          .option-group-edit-actions button,
          .option-group-edit-actions .btn {
            min-height: 44px;
          }
          .admin-og-row form {
            width: 100%;
          }
          .admin-og-row > form:last-child {
            width: 100%;
          }
          .admin-og-row > form:last-child .btn {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}

