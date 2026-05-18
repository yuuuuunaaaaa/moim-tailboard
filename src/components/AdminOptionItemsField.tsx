"use client";

import { useState } from "react";

export type OptionItemRow = { key: string; id?: number; name: string };

function newRowKey(): string {
  return `new-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function rowsFromItems(items: { id?: number; name: string }[]): OptionItemRow[] {
  if (items.length === 0) return [{ key: newRowKey(), name: "" }];
  return items.map((it) => ({
    key: it.id != null ? `id-${it.id}` : newRowKey(),
    id: it.id,
    name: it.name,
  }));
}

type FormProps = {
  mode?: "form";
  initialItems?: { id: number; name: string }[];
  idFieldName?: string;
  nameFieldName?: string;
};

type ControlledProps = {
  mode: "controlled";
  items: OptionItemRow[];
  onChange: (items: OptionItemRow[]) => void;
};

type Props = FormProps | ControlledProps;

function isControlled(props: Props): props is ControlledProps {
  return props.mode === "controlled";
}

export default function AdminOptionItemsField(props: Props) {
  const isCtrl = isControlled(props);
  const [internalRows, setInternalRows] = useState<OptionItemRow[]>(() =>
    isCtrl ? [] : rowsFromItems(props.initialItems ?? []),
  );

  const rows = isCtrl ? props.items : internalRows;
  const setRows = isCtrl ? props.onChange : setInternalRows;

  const idField = !isCtrl ? (props.idFieldName ?? "itemId") : "";
  const nameField = !isCtrl ? (props.nameFieldName ?? "itemName") : "";

  function addRow() {
    setRows([...rows, { key: newRowKey(), name: "" }]);
  }

  function removeRow(key: string) {
    if (rows.length <= 1) {
      setRows([{ key: rows[0]!.key, id: rows[0]!.id, name: "" }]);
      return;
    }
    setRows(rows.filter((r) => r.key !== key));
  }

  function updateName(key: string, name: string) {
    setRows(rows.map((r) => (r.key === key ? { ...r, name } : r)));
  }

  return (
    <div className="admin-option-items">
      <ul className="admin-option-items__list">
        {rows.map((row) => (
          <li key={row.key} className="admin-option-items__row">
            {!isCtrl && <input type="hidden" name={idField} value={row.id ?? ""} />}
            <input
              type="text"
              {...(!isCtrl ? { name: nameField } : {})}
              className="admin-option-items__input"
              value={row.name}
              onChange={(e) => updateName(row.key, e.target.value)}
              placeholder="옵션 이름"
              autoComplete="off"
            />
            <button
              type="button"
              className="icon-btn admin-option-items__remove"
              onClick={() => removeRow(row.key)}
              aria-label="옵션 삭제"
              title="삭제"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn--secondary btn--sm admin-option-items__add"
        onClick={addRow}
      >
        + 옵션 추가
      </button>
    </div>
  );
}
