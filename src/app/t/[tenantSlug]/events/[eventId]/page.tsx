import { toDateInputValue } from "@/lib/dateOnly";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findTenantBySlugCached } from "@/lib/db";
import { queryFirst, queryRows } from "@/lib/queryRows";
import { getPageContext } from "@/lib/auth";
import { checkTenantAccess, TENANT_COOKIE_NAME } from "@/lib/tenantRestrict";
import { isDevBypassEnabled } from "@/lib/dev";
import Header from "@/components/Header";
import TenantSlugPersist from "@/components/TenantSlugPersist";
import TelegramAuth from "@/components/TelegramAuthNoSsr";
import ParticipantList from "@/components/ParticipantList";
import JoinParticipantForm from "@/components/JoinParticipantForm";
import AutoToast from "@/components/AutoToast";
import type { Event, OptionGroup, OptionItem, Participant, ParticipantOption } from "@/types";

interface Props {
  params: Promise<{ tenantSlug: string; eventId: string }>;
  searchParams?: Promise<{ toast?: string }>;
}

const TOAST_TEXT: Record<string, string> = {
  joined: "참여 신청이 완료되었습니다.",
  updated: "수정이 완료되었습니다.",
  cancelled: "참여가 취소되었습니다.",
  participant_deleted: "참여 기록을 삭제했습니다.",
};

export default async function EventDetailPage({ params, searchParams }: Props) {
  const [{ tenantSlug, eventId: eventIdStr }, sp] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as { toast?: string }),
  ]);
  const eventId = Number(eventIdStr);
  const isDevBypass = isDevBypassEnabled();

  // 테넌트·페이지 컨텍스트·쿠키는 서로 독립적이라 동시에 준비
  const [tenant, ctx, cookieStore] = await Promise.all([
    findTenantBySlugCached(tenantSlug),
    getPageContext(),
    cookies(),
  ]);
  if (!tenant) {
    return <div style={{ padding: "48px", textAlign: "center" }}>지역을 찾을 수 없습니다.</div>;
  }

  const { admin, username, isAdmin, canChooseTenant } = ctx;
  const allowedSlug = cookieStore.get(TENANT_COOKIE_NAME)?.value;
  const access = checkTenantAccess(admin, tenant, allowedSlug);

  if (access === "forbidden") {
    return (
      <div style={{ padding: "48px", textAlign: "center" }}>
        <h2>접근이 거부되었습니다.</h2>
      </div>
    );
  }

  if (access === "init") {
    const next = encodeURIComponent(`/t/${tenantSlug}/events/${eventId}`);
    redirect(`/api/init-tenant?slug=${encodeURIComponent(tenantSlug)}&next=${next}`);
  }

  const event = await queryFirst<Event>(
    "SELECT * FROM event WHERE id = ? AND tenant_id = ? LIMIT 1",
    [eventId, tenant.id],
  );
  if (!event) {
    return <div style={{ padding: "48px", textAlign: "center" }}>꼬리달기를 찾을 수 없습니다.</div>;
  }

  // 이벤트가 확정되면 옵션 그룹/참여자는 서로 독립 → 병렬
  const [optionGroups, participants] = await Promise.all([
    queryRows<OptionGroup>(
      "SELECT * FROM option_group WHERE event_id = ? ORDER BY sort_order ASC",
      [event.id],
    ),
    queryRows<Participant>(
      // 신청자 전체보기: 신청 일시(created_at) 내림차순
      "SELECT * FROM participant WHERE event_id = ? ORDER BY created_at DESC, id DESC",
      [event.id],
    ),
  ]);

  // 그룹·참여자 결과에 의존하는 항목 로드도 병렬
  const [optionItems, participantOptions] = await Promise.all([
    optionGroups.length === 0
      ? Promise.resolve<OptionItem[]>([])
      : queryRows<OptionItem>(
          "SELECT * FROM option_item WHERE option_group_id IN (?) ORDER BY sort_order ASC",
          [optionGroups.map((g) => g.id)],
        ),
    participants.length === 0
      ? Promise.resolve<ParticipantOption[]>([])
      : queryRows<ParticipantOption>(
          "SELECT po.*, oi.option_group_id FROM participant_option po JOIN option_item oi ON po.option_item_id = oi.id WHERE po.participant_id IN (?)",
          [participants.map((p) => p.id)],
        ),
  ]);

  const eventDateStr = toDateInputValue(event.event_date);
  const toastText = typeof sp?.toast === "string" ? TOAST_TEXT[sp.toast] ?? "" : "";

  return (
    <>
      <TenantSlugPersist slug={tenant.slug} />
      <Header
        username={username}
        isAdmin={isAdmin}
        canChooseTenant={canChooseTenant}
        tenantSlug={tenantSlug}
        showEventListLink
      />
      {!username && <TelegramAuth tenantSlug={tenantSlug} />}
      <main className="container container--wide">
        {toastText && (
          <AutoToast message={toastText} clearHref={`/t/${tenant.slug}/events/${event.id}`} timeoutMs={2000} />
        )}
        <a href={`/t/${tenant.slug}/events`} className="back-link">
          ← 꼬리달기 목록
        </a>
        <h1>{event.title}</h1>
        <p className="page-subtitle">
          {eventDateStr} · {event.description ? event.description : "꼬리달기에 참여해 주세요."}
        </p>

        <div className="layout-half">
          <div className="card">
            <h2 className="card__title">참여 신청</h2>
            <JoinParticipantForm
              tenantSlug={tenant.slug}
              eventId={event.id}
              username={username}
              isDevBypass={isDevBypass}
              optionGroups={optionGroups}
              optionItems={optionItems}
            />
          </div>

          <ParticipantList
            participants={participants}
            optionGroups={optionGroups}
            optionItems={optionItems}
            participantOptions={participantOptions}
            username={username}
            tenantSlug={tenant.slug}
            eventId={event.id}
            isAdmin={isAdmin}
          />
        </div>
      </main>
    </>
  );
}
