const express = require("express");
const { pool, getTenantOr404 } = require("../db/mysql");
const { sendMessage, eventDetailUrl, escapeHtml } = require("../lib/telegram");

const router = express.Router();

/** superadmin이면 모든 테넌트 접근 가능, 아니면 소속 테넌트만 */
function canAccessTenant(req, tenant) {
  return req.admin.is_superadmin || req.admin.tenant_id === tenant.id;
}

router.get("/admin", async (req, res) => {
  if (!req.admin) {
    return res.status(403).send("관리자만 접근할 수 있습니다.");
  }
  let tenant, tenants;
  if (req.admin.is_superadmin) {
    [tenants] = await pool.query("SELECT id, slug, name FROM tenant ORDER BY name ASC");
    const slug = req.query.tenant;
    tenant = slug ? tenants.find((t) => t.slug === slug) || tenants[0] : tenants[0];
    if (!tenant) return res.status(404).send("등록된 공동체가 없습니다.");
  } else {
    const [[row]] = await pool.query(
      "SELECT id, slug, name FROM tenant WHERE id = ? LIMIT 1",
      [req.admin.tenant_id],
    );
    if (!row) return res.status(404).send("소속 공동체를 찾을 수 없습니다.");
    tenant = row;
    tenants = [row];
  }
  const [events] = await pool.query(
    "SELECT id, title, event_date, is_active FROM event WHERE tenant_id = ? ORDER BY event_date DESC",
    [tenant.id],
  );
  const eventIds = events.map((e) => e.id);
  let optionGroups = [], optionItems = [];
  if (eventIds.length > 0) {
    [optionGroups] = await pool.query(
      "SELECT * FROM option_group WHERE event_id IN (?) ORDER BY event_id, sort_order",
      [eventIds],
    );
    const groupIds = optionGroups.map((g) => g.id);
    if (groupIds.length > 0) {
      [optionItems] = await pool.query(
        "SELECT * FROM option_item WHERE option_group_id IN (?) ORDER BY option_group_id, sort_order",
        [groupIds],
      );
    }
  }
  const groupsByEvent = {};
  optionGroups.forEach((g) => {
    if (!groupsByEvent[g.event_id]) groupsByEvent[g.event_id] = [];
    groupsByEvent[g.event_id].push({
      ...g,
      items: optionItems.filter((i) => i.option_group_id === g.id),
    });
  });
  res.render("admin", { tenant, tenants, events, groupsByEvent });
});

// 테넌트별 관리자 관리 페이지 (소속 공동체만 접근, superadmin은 전체)
router.get("/admin/tenants/:tenantSlug", async (req, res) => {
  if (!req.admin) {
    return res.status(403).send("관리자만 접근할 수 있습니다.");
  }
  const { tenantSlug } = req.params;
  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;
  if (!canAccessTenant(req, tenant)) {
    return res.status(403).send("소속 공동체만 조회할 수 있습니다.");
  }

  const [admins] = await pool.query(
    "SELECT id, telegram_id, username, name, created_at FROM admin WHERE tenant_id = ? ORDER BY id ASC",
    [tenant.id],
  );

  res.render("admin-tenant", {
    tenant,
    admins,
    error: req.query.error,
    success: req.query.success,
  });
});

// 테넌트 관리자 추가 (소속 공동체만, superadmin은 전체)
router.post("/admin/tenants/:tenantSlug/admins", async (req, res) => {
  if (!req.admin) {
    return res.status(403).send("관리자만 접근할 수 있습니다.");
  }
  const { tenantSlug } = req.params;
  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;
  if (!canAccessTenant(req, tenant)) {
    return res.status(403).send("소속 공동체만 수정할 수 있습니다.");
  }

  const { username: inputUsername, name } = req.body || {};
  const username = (inputUsername || "").trim();
  if (!username) {
    return res.redirect(`/admin/tenants/${tenantSlug}?error=username_required`);
  }

  try {
    await pool.query(
      "INSERT INTO admin (tenant_id, username, name) VALUES (?, ?, ?)",
      [tenant.id, username, (name || "").trim() || null],
    );
    return res.redirect(`/admin/tenants/${tenantSlug}?success=added`);
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.redirect(`/admin/tenants/${tenantSlug}?error=username_duplicate`);
    }
    throw err;
  }
});

