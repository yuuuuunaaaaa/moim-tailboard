"use client";

import { useState, useRef } from "react";
import type { Event, OptionGroup, OptionItem, Tenant } from "@/types";

interface GroupWithItems extends OptionGroup {
  items: OptionItem[];
}

interface Props {
  tenant: Tenant;
  tenants: Tenant[];
  events: Event[];
  groupsByEvent: Record<number, GroupWithItems[]>;
  username: string | null | undefined;
}

interface NewOptionGroup {
  id: number;
  name: string;
  multipleSelect: boolean;
  optionText: string;
}

export default function AdminEventEdit({ tenant, tenants, events, groupsByEvent, username }: Props) {
  const [openEditId, setOpenEditId] = useState<number | null>(null);
  const [createGroups, setCreateGroups] = useState<NewOptionGroup[]>([]);
  const [editGroups, setEditGroups] = useState<Record<number, NewOptionGroup[]>>({});
  const createGroupIdx = useRef(0);
  const editGroupIdx = useRef<Record<number, number>>({});

  function addCreateGroup() {
    const id = createGroupIdx.current++;
    setCreateGroups((prev) => [...prev, { id, name: "", multipleSelect: false, optionText: "" }]);
  }

  function removeCreateGroup(id: number) {
    setCreateGroups((prev) => prev.filter((g) => g.id !== id));
  }

  function addEditGroup(evId: number) {
    if (!editGroupIdx.current[evId]) editGroupIdx.current[evId] = 0;
    const id = editGroupIdx.current[evId]++;
    setEditGroups((prev) => ({
      ...prev,
      [evId]: [...(prev[evId] || []), { id, name: "", multipleSelect: false, optionText: "" }],
    }));
  }

  function removeEditGroup(evId: number, gId: number) {
    setEditGroups((prev) => ({
      ...prev,
      [evId]: (prev[evId] || []).filter((g) => g.id !== gId),
    }));
  }

  return (
    <div className="admin-grid">
      {/* 이벤트 목록 + 수정 */}
      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <h2 className="card__title">이벤트 목록</h2>
        {events.length === 0 ? (
          <p className="empty-state mt-0 mb-0">아직 이벤트가 없습니다. 아래에서 만들어 주세요.</p>
        ) : (
          <ul className="event-admin-list">
            {events.map((ev) => {
              const groups = groupsByEvent[ev.id] || [];
              const isOpen = openEditId === ev.id;
              const evEditGroups = editGroups[ev.id] || [];
              const eventDateVal = new Date(ev.event_date).toISOString().slice(0, 16);

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
                    {/* 수정 토글 버튼 */}
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setOpenEditId(isOpen ? null : ev.id)}
                      title="수정"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    {/* 이벤트 보기 */}
                    <a href={`/t/${tenant.slug}/events/${ev.id}`} className="icon-btn" title="보기">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    </a>
                    {/* 이벤트 삭제 */}
                    <form
                      method="post"
                      action={`/api/admin/events/${ev.id}/delete`}
                      style={{ display: "inline" }}
                      onSubmit={(e) => {
                        if (!confirm("이벤트와 모든 참여자 데이터가 삭제됩니다. 계속하시겠습니까?"))
                          e.preventDefault();
                      }}
                    >
                      <input type="hidden" name="tenantSlug" value={tenant.slug} />
                      <button className="icon-btn" style={{ color: "var(--danger)" }} title="삭제">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4h6v2" />
                        </svg>
                      </button>
                    </form>
                  </div>

                  {/* 수정 패널 */}
                  {isOpen && (
                    <div className="event-edit-wrapper" style={{ display: "block" }}>
                      {/* 기존 옵션 그룹 목록 + 삭제 */}
                      {groups.length > 0 && (
                        <div style={{ marginBottom: "10px" }}>
                          <div style={{ fontSize: "0.8125rem", fontWeight: 600, marginBottom: "6px", color: "var(--muted)" }}>
                            현재 옵션 그룹
                          </div>
                          {groups.map((g) => (
                            <div key={g.id} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", fontSize: "0.875rem" }}>
                              <span style={{ flex: 1 }}>
                                <b>{g.name}</b> · {g.items.map((i) => i.name).join(", ")}
                              </span>
                              <form
                                method="post"
                                action={`/api/admin/option-groups/${g.id}/delete`}
                                style={{ display: "inline" }}
                                onSubmit={(e) => {
                                  if (!confirm("옵션 그룹을 삭제하시겠습니까?")) e.preventDefault();
                                }}
                              >
                                <input type="hidden" name="tenantSlug" value={tenant.slug} />
                                <button
                                  type="submit"
                                  className="icon-btn"
                                  style={{ color: "var(--danger)", fontSize: "0.75rem" }}
                                  title="그룹 삭제"
                                >
                                  ✕
                                </button>
                              </form>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 이벤트 수정 폼 */}
                      <form
                        className="event-edit-form"
                        method="post"
                        action={`/api/admin/events/${ev.id}/update`}
                      >
                        <input type="hidden" name="tenantSlug" value={tenant.slug} />
                        {/* 새 옵션 그룹 hidden inputs */}
                        {evEditGroups.map((g) => (
                          <span key={g.id}>
                            <input type="hidden" name="groupName" value={g.name} />
                            <input type="hidden" name="multipleSelect" value={g.multipleSelect ? "true" : "false"} />
                            <input type="hidden" name="optionText" value={g.optionText} />
                          </span>
                        ))}
                        <div className="row">
                          <input type="text" name="title" defaultValue={ev.title} placeholder="제목" required />
                          <input type="datetime-local" name="eventDate" defaultValue={eventDateVal} required />
                        </div>
                        <div className="row">
                          <textarea name="description" placeholder="설명(선택)" defaultValue={ev.description ?? ""} />
                        </div>
                        <div className="row" style={{ flexDirection: "column", alignItems: "stretch", gap: "10px" }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: "0.8125rem" }}>참가 신청 방 알림 말머리</label>
                            <input
                              type="text"
                              name="eventTelegramJoinPrefix"
                              maxLength={64}
                              placeholder="비우면 👤"
                              defaultValue={ev.telegram_participant_join_prefix ?? ""}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: "0.8125rem" }}>참가 취소 방 알림 말머리</label>
                            <input
                              type="text"
                              name="eventTelegramLeavePrefix"
                              maxLength={64}
                              placeholder="비우면 👤"
                              defaultValue={ev.telegram_participant_leave_prefix ?? ""}
                            />
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                          <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--muted)" }}>옵션 그룹 추가</span>
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() => addEditGroup(ev.id)}
                          >
                            + 추가
                          </button>
                        </div>

                        {/* 새 옵션 그룹 입력 UI */}
                        {evEditGroups.map((g) => (
                          <div key={g.id} className="option-group-card">
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                              <input
                                type="text"
                                placeholder="그룹 이름"
                                style={{ flex: 1 }}
                                value={g.name}
                                onChange={(e) =>
                                  setEditGroups((prev) => ({
                                    ...prev,
                                    [ev.id]: (prev[ev.id] || []).map((x) =>
                                      x.id === g.id ? { ...x, name: e.target.value } : x,
                                    ),
                                  }))
                                }
                              />
                              <label style={{ whiteSpace: "nowrap", fontSize: "0.8125rem", margin: 0 }}>
                                <input
                                  type="checkbox"
                                  style={{ width: "auto", marginRight: "4px" }}
                                  checked={g.multipleSelect}
                                  onChange={(e) =>
                                    setEditGroups((prev) => ({
                                      ...prev,
                                      [ev.id]: (prev[ev.id] || []).map((x) =>
                                        x.id === g.id ? { ...x, multipleSelect: e.target.checked } : x,
                                      ),
                                    }))
                                  }
                                />
                                복수선택
                              </label>
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => removeEditGroup(ev.id, g.id)}
                                title="삭제"
                              >
                                ✕
                              </button>
                            </div>
                            <textarea
                              placeholder="항목 (한 줄에 하나)"
                              style={{ height: "70px", width: "100%" }}
                              value={g.optionText}
                              onChange={(e) =>
                                setEditGroups((prev) => ({
                                  ...prev,
                                  [ev.id]: (prev[ev.id] || []).map((x) =>
                                    x.id === g.id ? { ...x, optionText: e.target.value } : x,
                                  ),
                                }))
                              }
                            />
                          </div>
                        ))}

                        <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                          <button className="btn btn--primary btn--sm" type="submit">저장</button>
                          <button
                            className="btn btn--sm"
                            type="button"
                            onClick={() => setOpenEditId(null)}
                          >
                            닫기
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 이벤트 만들기 */}
      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <h2 className="card__title">이벤트 만들기</h2>
        <form method="post" action="/api/admin/events">
          <input type="hidden" name="tenantSlug" value={tenant.slug} />
          <input type="hidden" name="username" value={username || ""} />
          {/* 옵션 그룹 hidden inputs */}
          {createGroups.map((g) => (
            <span key={g.id}>
              <input type="hidden" name="groupName" value={g.name} />
              <input type="hidden" name="multipleSelect" value={g.multipleSelect ? "true" : "false"} />
              <input type="hidden" name="optionText" value={g.optionText} />
            </span>
          ))}
          {tenants.length > 1 && (
            <div className="form-group">
              <label>지역</label>
              <select
                name="tenantSlug"
                defaultValue={tenant.slug}
                onChange={(e) => {
                  window.location.href = `/admin?tenant=${e.target.value}`;
                }}
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.slug}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="admin-grid" style={{ marginBottom: 0 }}>
            <div>
              <div className="form-group">
                <label>제목</label>
                <input name="title" required placeholder="예: 3/7 인천 수련회" />
              </div>
              <div className="form-group">
                <label>설명 <span className="optional">(선택)</span></label>
                <textarea name="description" placeholder="이벤트 설명" />
              </div>
              <div className="form-group">
                <label>일시</label>
                <input name="eventDate" type="datetime-local" required />
              </div>
              <div className="form-group">
                <label>
                  <input type="checkbox" name="isActive" value="true" defaultChecked />
                  공개 (목록에 표시)
                </label>
              </div>
              <details className="form-group" style={{ marginTop: "12px" }}>
                <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.9rem" }}>
                  텔레그램 알림 커스텀 (이번 생성에만 적용)
                </summary>
                <p className="form-hint" style={{ marginTop: "8px", marginBottom: "10px" }}>
                  방에 보내는 1회 알림입니다. DB에 저장되지 않습니다. 비우면 기본 문구(📅·제목·링크)를 씁니다.
                </p>
                <div className="form-group">
                  <label>말머리(이모지 등)</label>
                  <input name="telegramNotifyIcon" maxLength={32} placeholder="기본: 📅" />
                </div>
                <div className="form-group">
                  <label>굵은 제목 한 줄</label>
                  <input
                    name="telegramNotifyHeadline"
                    maxLength={120}
                    placeholder="기본: 새 이벤트가 생성되었습니다!"
                  />
                </div>
                <div className="form-group">
                  <label>추가 문구</label>
                  <textarea
                    name="telegramNotifyExtra"
                    maxLength={500}
                    placeholder="이벤트명·링크 위·아래에 붙는 안내 (줄바꿈 가능)"
                    style={{ minHeight: "72px" }}
                  />
                </div>
              </details>
              <details className="form-group" style={{ marginTop: "12px" }}>
                <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.9rem" }}>
                  참가/취소 방 알림 말머리 (이 이벤트에 저장)
                </summary>
                <p className="form-hint" style={{ marginTop: "8px", marginBottom: "10px" }}>
                  신청(+1)·취소(-1) 텔레그램 알림 앞 이모지/문구입니다. 비우면 👤. 이벤트마다 다르게 둘 수 있습니다.
                </p>
                <div className="form-group">
                  <label>참가 신청 시</label>
                  <input name="eventTelegramJoinPrefix" maxLength={64} placeholder="예: ✅" />
                </div>
                <div className="form-group">
                  <label>참가 취소 시</label>
                  <input name="eventTelegramLeavePrefix" maxLength={64} placeholder="예: 👋" />
                </div>
              </details>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <span style={{ fontWeight: 600, fontSize: "0.9375rem" }}>
                  옵션 그룹 <span className="optional">(선택)</span>
                </span>
                <button type="button" className="btn btn--secondary btn--sm" onClick={addCreateGroup}>
                  + 그룹 추가
                </button>
              </div>
              {createGroups.map((g) => (
                <div key={g.id} className="option-group-card">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                    <input
                      type="text"
                      placeholder="그룹 이름 (예: 식사)"
                      style={{ flex: 1 }}
                      value={g.name}
                      onChange={(e) =>
                        setCreateGroups((prev) =>
                          prev.map((x) => (x.id === g.id ? { ...x, name: e.target.value } : x)),
                        )
                      }
                    />
                    <label style={{ whiteSpace: "nowrap", fontSize: "0.8125rem", margin: 0 }}>
                      <input
                        type="checkbox"
                        style={{ width: "auto", marginRight: "4px" }}
                        checked={g.multipleSelect}
                        onChange={(e) =>
                          setCreateGroups((prev) =>
                            prev.map((x) =>
                              x.id === g.id ? { ...x, multipleSelect: e.target.checked } : x,
                            ),
                          )
                        }
                      />
                      복수선택
                    </label>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => removeCreateGroup(g.id)}
                      title="삭제"
                    >
                      ✕
                    </button>
                  </div>
                  <textarea
                    placeholder={"항목 (한 줄에 하나)\n예: 식사 O\n식사 X"}
                    style={{ height: "80px", width: "100%" }}
                    value={g.optionText}
                    onChange={(e) =>
                      setCreateGroups((prev) =>
                        prev.map((x) => (x.id === g.id ? { ...x, optionText: e.target.value } : x)),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: "16px" }}>
            <button className="btn btn--primary" type="submit">이벤트 만들기</button>
          </div>
        </form>
      </div>
    </div>
  );
}
