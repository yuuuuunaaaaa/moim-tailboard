import { toDateInputValue } from "@/lib/dateOnly";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { pool, findTenantBySlugCached } from "@/lib/db";
import { getPageContext } from "@/lib/auth";
import { checkTenantAccess, TENANT_COOKIE_NAME } from "@/lib/tenantRestrict";
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

export default async function EventDetailPage({ params, searchParams }: Props) {
  const { tenantSlug, eventId: eventIdStr } = await params;
  const eventId = Number(eventIdStr);
  const isDevBypass =
    process.env.NODE_ENV === "development" || process.env.ALLOW_LOCAL_WITHOUT_AUTH === "1";

  const tenant = await findTenantBySlugCached(tenantSlug);
  if (!tenant) return <div style={{ padding: "48px", textAlign: "center" }}>지역을 찾을 수 없습니다.</div>;

  const { admin, username, isAdmin, canChooseTenant } = await getPageContext();
  const cookieStore = await cookies();
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [[event]] = await pool.query<any[]>(
    "SELECT * FROM event WHERE id = ? AND tenant_id = ? LIMIT 1",
    [eventId, tenant.id],
  );
  if (!event) return <div style={{ padding: "48px", textAlign: "center" }}>꼬리달기를 찾을 수 없습니다.</div>;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [optionGroupRows] = await pool.query<any[]>(
    "SELECT * FROM option_group WHERE event_id = ? ORDER BY sort_order ASC",
    [event.id],
  );
  const optionGroups = optionGroupRows as OptionGroup[];

  let optionItems: OptionItem[] = [];
  if (optionGroups.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [oiRows] = await pool.query<any[]>(
      "SELECT * FROM option_item WHERE option_group_id IN (?) ORDER BY sort_order ASC",
      [optionGroups.map((g) => g.id)],
    );
    optionItems = oiRows as OptionItem[];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [participantRows] = await pool.query<any[]>(
    "SELECT * FROM participant WHERE event_id = ? ORDER BY id ASC",
    [event.id],
  );
  const participants = participantRows as Participant[];

  let participantOptions: ParticipantOption[] = [];
  if (participants.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [poRows] = await pool.query<any[]>(
      "SELECT po.*, oi.option_group_id FROM participant_option po JOIN option_item oi ON po.option_item_id = oi.id WHERE po.participant_id IN (?)",
      [participants.map((p) => p.id)],
    );
    participantOptions = poRows as ParticipantOption[];
  }

  const eventDateStr = toDateInputValue(event.event_date);
  const sp = (await searchParams) ?? {};
  const toast = typeof sp.toast === "string" ? sp.toast : "";
  const toastText =
    toast === "joined"
      ? "참여 신청이 완료되었습니다."
      : toast === "updated"
        ? "수정이 완료되었습니다."
        : toast === "cancelled"
          ? "참여가 취소되었습니다."
          : toast === "participant_deleted"
            ? "참여 기록을 삭제했습니다."
          : "";

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
      {!username && (
        <TelegramAuth tenantSlug={tenantSlug} />
      )}
      <main className="container container--wide">
        {toastText && (
          <AutoToast message={toastText} clearHref={`/t/${tenant.slug}/events/${event.id}`} timeoutMs={2000} />
        )}
        <a href={`/t/${tenant.slug}/events`} className="back-link">
          ← 꼬리달기 목록
        </a>
        <h1>{event.title}</h1>
        <p className="page-subtitle">
          {eventDateStr} ·{" "}
          {event.description ? event.description : "꼬리달기에 참여해 주세요."}
        </p>

        <div className="layout-half">
          {/* 참여 신청 폼 */}
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

          {/* 참여자 목록 */}
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
      <style>{`
        .card__title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .card__title-row .card__title { margin-bottom: 0; }
        .p-group-block { margin-bottom: 18px; }
        .p-group-block:last-child { margin-bottom: 0; }
        .p-group-label {
          font-size: 0.8125rem; font-weight: 700; color: var(--primary);
          text-transform: uppercase; letter-spacing: .04em;
          padding: 4px 0 6px; border-bottom: 2px solid var(--primary-light); margin-bottom: 8px;
        }
        .p-opt-row {
          display: flex; align-items: baseline; gap: 8px;
          padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 0.875rem;
        }
        .p-opt-row:last-child { border-bottom: none; }
        .p-opt-item-name { font-weight: 600; white-space: nowrap; min-width: 64px; }
        .p-opt-count { font-size: 0.75rem; color: var(--muted); font-weight: 400; }
        .p-opt-names { color: var(--text); line-height: 1.6; flex: 1; }
        .p-opt-row--none .p-opt-item-name { color: var(--muted); font-weight: 500; }
        .p-opt-row--none .p-opt-names { color: var(--muted); }
      `}</style>
    </>
  );
}
