"use client";

import { useState } from "react";
import AdminOptionItemsField, { rowsFromItems, type OptionItemRow } from "@/components/AdminOptionItemsField";

interface Props {
  tenantSlug: string;
  eventId: number;
}

export default function AdminAddOptionGroupForm({ tenantSlug, eventId }: Props) {
  const [items, setItems] = useState<OptionItemRow[]>(() => rowsFromItems([]));
  const optionNamesJson = JSON.stringify(
    items.map((r) => r.name.trim()).filter(Boolean),
  );

  return (
    <form method="post" action="/api/admin/options">
      <input type="hidden" name="tenantSlug" value={tenantSlug} />
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="optionNames" value={optionNamesJson} />
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
          <button className="btn btn--secondary option-group-edit-btn" type="submit">
            그룹 추가
          </button>
        </div>
      </div>
      <AdminOptionItemsField mode="controlled" items={items} onChange={setItems} />
    </form>
  );
}
