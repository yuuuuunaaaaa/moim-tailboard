const express = require("express");
const { pool, getTenantOr404 } = require("../db/mysql");

const router = express.Router();

router.get("/admin", async (req, res) => {
  if (!req.admin) {
    return res.status(403).send("관리자만 접근할 수 있습니다.");
  }
  const [[tenant]] = await pool.query(
    "SELECT id, slug, name FROM tenant WHERE id = ? LIMIT 1",
    [req.admin.tenant_id],
  );
  if (!tenant) {
    return res.status(404).send("소속 공동체를 찾을 수 없습니다.");
  }
  res.render("admin", { tenant, tenants: [tenant] });
});

// 테넌트별 관리자 관리 페이지 (소속 공동체만 접근)
router.get("/admin/tenants/:tenantSlug", async (req, res) => {
  if (!req.admin) {
    return res.status(403).send("관리자만 접근할 수 있습니다.");
  }
  const { tenantSlug } = req.params;
  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;
  if (tenant.id !== req.admin.tenant_id) {
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

// 테넌트 관리자 추가 (소속 공동체만)
router.post("/admin/tenants/:tenantSlug/admins", async (req, res) => {
  if (!req.admin) {
    return res.status(403).send("관리자만 접근할 수 있습니다.");
  }
  const { tenantSlug } = req.params;
  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;
  if (tenant.id !== req.admin.tenant_id) {
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

// 테넌트 관리자 삭제 (소속 공동체만)
router.post("/admin/tenants/:tenantSlug/admins/:adminId/delete", async (req, res) => {
  if (!req.admin) {
    return res.status(403).send("관리자만 접근할 수 있습니다.");
  }
  const { tenantSlug, adminId } = req.params;
  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;
  if (tenant.id !== req.admin.tenant_id) {
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

router.post("/admin/events", async (req, res) => {
  if (!req.admin) {
    return res.status(403).send("관리자만 접근할 수 있습니다.");
  }
  const { tenantSlug, title, description, eventDate, isActive, username: logUsername } =
    req.body;

  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;
  if (tenant.id !== req.admin.tenant_id) {
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

  await pool.query(
    "INSERT INTO action_log (tenant_id, event_id, action, metadata) VALUES (?, ?, ?, JSON_OBJECT('username', ?, 'title', ?))",
    [tenant.id, eventId, "ADMIN_CREATE_EVENT", logUsername || null, title],
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
  if (tenant.id !== req.admin.tenant_id) {
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
