"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Event, Tenant } from "@/types";
import AdminBroadcastForm from "@/components/AdminBroadcastForm";
import { EventRow } from "@/components/AdminEventRow";

interface Props {
  tenant: Tenant;
  events: Event[];
}

function sortByEventOrder(a: Event, b: Event): number {
  return a.event_order - b.event_order || a.id - b.id;
}

function splitByActive(events: Event[]) {
  const active = events.filter((e) => e.is_active).sort(sortByEventOrder);
  const inactive = events.filter((e) => !e.is_active).sort(sortByEventOrder);
  return { active, inactive };
}

interface DragSnapshot {
  /** 들고 있는 이벤트 id */
  draggingId: number;
  /** floating clone 의 viewport 기준 left/top */
  floatX: number;
  floatY: number;
  /** 들고 있는 li 의 폭/높이 (클론 사이즈로 사용) */
  width: number;
  height: number;
  /** 손가락 위치 - clone (left, top) 의 차이. 손가락 좌표만 알면 클론 위치를 계산 가능 */
  offsetX: number;
  offsetY: number;
}

/**
 * 관리자 페이지의 꼬리달기 목록.
 *
 * 드래그앤드롭 구현 메모:
 * - 들고 있는 행은 `position: fixed` 의 *클론*(고스트)으로 띄우고, 원본 li 는 자리만 차지하게
 *   `visibility: hidden` 으로 둔다. 이 분리 덕에 swap 후 새 위치로 옮겨가도 클론은 손가락만
 *   따라가서 점프 없이 자연스럽다.
 * - pointermove/up 은 핸들 버튼이 아닌 *window* 에 등록한다. 핸들 DOM 이 React 재배치/언마운트
 *   되더라도 이벤트가 끊기지 않아 저장 호출이 안정적이다.
 * - 드래그 중 페이지 스크롤은 잠근다(모바일 터치 대응).
 * - 드롭 시 한 번만 PUSH 로 새 순서를 저장하고, 실패하면 시작 시점 배열로 롤백한다.
 */
