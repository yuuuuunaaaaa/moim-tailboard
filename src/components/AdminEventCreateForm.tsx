"use client";

import { useRef, useState } from "react";
import type { Tenant } from "@/types";

interface NewOptionGroup {
  id: number;
  name: string;
  multipleSelect: boolean;
  optionText: string;
}

interface Props {
  tenant: Tenant;
  tenants: Tenant[];
  username: string | null | undefined;
}

export default function AdminEventCreateForm({ tenant, tenants, username }: Props) {
  const [createGroups, setCreateGroups] = useState<NewOptionGroup[]>([]);
  const createGroupIdx = useRef(0);

  function addCreateGroup() {
    const id = createGroupIdx.current++;
    setCreateGroups((prev) => [...prev, { id, name: "", multipleSelect: false, optionText: "" }]);
  }

  function removeCreateGroup(id: number) {
    setCreateGroups((prev) => prev.filter((g) => g.id !== id));
  }

  return (
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
              window.location.href = `/admin/events/new?tenant=${encodeURIComponent(e.target.value)}`;
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
            <textarea name="description" placeholder="꼬리달기 설명" />
          </div>
          <div className="form-group">
            <label>날짜</label>
            <input name="eventDate" type="date" required />
          </div>
          <div className="form-group">
            <label>
              <input type="checkbox" name="isActive" value="true" defaultChecked />
              공개 (목록에 표시)
            </label>
          </div>

          <details className="form-group" style={{ marginTop: "12px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.9rem" }}>
              텔레그램 알림 메세지
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
                placeholder="기본: 새 꼬리달기가 생성되었습니다!"
              />
            </div>
            <div className="form-group">
              <label>추가 문구</label>
              <textarea
                name="telegramNotifyExtra"
                maxLength={500}
                placeholder="꼬리달기명·링크 위·아래에 붙는 안내 (줄바꿈 가능)"
                style={{ minHeight: "72px" }}
              />
            </div>
          </details>

          <details className="form-group" style={{ marginTop: "12px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: "0.9rem" }}>
              참가/취소 방 알림 말머리 (이 꼬리달기에 저장)
            </summary>
            <p className="form-hint" style={{ marginTop: "8px", marginBottom: "10px" }}>
              신청(+1)·취소(-1) 텔레그램 알림 앞 이모지/문구입니다. 비우면 👤. 꼬리달기마다 다르게 둘 수 있습니다.
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
        <button className="btn btn--primary" type="submit">꼬리달기 만들기</button>
      </div>
    </form>
  );
}

