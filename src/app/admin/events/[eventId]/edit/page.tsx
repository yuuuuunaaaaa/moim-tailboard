import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import { getPageContext } from "@/lib/auth";
import Header from "@/components/Header";
import OptionGroupNestedDeleteButton from "@/components/OptionGroupNestedDeleteButton";
import type { Event, OptionGroup, OptionItem, Participant, ParticipantOption, Tenant } from "@/types";

interface Props {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ tenant?: string }>;
}

export const metadata = { title: "이벤트 수정 · 꼬리달기" };

export default async function AdminEventEditPage({ params, searchParams }: Props) {
  const { admin, username, isAdmin, canChooseTenant } = await getPageContext();
  if (!admin) redirect("/login");

  const { eventId: eventIdStr } = await params;
  const eventId = Number(eventIdStr);
  if (!Number.isFinite(eventId)) {
    return <div style={{ padding: "48px", textAlign: "center" }}>이벤트 ID가 올바르지 않습니다.</div>;
  }

  const sp = await searchParams;
  const slugParam = (sp.tenant ?? "").trim();

  let tenant: Tenant;
  if (admin.is_superadmin) {
    if (!slugParam) {
      return (
        <>
          <Header username={username} isAdmin={isAdmin} canChooseTenant={canChooseTenant} showAdminLink />
          <main className="container">
            <h1>이벤트 수정</h1>
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
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [[eventRow]] = await pool.query<any[]>(
    "SELECT * FROM event WHERE id = ? AND tenant_id = ? LIMIT 1",
    [eventId, tenant.id],
  );
  if (!eventRow) return <div style={{ padding: "48px", textAlign: "center" }}>이벤트를 찾을 수 없습니다.</div>;
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

  const groupsWithItems = optionGroups.map((g) => ({
    ...g,
    items: optionItems.filter((oi) => oi.option_group_id === g.id),
  }));

  const eventDateVal = new Date(event.event_date).toISOString().slice(0, 16);

  return (
    <>
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
        <h1>이벤트 수정 — {tenant.name}</h1>

        <div className="admin-grid" style={{ marginTop: "12px" }}>
          <div className="card" style={{ gridColumn: "1 / -1" }}>
            <h2 className="card__title">이벤트 정보</h2>
            <form method="post" action={`/api/admin/events/${event.id}/update`}>
              <input type="hidden" name="tenantSlug" value={tenant.slug} />
              <div className="row">
                <input type="text" name="title" defaultValue={event.title} required placeholder="제목" />
                <input type="datetime-local" name="eventDate" defaultValue={eventDateVal} required />
              </div>
              <div className="row">
                <textarea name="description" defaultValue={event.description ?? ""} placeholder="설명(선택)" />
              </div>
              <div className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: "10px" }}>
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
                <div className="form-group" style={{ marginBottom: 0 }}>
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
              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <button className="btn btn--primary btn--sm" type="submit">저장</button>
                <a className="btn btn--secondary btn--sm" href={`/t/${tenant.slug}/events/${event.id}`}>이벤트 보기</a>
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
                      <form method="post" action={`/api/admin/option-groups/${g.id}/update`}>
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
                            <OptionGroupNestedDeleteButton groupId={g.id} tenantSlug={tenant.slug} />
                          </div>
                        </div>
                        <textarea
                          name="itemsText"
                          defaultValue={itemsText}
                          placeholder={"항목 (한 줄에 하나)\n예: 식사 O\n식사 X"}
                          style={{ height: "88px", width: "100%" }}
                        />
                      </form>
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
              <form method="post" action={`/api/admin/events/${event.id}/participants/batch-update`}>
                <input type="hidden" name="tenantSlug" value={tenant.slug} />
                <div className="participants-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: "220px" }}>참여자</th>
                        {groupsWithItems.map((g) => <th key={g.id}>{g.name}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{p.name}{p.student_no ? ` (${p.student_no})` : ""}</div>
                            <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}><code>{p.username}</code></div>
                          </td>
                          {groupsWithItems.map((g) => {
                            const key = `p_${p.id}_g_${g.id}`;
                            const selected = participantOptMap[p.id] || new Set<number>();
                            const hasAnyInGroup = g.items.some((opt) => selected.has(opt.id));
                            return (
                              <td key={g.id} style={{ minWidth: "220px" }}>
                                {g.items.length === 0 ? (
                                  <span style={{ color: "var(--muted)" }}>—</span>
                                ) : g.multiple_select ? (
                                  <div className="checkbox-group">
                                    {g.items.map((opt) => (
                                      <label key={opt.id} style={{ display: "block" }}>
                                        <input type="checkbox" name={key} value={opt.id} defaultChecked={selected.has(opt.id)} />{" "}
                                        {opt.name}
                                      </label>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="radio-group">
                                    <label style={{ display: "block", color: "var(--muted)" }}>
                                      <input type="radio" name={key} value="" defaultChecked={!hasAnyInGroup} />{" "}
                                      미선택
                                    </label>
                                    {g.items.map((opt) => (
                                      <label key={opt.id} style={{ display: "block" }}>
                                        <input type="radio" name={key} value={opt.id} defaultChecked={selected.has(opt.id)} />{" "}
                                        {opt.name}
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: "12px", display: "flex", gap: "8px", alignItems: "center" }}>
                  <button className="btn btn--primary" type="submit">배치 저장</button>
                  <span className="form-hint" style={{ margin: 0 }}>
                    저장 시 기존 선택을 모두 지우고 화면 상태로 다시 저장합니다.
                  </span>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