export default function AdminEventEdit({ tenant, events }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<Event[]>(events);
  const [showAll, setShowAll] = useState(false);
  const [drag, setDrag] = useState<DragSnapshot | null>(null);
  // 순서 저장/실패 등 짧은 알림. AutoToast 와 동일한 디자인을 그대로 사용한다.
  const [toast, setToast] = useState<{ text: string; kind: "ok" | "error" } | null>(null);

  const listRef = useRef<HTMLUListElement | null>(null);
  const itemsRef = useRef<Event[]>(events);
  const initialItemsRef = useRef<Event[]>(events);
  const dragRef = useRef<DragSnapshot | null>(null);

  // toast 자동 닫기 (2초)
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  // 서버에서 events 가 새로 내려오면 동기화 (예: 추가/삭제 후 router.refresh)
  useEffect(() => {
    setItems(events);
    itemsRef.current = events;
  }, [events]);

  // 드래그 중 페이지 스크롤 + 텍스트 선택 잠금
  useEffect(() => {
    if (!drag) return;
    const prevOverflow = document.body.style.overflow;
    const prevSelect = document.body.style.userSelect;
    document.body.style.overflow = "hidden";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.userSelect = prevSelect;
    };
  }, [drag]);

  const persistOrder = useCallback(
    async (orderedIds: number[], rollbackTo: Event[]) => {
      try {
        const res = await fetch("/api/admin/events/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tenantSlug: tenant.slug, orderedIds }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setToast({ text: "순서를 저장했습니다.", kind: "ok" });
        router.refresh();
      } catch (err) {
        console.error("reorder save failed:", err);
        setToast({
          text: "순서 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
          kind: "error",
        });
        setItems(rollbackTo);
        itemsRef.current = rollbackTo;
      }
    },
    [tenant.slug, router],
  );

  const { active: activeItems, inactive: inactiveItems } = splitByActive(items);
  const canReorder = !showAll;
  const dragActive = drag !== null && canReorder;

  // 드래그가 시작되었을 때만 window listener 등록 (한 번 등록되면 드롭까지 유지)
  useEffect(() => {
    if (!dragActive) return;

    const measureLis = () => {
      const list = listRef.current;
      const map = new Map<number, DOMRect>();
      if (!list) return map;
      for (const li of Array.from(
        list.querySelectorAll<HTMLLIElement>("li[data-event-id]"),
      )) {
        const id = Number(li.dataset.eventId);
        if (Number.isFinite(id)) map.set(id, li.getBoundingClientRect());
      }
      return map;
    };

    const onMove = (e: PointerEvent) => {
      const cur = dragRef.current;
      if (!cur) return;
      // 모바일에서 페이지 스크롤이 끼어드는 것을 차단
      if (e.cancelable) e.preventDefault();

      // 순서 변경 드래그는 가로 이동이 의미가 없고, 가로 이동을 허용하면
      // 모바일에서 클론이 viewport 밖으로 나가 가로 스크롤이 생긴다.
      // X 는 시작 시점 그대로 두고 Y 만 갱신한다.
      const newFloatY = e.clientY - cur.offsetY;

      setDrag((prev) =>
        prev ? { ...prev, floatY: newFloatY } : prev,
      );

      // swap 판단: 클론 중심 Y 가 어떤 li 의 중심을 넘었는지
      const centerY = newFloatY + cur.height / 2;
      const rects = measureLis();
      const dragId = cur.draggingId;

      setItems((prevItems) => {
        const { active, inactive } = splitByActive(prevItems);
        const fromIdx = active.findIndex((it) => it.id === dragId);
        if (fromIdx === -1) return prevItems;

        let toIdx = fromIdx;
        for (let i = 0; i < fromIdx; i++) {
          const r = rects.get(active[i].id);
          if (!r) continue;
          if (centerY < r.top + r.height / 2) {
            toIdx = i;
            break;
          }
        }
        if (toIdx === fromIdx) {
          for (let i = fromIdx + 1; i < active.length; i++) {
            const r = rects.get(active[i].id);
            if (!r) continue;
            if (centerY > r.top + r.height / 2) {
              toIdx = i;
            }
          }
        }

        if (toIdx === fromIdx) return prevItems;

        const nextActive = active.slice();
        const [moved] = nextActive.splice(fromIdx, 1);
        nextActive.splice(toIdx, 0, moved);
        const next = [...nextActive, ...inactive];
        itemsRef.current = next;
        return next;
      });
    };

    const onUp = () => {
      const finalItems = itemsRef.current;
      const initialItems = initialItemsRef.current;
      const orderedIds = finalItems.map((it) => it.id);
      const initialKey = initialItems.map((it) => it.id).join(",");

      setDrag(null);
      dragRef.current = null;

      if (initialKey !== orderedIds.join(",")) {
        void persistOrder(orderedIds, initialItems);
      }
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragActive, persistOrder]);

  const handlePointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    eventId: number,
  ) => {
    if (!canReorder) return;
    if (e.button !== undefined && e.button !== 0) return; // 좌클릭/터치만
    e.preventDefault();
    const li = (e.currentTarget as HTMLElement).closest(
      "li[data-event-id]",
    ) as HTMLLIElement | null;
    if (!li) return;
    const rect = li.getBoundingClientRect();
    initialItemsRef.current = itemsRef.current.slice();
    const snapshot: DragSnapshot = {
      draggingId: eventId,
      floatX: rect.left,
      floatY: rect.top,
      width: rect.width,
      height: rect.height,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    dragRef.current = snapshot;
    setDrag(snapshot);
  };

  const draggingEvent = drag ? items.find((it) => it.id === drag.draggingId) ?? null : null;

  const renderEventList = (list: Event[]) => (
    <ul className="event-admin-list" ref={canReorder && list === activeItems ? listRef : undefined}>
      {list.map((ev) => {
        const isDragging = drag?.draggingId === ev.id;
        const liStyle: React.CSSProperties = {
          visibility: isDragging ? "hidden" : "visible",
          transition: drag ? "transform 150ms ease" : undefined,
        };
        return (
          <li key={ev.id} data-event-id={ev.id} style={liStyle}>
            <EventRow
              event={ev}
              tenantSlug={tenant.slug}
              onPointerDown={(e) => handlePointerDown(e, ev.id)}
              isDragHandleActive={isDragging}
              reorderEnabled={canReorder}
            />
          </li>
        );
      })}
    </ul>
  );

  const hasInactive = inactiveItems.length > 0;
  const listEmpty = showAll ? items.length === 0 : activeItems.length === 0;

  return (
    <div className="admin-grid">
      {/* 꼬리달기 목록 */}
      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
          }}
        >
          <h2 className="card__title" style={{ marginBottom: 0 }}>
            꼬리달기 목록
          </h2>
          <div className="admin-event-list-actions">
            {hasInactive && (
              <button
                type="button"
                className="btn btn--secondary btn--sm"
                onClick={() => {
                  setShowAll((v) => !v);
                  setDrag(null);
                  dragRef.current = null;
                }}
              >
                {showAll ? "공개만 보기" : "전체보기"}
              </button>
            )}
            <a
              className="btn btn--primary btn--sm"
              href={`/admin/events/new?tenant=${encodeURIComponent(tenant.slug)}`}
            >
              + 등록
            </a>
          </div>
        </div>

        {listEmpty ? (
          <p className="empty-state mt-0 mb-0">
            {items.length === 0
              ? "아직 꼬리달기가 없습니다. 위에서 만들어 주세요."
              : "공개된 꼬리달기가 없습니다. 전체보기에서 비공개 항목을 확인할 수 있습니다."}
          </p>
        ) : showAll ? (
          <div className="admin-event-list-sections">
            {activeItems.length > 0 && (
              <section className="admin-event-list-section">
                <h3 className="admin-event-list-section__title">공개</h3>
                {renderEventList(activeItems)}
              </section>
            )}
            {inactiveItems.length > 0 && (
              <section className="admin-event-list-section">
                <h3 className="admin-event-list-section__title">비공개</h3>
                {renderEventList(inactiveItems)}
              </section>
            )}
          </div>
        ) : (
          renderEventList(activeItems)
        )}

        {/* Floating clone — 드래그 중인 행의 화면용 사본. 세로(Y)만 손가락을 따라간다. */}
        {drag && draggingEvent && (
          <div
            aria-hidden
            style={{
              position: "fixed",
              left: drag.floatX,
              top: drag.floatY,
              width: drag.width,
              // 모바일에서 클론이 viewport 가로폭을 벗어나 스크롤이 생기지 않도록 안전 cap
              maxWidth: "calc(100vw - 8px)",
              pointerEvents: "none",
              zIndex: 1000,
              background: "var(--surface, #fff)",
              boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
              borderRadius: "12px",
              opacity: 0.96,
              boxSizing: "border-box",
            }}
          >
            <EventRow
              event={draggingEvent}
              tenantSlug={tenant.slug}
              onPointerDown={() => {}}
              isDragHandleActive
              isClone
            />
          </div>
        )}
      </div>

      <AdminBroadcastForm tenant={tenant} />

      {/*
       * 클라이언트 측 토스트 (드래그 저장 결과 등).
       * AutoToast 는 URL 파라미터를 비우는 동작까지 가져 가는데, 여기서는 단순 상태 토스트라
       * 동일한 CSS 클래스만 빌려 더 가볍게 그린다.
       */}
      {toast && (
        <div
          className="toast-overlay"
          role={toast.kind === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          <div className="toast-banner">
            <span className="toast-message">{toast.text}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => setToast(null)}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

