"use client";

import { useMemo, useState } from "react";
import type { OptionGroup, OptionItem } from "@/types";
import Spinner from "@/components/Spinner";

type Props = {
  tenantSlug: string;
  eventId: number;
  username: string | null | undefined;
  isDevBypass: boolean;
  optionGroups: OptionGroup[];
  optionItems: OptionItem[];
};

export default function JoinParticipantForm({
  tenantSlug,
  eventId,
  username,
  isDevBypass,
  optionGroups,
  optionItems,
}: Props) {
  const [submitting, setSubmitting] = useState(false);

  const groupedItems = useMemo(() => {
    const map = new Map<number, OptionItem[]>();
    for (const g of optionGroups) map.set(g.id, []);
    for (const oi of optionItems) {
      const arr = map.get(oi.option_group_id);
      if (arr) arr.push(oi);
    }
    return map;
  }, [optionGroups, optionItems]);

  const disabled = submitting || (!username && !isDevBypass);

  return (
    <form
      method="post"
      action="/api/participants"
      onSubmit={() => {
        if (submitting) return;
        setSubmitting(true);
      }}
    >
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="eventId" value={eventId} />

      <div className="form-group">
        <label htmlFor="name">이름</label>
        <input id="name" name="name" type="text" required placeholder="이름을 입력하세요" />
      </div>

      <div className="form-group">
        <label htmlFor="studentNo">
          학번 <span className="optional">(동명이인 있을 경우 입력)</span>
        </label>
        <input id="studentNo" name="studentNo" type="text" placeholder="선택 입력" />
      </div>

      {optionGroups.map((group) => {
        const groupOptions = groupedItems.get(group.id) || [];
        return (
          <div key={group.id} className="form-group option-group">
            <div className="option-group__name">{group.name}</div>
            {group.multiple_select ? (
              <div className="checkbox-group">
                {groupOptions.map((opt) => (
                  <label key={opt.id}>
                    <input type="checkbox" name="optionItemIds" value={opt.id} />
                    {opt.name}
                    {opt.limit_enabled && opt.limit_count ? ` (정원 ${opt.limit_count}명)` : ""}
                  </label>
                ))}
              </div>
            ) : (
              <div className="radio-group">
                {groupOptions.map((opt) => (
                  <label key={opt.id}>
                    <input type="radio" name="optionItemIds" value={opt.id} />
                    {opt.name}
                    {opt.limit_enabled && opt.limit_count ? ` (정원 ${opt.limit_count}명)` : ""}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <button
        className="btn btn--primary"
        type="submit"
        disabled={disabled}
        aria-disabled={disabled}
        title={!username && !isDevBypass ? "텔레그램에서 열어 로그인해 주세요" : undefined}
      >
        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {submitting && <Spinner size={16} color="#fff" label="제출 중" />}
          {submitting ? "처리 중..." : "참여하기"}
        </span>
      </button>
    </form>
  );
}