// 테넌트 관리자 삭제 (소속 공동체만, superadmin은 전체)
router.post("/admin/tenants/:tenantSlug/admins/:adminId/delete", async (req, res) => {
  if (!req.admin) {
    return res.status(403).send("관리자만 접근할 수 있습니다.");
  }
  const { tenantSlug, adminId } = req.params;
  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;
  if (!canAccessTenant(req, tenant)) {
    return res.status(403).send("소속 공동체만 수정할 수 있습니다.");
  }

  const [result] = await pool.query(
    "DELETE FROM admin WHERE id = ? AND tenant_id = ?",
    [Number(adminId), tenant.id],
  );
  if (result.affectedRows) {
    return res.redirect(`/admin/tenants/${tenantSlug}?success=removed`);
  }
  return res.redirect(`/admin/tenants/${tenantSlug}?error=not_found`);
});

// 이벤트 삭제
router.post("/admin/events/:eventId/delete", async (req, res) => {
  if (!req.admin) return res.status(403).send("관리자만 접근할 수 있습니다.");
  const { eventId } = req.params;
  const { tenantSlug } = req.body;
  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;
  if (!canAccessTenant(req, tenant)) return res.status(403).send("권한이 없습니다.");
  await pool.query("DELETE FROM event WHERE id = ? AND tenant_id = ?", [Number(eventId), tenant.id]);
  res.redirect(`/admin?tenant=${tenant.slug}`);
});

// 옵션 그룹 삭제
router.post("/admin/option-groups/:groupId/delete", async (req, res) => {
  if (!req.admin) return res.status(403).send("관리자만 접근할 수 있습니다.");
  const { groupId } = req.params;
  const { tenantSlug } = req.body;
  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;
  await pool.query(
    "DELETE og FROM option_group og JOIN event e ON og.event_id = e.id WHERE og.id = ? AND e.tenant_id = ?",
    [Number(groupId), tenant.id],
  );
  res.redirect(`/admin?tenant=${tenant.slug}`);
});

// 이벤트 공개/비공개 토글
router.post("/admin/events/:eventId/toggle", async (req, res) => {
  if (!req.admin) return res.status(403).send("관리자만 접근할 수 있습니다.");
  const { eventId } = req.params;
  const { tenantSlug } = req.body;
  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;
  if (!canAccessTenant(req, tenant)) return res.status(403).send("권한이 없습니다.");
  await pool.query(
    "UPDATE event SET is_active = 1 - is_active WHERE id = ? AND tenant_id = ?",
    [Number(eventId), tenant.id],
  );
  res.redirect(`/admin?tenant=${tenant.slug}`);
});

// 이벤트 수정 (기본 정보 + 옵션 그룹 추가)
router.post("/admin/events/:eventId/update", async (req, res) => {
  if (!req.admin) return res.status(403).send("관리자만 접근할 수 있습니다.");
  const { eventId } = req.params;
  const { tenantSlug, title, description, eventDate } = req.body;
  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;
  if (!canAccessTenant(req, tenant)) return res.status(403).send("권한이 없습니다.");
  const eid = Number(eventId);
  await pool.query(
    "UPDATE event SET title = ?, description = ?, event_date = ? WHERE id = ? AND tenant_id = ?",
    [title, description || null, new Date(eventDate), eid, tenant.id],
  );
  // 수정 폼에서 새 옵션 그룹 추가
  const groupNames = [].concat(req.body.groupName || []).filter(Boolean);
  const multipleSelects = [].concat(req.body.multipleSelect || []);
  const optionTexts = [].concat(req.body.optionText || []);
  for (let i = 0; i < groupNames.length; i++) {
    const gName = groupNames[i].trim();
    if (!gName) continue;
    const [existCount] = await pool.query("SELECT COUNT(*) AS cnt FROM option_group WHERE event_id = ?", [eid]);
    const sortOrder = existCount[0].cnt;
    const [gResult] = await pool.query(
      "INSERT INTO option_group (event_id, name, multiple_select, sort_order) VALUES (?, ?, ?, ?)",
      [eid, gName, multipleSelects[i] === "true" ? 1 : 0, sortOrder],
    );
    const optNames = (optionTexts[i] || "").split("\n").map((s) => s.trim()).filter(Boolean);
    if (optNames.length > 0) {
      await pool.query(
        "INSERT INTO option_item (option_group_id, name, sort_order) VALUES ?",
        [optNames.map((n, idx) => [gResult.insertId, n, idx])],
      );
    }
  }
  res.redirect(`/admin?tenant=${tenant.slug}`);
});

