const express = require("express");
const { pool, getTenantOr404 } = require("../db/mysql");
const { ensureTenantAllowed } = require("../middleware/tenantRestrict");

const router = express.Router();

// 테넌트만 포함한 짧은 링크 → 이벤트 목록으로 리다이렉트 (봇 링크에 테넌트만 넣을 때 편함)
router.get("/t/:tenantSlug", async (req, res) => {
  const { tenantSlug } = req.params;
  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;
  if (!ensureTenantAllowed(req, res, tenant)) return;
  res.redirect(302, `/t/${tenantSlug}/events`);
});

// Event list
router.get("/t/:tenantSlug/events", async (req, res) => {
  const { tenantSlug } = req.params;
  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;
  if (!ensureTenantAllowed(req, res, tenant)) return;

  const [events] = await pool.query(
    "SELECT * FROM event WHERE tenant_id = ? AND is_active = 1 ORDER BY event_date ASC",
    [tenant.id],
  );

  const eventsForView = events.map((e) => ({
    ...e,
    eventDate: e.event_date,
  }));

  res.render("event-list", { tenant, events: eventsForView });
});

// Event detail + join form
router.get("/t/:tenantSlug/events/:eventId", async (req, res) => {
  const { tenantSlug, eventId } = req.params;
  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;
  if (!ensureTenantAllowed(req, res, tenant)) return;

  const [[event]] = await pool.query(
    "SELECT * FROM event WHERE id = ? AND tenant_id = ? LIMIT 1",
    [Number(eventId), tenant.id],
  );

  if (!event) {
    return res.status(404).send("Event not found");
  }

  const [optionGroups] = await pool.query(
    "SELECT * FROM option_group WHERE event_id = ? ORDER BY sort_order ASC",
    [event.id],
  );

  const [optionItems] = await pool.query(
    "SELECT * FROM option_item WHERE option_group_id IN (?) ORDER BY sort_order ASC",
    [optionGroups.length ? optionGroups.map((g) => g.id) : [0]],
  );

  const groupIdToOptions = optionGroups.reduce((acc, g) => {
    acc[g.id] = [];
    return acc;
  }, {});
  optionItems.forEach((opt) => {
    if (groupIdToOptions[opt.option_group_id]) {
      groupIdToOptions[opt.option_group_id].push({
        id: opt.id,
        name: opt.name,
        limitEnabled: !!opt.limit_enabled,
        limitCount: opt.limit_count,
        sortOrder: opt.sort_order,
        optionGroupId: opt.option_group_id,
      });
    }
  });

  const [participants] = await pool.query(
    "SELECT * FROM participant WHERE event_id = ? ORDER BY id ASC",
    [event.id],
  );

  const [participantOptions] = await pool.query(
    "SELECT po.*, oi.option_group_id FROM participant_option po JOIN option_item oi ON po.option_item_id = oi.id WHERE po.participant_id IN (?)",
    [participants.length ? participants.map((p) => p.id) : [0]],
  );

  const participantIdToOptions = participants.reduce((acc, p) => {
    acc[p.id] = [];
    return acc;
  }, {});
  participantOptions.forEach((po) => {
    if (participantIdToOptions[po.participant_id]) {
      participantIdToOptions[po.participant_id].push({
        id: po.id,
        optionItemId: po.option_item_id,
        optionItem: {
          id: po.option_item_id,
          optionGroupId: po.option_group_id,
          name: optionItems.find((oi) => oi.id === po.option_item_id)?.name || "",
        },
      });
    }
  });

  const eventWithRelations = {
    ...event,
    eventDate: event.event_date,
    optionGroups: optionGroups.map((g) => ({
      id: g.id,
      name: g.name,
      multipleSelect: !!g.multiple_select,
      sortOrder: g.sort_order,
      options: groupIdToOptions[g.id] || [],
    })),
    participants: participants.map((p) => ({
      ...p,
      studentNo: p.student_no,
      options: participantIdToOptions[p.id] || [],
    })),
  };

  const loggedInUsername =
    (req.auth && req.auth.username) || (req.cookies && req.cookies.username) || "";
  res.render("event-detail", {
    tenant,
    event: eventWithRelations,
    username: loggedInUsername ? String(loggedInUsername).trim() : "",
  });
});

module.exports = router;
