const express = require("express");
const { pool, getTenantOr404 } = require("../db/mysql");
const { ensureTenantAllowed } = require("../middleware/tenantRestrict");
const { sendMessage, eventDetailUrl } = require("../lib/telegram");

const router = express.Router();

/** 로그인한 사용자명 (JWT 또는 쿠키). 전역으로 사용. */
function getLoggedInUsername(req) {
  const fromAuth = req.auth && req.auth.username;
  const fromCookie = req.cookies && req.cookies.username;
  const value = fromAuth || fromCookie;
  return value ? String(value).trim() : null;
}

// Join event
router.post("/participants", async (req, res) => {
  const username = getLoggedInUsername(req);
  if (!username) {
    return res.status(401).send("로그인이 필요합니다. 텔레그램에서 열어 주세요.");
  }

  const { tenantSlug, eventId, name, studentNo, optionItemIds } = req.body;

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

  const [participantResult] = await pool.query(
    "INSERT INTO participant (event_id, name, student_no, username) VALUES (?, ?, ?, ?)",
    [event.id, name, studentNo || null, username],
  );
  const participantId = participantResult.insertId;

  const optionIds = Array.isArray(optionItemIds)
    ? optionItemIds
    : optionItemIds
    ? [optionItemIds]
    : [];

  if (optionIds.length > 0) {
    const values = optionIds.map((id) => [participantId, Number(id)]);
    await pool.query(
      "INSERT INTO participant_option (participant_id, option_item_id) VALUES ?",
      [values],
    );
  }

  await pool.query(
    "INSERT INTO action_log (tenant_id, event_id, participant_id, action, metadata) VALUES (?, ?, ?, ?, JSON_OBJECT('name', ?, 'studentNo', ?, 'username', ?, 'optionItemIds', ?))",
    [tenant.id, event.id, participantId, "JOIN_EVENT", name, studentNo || null, username, JSON.stringify(optionIds)],
  );

  const [[{ cnt }]] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM participant WHERE event_id = ?", [event.id]
  );
  const link = eventDetailUrl(tenant.slug, event.id);
  sendMessage(
    tenant.chat_room_id,
    `👤 <b>${event.title}</b>\n신청자 수: ${cnt}명 (+1)\n` +
      `<a href="${link}">바로가기 (${tenant.name})</a>`
  );

  res.redirect(`/t/${tenant.slug}/events/${event.id}`);
});

// Update or cancel participation (only by same logged-in username)
router.post("/participants/update", async (req, res) => {
  const username = getLoggedInUsername(req);
  if (!username) {
    return res.status(401).send("로그인이 필요합니다.");
  }

  const { tenantSlug, participantId, name, studentNo, mode } = req.body;

  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;
  if (!ensureTenantAllowed(req, res, tenant)) return;

  const [[participant]] = await pool.query(
    "SELECT p.*, e.tenant_id, e.id AS event_id FROM participant p JOIN event e ON p.event_id = e.id WHERE p.id = ? LIMIT 1",
    [Number(participantId)],
  );

  if (!participant || participant.tenant_id !== tenant.id) {
    return res.status(404).send("Participant not found");
  }

  if (participant.username !== username) {
    return res.status(403).send("Not allowed to modify this participant");
  }

  if (mode === "delete") {
    await pool.query(
      "INSERT INTO action_log (tenant_id, event_id, participant_id, action, metadata) VALUES (?, ?, ?, ?, JSON_OBJECT('name', ?))",
      [tenant.id, participant.event_id, participant.id, "CANCEL_EVENT", participant.name],
    );

    await pool.query("DELETE FROM participant WHERE id = ?", [participant.id]);

    const [[{ cnt }]] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM participant WHERE event_id = ?", [participant.event_id]
    );
    const [[ev]] = await pool.query("SELECT title FROM event WHERE id = ? LIMIT 1", [participant.event_id]);
    const link = eventDetailUrl(tenant.slug, participant.event_id);
    sendMessage(
      tenant.chat_room_id,
      `👤 <b>${ev ? ev.title : ""}</b>\n신청자 수: ${cnt}명 (-1)\n` +
        `<a href="${link}">바로가기 (${tenant.name})</a>`
    );
  } else {
    const newName = name || participant.name;
    const newStudentNo = studentNo || null;

    await pool.query(
      "UPDATE participant SET name = ?, student_no = ? WHERE id = ?",
      [newName, newStudentNo, participant.id],
    );

    await pool.query(
      "INSERT INTO action_log (tenant_id, event_id, participant_id, action, metadata) VALUES (?, ?, ?, ?, JSON_OBJECT('oldName', ?, 'oldStudentNo', ?, 'newName', ?, 'newStudentNo', ?))",
      [
        tenant.id,
        participant.event_id,
        participant.id,
        "UPDATE_PARTICIPANT",
        participant.name,
        participant.student_no,
        newName,
        newStudentNo,
      ],
    );
  }

  res.redirect(`/t/${tenant.slug}/events/${participant.event_id}`);
});

module.exports = router;