router.post("/admin/events", async (req, res) => {
  if (!req.admin) {
    return res.status(403).send("관리자만 접근할 수 있습니다.");
  }
  const { tenantSlug, title, description, eventDate, isActive, username: logUsername } =
    req.body;

  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;
  if (!canAccessTenant(req, tenant)) {
    return res.status(403).send("소속 공동체만 등록할 수 있습니다.");
  }

  const [result] = await pool.query(
    "INSERT INTO event (tenant_id, title, description, event_date, is_active) VALUES (?, ?, ?, ?, ?)",
    [
      tenant.id,
      title,
      description || null,
      new Date(eventDate),
      isActive !== "false" ? 1 : 0,
    ],
  );
  const eventId = result.insertId;

  // 옵션 그룹 일괄 처리 (groupName[], multipleSelect[], options[])
  const groupNames = [].concat(req.body.groupName || []).filter(Boolean);
  const multipleSelects = [].concat(req.body.multipleSelect || []);
  const optionTexts = [].concat(req.body.optionText || []);
  for (let i = 0; i < groupNames.length; i++) {
    const gName = groupNames[i].trim();
    if (!gName) continue;
    const isMulti = multipleSelects[i] === "true" ? 1 : 0;
    const [gResult] = await pool.query(
      "INSERT INTO option_group (event_id, name, multiple_select, sort_order) VALUES (?, ?, ?, ?)",
      [eventId, gName, isMulti, i],
    );
    const optNames = (optionTexts[i] || "").split("\n").map((s) => s.trim()).filter(Boolean);
    if (optNames.length > 0) {
      await pool.query(
        "INSERT INTO option_item (option_group_id, name, sort_order) VALUES ?",
        [optNames.map((n, idx) => [gResult.insertId, n, idx])],
      );
    }
  }

  await pool.query(
    "INSERT INTO action_log (tenant_id, event_id, action, metadata) VALUES (?, ?, ?, JSON_OBJECT('username', ?, 'title', ?))",
    [tenant.id, eventId, "ADMIN_CREATE_EVENT", logUsername || null, title],
  );

  const link = eventDetailUrl(tenant.slug, eventId);
  await sendMessage(
    tenant.chat_room_id,
    `📅 <b>새 이벤트가 생성되었습니다!</b>\n이벤트명: ${escapeHtml(title)}\n` +
      `<a href="${escapeHtml(link)}">바로가기</a>`
  );

  res.redirect(`/t/${tenant.slug}/events/${eventId}`);
});

router.post("/admin/options", async (req, res) => {
  if (!req.admin) {
    return res.status(403).send("관리자만 접근할 수 있습니다.");
  }
  const {
    tenantSlug,
    eventId,
    groupName,
    multipleSelect,
    options,
    username: logUsername,
  } = req.body;

  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;
  if (!canAccessTenant(req, tenant)) {
    return res.status(403).send("소속 공동체만 수정할 수 있습니다.");
  }

  const [[event]] = await pool.query(
    "SELECT * FROM event WHERE id = ? AND tenant_id = ? LIMIT 1",
    [Number(eventId), tenant.id],
  );
  if (!event) {
    return res.status(404).send("Event not found");
  }

  const [groupResult] = await pool.query(
    "INSERT INTO option_group (event_id, name, multiple_select) VALUES (?, ?, ?)",
    [event.id, groupName, multipleSelect === "true" ? 1 : 0],
  );
  const optionGroupId = groupResult.insertId;

  const optionNames = (options || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  if (optionNames.length > 0) {
    const values = optionNames.map((name, idx) => [
      optionGroupId,
      name,
      idx,
    ]);
    await pool.query(
      "INSERT INTO option_item (option_group_id, name, sort_order) VALUES ?",
      [values],
    );
  }

  await pool.query(
    "INSERT INTO action_log (tenant_id, event_id, action, metadata) VALUES (?, ?, ?, JSON_OBJECT('username', ?, 'groupName', ?, 'optionNames', ?))",
    [tenant.id, event.id, "ADMIN_CREATE_OPTION_GROUP", logUsername || null, groupName, JSON.stringify(optionNames)],
  );

  res.redirect(`/t/${tenant.slug}/events/${event.id}`);
});

module.exports = router;
