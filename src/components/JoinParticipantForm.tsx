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
        <input id="name" name="name" required placeholder="이름을 입력하세요" />
      </div>

      <div className="form-group">
        <label htmlFor="studentNo">
          학번 <span className="optional">(동명이인일 때만)</span>
        </label>
        <input id="studentNo" name="studentNo" placeholder="선택 입력" />
      </div>

      <div className="form-group">
        <label htmlFor="username">사용자명</label>
        {username ? (
          <>
            <input
              id="username"
              type="text"
              readOnly
              className="input-readonly"
              value={username}
            />
            <p className="form-hint">로그인한 계정으로 참여됩니다.</p>
          </>
        ) : isDevBypass ? (
          <>
            <input
              id="username"
              name="username"
              required
              placeholder="개발 모드: 사용자명을 입력하세요 (예: yourname)"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <p className="form-hint">개발 모드에서는 텔레그램 로그인 없이 테스트할 수 있습니다.</p>
          </>
        ) : (
          <p className="form-hint form-hint--warning">
            로그인이 필요합니다. <a href={`/login?tenant=${encodeURIComponent(tenantSlug)}`}>로그인</a>하거나
            텔레그램에서 열어 주세요.
          </p>
        )}
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

