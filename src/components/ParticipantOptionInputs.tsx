"use client";

import type { OptionGroupWithItems } from "@/lib/participantOptionGroups";

type Props = {
  groups: OptionGroupWithItems[];
  selectedOptionItemIds: number[];
  disabled?: boolean;
  /** 관리자 카드 UI vs 참여 목록 인라인 */
  variant?: "admin" | "inline";
};

/** 관리자 참여자 수정·참여자 본인 수정 공용 옵션 입력 (`g_{groupId}` 필드명) */
export default function ParticipantOptionInputs({
  groups,
  selectedOptionItemIds,
  disabled = false,
  variant = "admin",
}: Props) {
  const selected = new Set(selectedOptionItemIds);

  if (groups.length === 0) return null;

  if (variant === "inline") {
    return (
      <div className="p-edit-option-groups">
        {groups.map((g) => {
          const key = `g_${g.id}`;
          const hasAnyInGroup = g.items.some((opt) => selected.has(opt.id));
          return (
            <fieldset key={g.id} className="option-group p-edit-option-group" disabled={disabled}>
              <legend className="option-group__name">{g.name}</legend>
              {g.items.length === 0 ? (
                <span className="form-hint">옵션 없음</span>
              ) : g.multiple_select ? (
                <div className="checkbox-group">
                  {g.items.map((opt) => (
                    <label key={opt.id}>
                      <input
                        type="checkbox"
                        name={key}
                        value={opt.id}
                        defaultChecked={selected.has(opt.id)}
                        disabled={disabled}
                      />
                      {opt.name}
                    </label>
                  ))}
                </div>
              ) : (
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      name={key}
                      value=""
                      defaultChecked={!hasAnyInGroup}
                      disabled={disabled}
                    />
                    미선택
                  </label>
                  {g.items.map((opt) => (
                    <label key={opt.id}>
                      <input
                        type="radio"
                        name={key}
                        value={opt.id}
                        defaultChecked={selected.has(opt.id)}
                        disabled={disabled}
                      />
                      {opt.name}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          );
        })}
      </div>
    );
  }

  return (
    <div className="admin-participant-card__groups">
      {groups.map((g) => {
        const key = `g_${g.id}`;
        const hasAnyInGroup = g.items.some((opt) => selected.has(opt.id));
        return (
          <fieldset key={g.id} className="admin-option-group" disabled={disabled}>
            <legend className="admin-option-group__title">
              {g.name}
              <span className="admin-option-group__meta">
                {g.multiple_select ? "복수 선택" : "하나만 선택"}
              </span>
            </legend>
            {g.items.length === 0 ? (
              <span className="admin-option-group__empty">옵션 없음</span>
            ) : g.multiple_select ? (
              <div className="admin-option-group__choices">
                {g.items.map((opt) => (
                  <label key={opt.id} className="admin-option-choice">
                    <input
                      type="checkbox"
                      name={key}
                      value={opt.id}
                      defaultChecked={selected.has(opt.id)}
                      disabled={disabled}
                    />
                    <span>{opt.name}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="admin-option-group__choices">
                <label className="admin-option-choice admin-option-choice--muted">
                  <input
                    type="radio"
                    name={key}
                    value=""
                    defaultChecked={!hasAnyInGroup}
                    disabled={disabled}
                  />
                  <span>미선택</span>
                </label>
                {g.items.map((opt) => (
                  <label key={opt.id} className="admin-option-choice">
                    <input
                      type="radio"
                      name={key}
                      value={opt.id}
                      defaultChecked={selected.has(opt.id)}
                      disabled={disabled}
                    />
                    <span>{opt.name}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
