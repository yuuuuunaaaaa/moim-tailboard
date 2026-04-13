"use client";

import { useMemo, useRef, useState } from "react";
import type { Event, OptionGroup, OptionItem, Participant, ParticipantOption, Tenant } from "@/types";

interface GroupWithItems extends OptionGroup {
  items: OptionItem[];
}

interface Props {
  tenant: Tenant;
  tenants: Tenant[];
  events: Event[];
  groupsByEvent: Record<number, GroupWithItems[]>;
  username: string | null | undefined;
  editEventId: number | null;
  editParticipants: Participant[];
  editParticipantOptions: ParticipantOption[];
}

interface NewOptionGroup {
  id: number;
  name: string;
  multipleSelect: boolean;
  optionText: string;
}

export default function AdminEventEdit({
  tenant,
  tenants,
  events,
  groupsByEvent,
  username,
  editEventId,
  editParticipants,
  editParticipantOptions,
}: Props) {
  const [createGroups, setCreateGroups] = useState<NewOptionGroup[]>([]);
  const createGroupIdx = useRef(0);
  const [editGroupsDraft, setEditGroupsDraft] = useState<Record<number, { name: string; multiple: boolean; itemsText: string }>>({});

  function addCreateGroup() {
    const id = createGroupIdx.current++;
    setCreateGroups((prev) => [...prev, { id, name: "", multipleSelect: false, optionText: "" }]);
  }

  function removeCreateGroup(id: number) {
    setCreateGroups((prev) => prev.filter((g) => g.id !== id));
  }

  return (
    <div className="admin-grid">
      {/* 이벤트 목록 */}
      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <h2 className="card__title">이벤트 목록</h2>
        {events.length === 0 ? (
          <p className="empty-state mt-0 mb-0">아직 이벤트가 없습니다. 아래에서 만들어 주세요.</p>
        ) : (
          <ul className="event-admin-list">
            {events.map((ev) => {
              const groups = groupsByEvent[ev.id] || [];
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
                    {/* 이벤트 수정(등록 폼 재사용) */}
                    <a
                      className="icon-btn"
                      href={`/admin?tenant=${encodeURIComponent(tenant.slug)}&edit=${ev.id}`}
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

                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 이벤트 수정 */}
      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
          <h2 className="card__title" style={{ marginBottom: 0 }}>이벤트 수정</h2>
          <select
            defaultValue={editEventId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) {
                window.location.href = `/admin?tenant=${encodeURIComponent(tenant.slug)}`;
                return;
              }
              window.location.href = `/admin?tenant=${encodeURIComponent(tenant.slug)}&edit=${encodeURIComponent(v)}`;
            }}
            style={{ padding: "8px 12px", borderRadius: "10px", border: "1px solid var(--border)" }}
          >
            <option value="">— 수정할 이벤트 선택 —</option>
            {events.map((ev) => (
              <option key={ev.id} value={String(ev.id)}>{ev.title}</option>
            ))}
          </select>
        </div>

        {(() => {
          if (!editEventId) return <p className="page-subtitle" style={{ marginTop: "10px" }}>위에서 이벤트를 선택하면 등록 폼 형태로 수정할 수 있습니다.</p>;
          const ev = events.find((x) => x.id === editEventId);
          if (!ev) return <p className="page-subtitle" style={{ marginTop: "10px" }}>선택한 이벤트를 찾을 수 없습니다.</p>;

          const groups = groupsByEvent[ev.id] || [];
          const participantOptMap: Record<number, Set<number>> = {};
          editParticipantOptions.forEach((po) => {
            if (!participantOptMap[po.participant_id]) participantOptMap[po.participant_id] = new Set();
            participantOptMap[po.participant_id].add(po.option_item_id);
          });

          const eventDateVal = new Date(ev.event_date).toISOString().slice(0, 16);

          return (
            <div style={{ marginTop: "14px" }}>
              <form method="post" action={`/api/admin/events/${ev.id}/update`}>
                <input type="hidden" name="tenantSlug" value={tenant.slug} />
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
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <button className="btn btn--primary btn--sm" type="submit">저장</button>
                  <a className="btn btn--secondary btn--sm" href={`/t/${tenant.slug}/events/${ev.id}`}>이벤트 보기</a>
                </div>
              </form>

              <div style={{ marginTop: "18px" }}>
                <h3 style={{ margin: "0 0 10px 0", fontSize: "0.95rem" }}>옵션 그룹 수정</h3>
                {groups.length === 0 ? (
                  <p className="empty-state mt-0 mb-0">옵션 그룹이 없습니다.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {groups.map((g) => {
                      const draft = editGroupsDraft[g.id] ?? {
                        name: g.name,
                        multiple: !!g.multiple_select,
                        itemsText: g.items.map((i) => i.name).join("\n"),
                      };
                      return (
                        <div key={g.id} className="option-group-card">
                          <form method="post" action={`/api/admin/option-groups/${g.id}/update`}>
                            <input type="hidden" name="tenantSlug" value={tenant.slug} />
                            <input type="hidden" name="eventId" value={ev.id} />
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                              <input
                                type="text"
                                name="groupName"
                                value={draft.name}
                                required
                                style={{ flex: 1 }}
                                onChange={(e) =>
                                  setEditGroupsDraft((prev) => ({
                                    ...prev,
                                    [g.id]: { ...draft, name: e.target.value },
                                  }))
                                }
                              />
                              <label style={{ whiteSpace: "nowrap", fontSize: "0.8125rem", margin: 0 }}>
                                <input
                                  type="checkbox"
                                  name="multipleSelect"
                                  value="true"
                                  checked={draft.multiple}
                                  style={{ width: "auto", marginRight: "4px" }}
                                  onChange={(e) =>
                                    setEditGroupsDraft((prev) => ({
                                      ...prev,
                                      [g.id]: { ...draft, multiple: e.target.checked },
                                    }))
                                  }
                                />
                                복수선택
                              </label>
                              <button className="btn btn--secondary btn--sm" type="submit">저장</button>
                              <button
                                type="submit"
                                className="btn btn--danger btn--sm"
                                formMethod="post"
                                formAction={`/api/admin/option-groups/${g.id}/delete`}
                                name="tenantSlug"
                                value={tenant.slug}
                                onClick={(e) => {
                                  if (!confirm("옵션 그룹을 삭제하시겠습니까? (선택 데이터도 함께 정리됩니다)")) {
                                    e.preventDefault();
                                  }
                                }}
                              >
                                삭제
                              </button>
                            </div>
                            <textarea
                              name="itemsText"
                              value={draft.itemsText}
                              placeholder={"항목 (한 줄에 하나)\n예: 식사 O\n식사 X"}
                              style={{ height: "88px", width: "100%" }}
                              onChange={(e) =>
                                setEditGroupsDraft((prev) => ({
                                  ...prev,
                                  [g.id]: { ...draft, itemsText: e.target.value },
                                }))
                              }
                            />
                          </form>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ marginTop: "18px" }}>
                <h3 style={{ margin: "0 0 10px 0", fontSize: "0.95rem" }}>참여자 옵션 배치 수정</h3>
                {editParticipants.length === 0 ? (
                  <p className="empty-state mt-0 mb-0">참여자가 없습니다.</p>
                ) : groups.length === 0 ? (
                  <p className="empty-state mt-0 mb-0">옵션 그룹이 없습니다.</p>
                ) : (
                  <form method="post" action={`/api/admin/events/${ev.id}/participants/batch-update`}>
                    <input type="hidden" name="tenantSlug" value={tenant.slug} />
                    <div className="participants-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th style={{ width: "220px" }}>참여자</th>
                            {groups.map((gg) => <th key={gg.id}>{gg.name}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {editParticipants.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <div style={{ fontWeight: 600 }}>{p.name}{p.student_no ? ` (${p.student_no})` : ""}</div>
                                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}><code>{p.username}</code></div>
                              </td>
                              {groups.map((gg) => {
                                const key = `p_${p.id}_g_${gg.id}`;
                                const selected = participantOptMap[p.id] || new Set<number>();
                                const hasAnyInGroup = gg.items.some((opt) => selected.has(opt.id));
                                return (
                                  <td key={gg.id} style={{ minWidth: "220px" }}>
                                    {gg.items.length === 0 ? (
                                      <span style={{ color: "var(--muted)" }}>—</span>
                                    ) : gg.multiple_select ? (
                                      <div className="checkbox-group">
                                        {gg.items.map((opt) => (
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
                                        {gg.items.map((opt) => (
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
          );
        })()}
      </div>

      {/* 이벤트 만들기(등록) */}
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
