import type { OptionGroup, OptionItem } from "@/types";

export type OptionGroupWithItems = OptionGroup & { items: OptionItem[] };

export function buildOptionGroupsWithItems(
  optionGroups: OptionGroup[],
  optionItems: OptionItem[],
): OptionGroupWithItems[] {
  const itemsByGroup = new Map<number, OptionItem[]>();
  for (const g of optionGroups) itemsByGroup.set(g.id, []);
  for (const oi of optionItems) {
    const arr = itemsByGroup.get(oi.option_group_id);
    if (arr) arr.push(oi);
  }
  return optionGroups.map((g) => ({ ...g, items: itemsByGroup.get(g.id) ?? [] }));
}
