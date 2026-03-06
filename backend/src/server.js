const express = require("express");
const path = require("path");
const morgan = require("morgan");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Helper: find tenant by slug
async function getTenantOr404(slug, res) {
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    res.status(404).send("Tenant not found");
    return null;
  }
  return tenant;
}

// Event list
app.get("/t/:tenantSlug/events", async (req, res) => {
  const { tenantSlug } = req.params;
  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;

  const events = await prisma.event.findMany({
    where: { tenantId: tenant.id, isActive: true },
    orderBy: { eventDate: "asc" },
  });

  res.render("event-list", { tenant, events });
});

// Event detail + join form
app.get("/t/:tenantSlug/events/:eventId", async (req, res) => {
  const { tenantSlug, eventId } = req.params;
  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;

  const event = await prisma.event.findFirst({
    where: { id: Number(eventId), tenantId: tenant.id },
    include: {
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          options: { orderBy: { sortOrder: "asc" } },
        },
      },
      participants: {
        include: { options: { include: { optionItem: true } } },
      },
    },
  });

  if (!event) {
    return res.status(404).send("Event not found");
  }

  res.render("event-detail", { tenant, event });
});

// Join event
app.post("/participants", async (req, res) => {
  const { tenantSlug, eventId, name, studentNo, telegramId, optionItemIds } =
    req.body;

  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;

  const event = await prisma.event.findFirst({
    where: { id: Number(eventId), tenantId: tenant.id },
  });
  if (!event) {
    return res.status(404).send("Event not found");
  }

  const participant = await prisma.participant.create({
    data: {
      eventId: event.id,
      name,
      studentNo: studentNo || null,
      telegramId,
    },
  });

  const optionIds = Array.isArray(optionItemIds)
    ? optionItemIds
    : optionItemIds
    ? [optionItemIds]
    : [];

  if (optionIds.length > 0) {
    await prisma.participantOption.createMany({
      data: optionIds.map((id) => ({
        participantId: participant.id,
        optionItemId: Number(id),
      })),
      skipDuplicates: true,
    });
  }

  await prisma.actionLog.create({
    data: {
      tenantId: tenant.id,
      eventId: event.id,
      participantId: participant.id,
      action: "JOIN_EVENT",
      metadata: {
        name,
        studentNo,
        telegramId,
        optionItemIds: optionIds,
      },
    },
  });

  res.redirect(`/t/${tenant.slug}/events/${event.id}`);
});

// Update or cancel participation (only by original telegramId)
app.post("/participants/update", async (req, res) => {
  const {
    tenantSlug,
    participantId,
    telegramId,
    name,
    studentNo,
    mode,
  } = req.body;

  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;

  const participant = await prisma.participant.findFirst({
    where: { id: Number(participantId) },
    include: { event: true },
  });

  if (!participant || participant.event.tenantId !== tenant.id) {
    return res.status(404).send("Participant not found");
  }

  if (!telegramId || participant.telegramId !== telegramId) {
    return res.status(403).send("Not allowed to modify this participant");
  }

  if (mode === "delete") {
    await prisma.actionLog.create({
      data: {
        tenantId: tenant.id,
        eventId: participant.eventId,
        participantId: participant.id,
        action: "CANCEL_EVENT",
        metadata: { name: participant.name },
      },
    });

    await prisma.participant.delete({
      where: { id: participant.id },
    });
  } else {
    const updated = await prisma.participant.update({
      where: { id: participant.id },
      data: {
        name: name || participant.name,
        studentNo: studentNo || null,
      },
    });

    await prisma.actionLog.create({
      data: {
        tenantId: tenant.id,
        eventId: participant.eventId,
        participantId: participant.id,
        action: "UPDATE_PARTICIPANT",
        metadata: {
          oldName: participant.name,
          oldStudentNo: participant.studentNo,
          newName: updated.name,
          newStudentNo: updated.studentNo,
        },
      },
    });
  }

  res.redirect(`/t/${tenant.slug}/events/${participant.eventId}`);
});

// Simple admin endpoints (no auth yet, identified by telegramId)
app.get("/admin", async (req, res) => {
  const tenants = await prisma.tenant.findMany();
  res.render("admin", { tenants });
});

app.post("/admin/events", async (req, res) => {
  const { tenantSlug, title, description, eventDate, isActive, telegramId } =
    req.body;

  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;

  const event = await prisma.event.create({
    data: {
      tenantId: tenant.id,
      title,
      description,
      eventDate: new Date(eventDate),
      isActive: isActive !== "false",
    },
  });

  await prisma.actionLog.create({
    data: {
      tenantId: tenant.id,
      eventId: event.id,
      action: "ADMIN_CREATE_EVENT",
      metadata: { telegramId, title },
    },
  });

  res.redirect(`/t/${tenant.slug}/events/${event.id}`);
});

app.post("/admin/options", async (req, res) => {
  const {
    tenantSlug,
    eventId,
    groupName,
    multipleSelect,
    options,
    telegramId,
  } = req.body;

  const tenant = await getTenantOr404(tenantSlug, res);
  if (!tenant) return;

  const event = await prisma.event.findFirst({
    where: { id: Number(eventId), tenantId: tenant.id },
  });
  if (!event) {
    return res.status(404).send("Event not found");
  }

  const optionGroup = await prisma.optionGroup.create({
    data: {
      eventId: event.id,
      name: groupName,
      multipleSelect: multipleSelect === "true",
    },
  });

  const optionNames = (options || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  if (optionNames.length > 0) {
    await prisma.optionItem.createMany({
      data: optionNames.map((name, idx) => ({
        optionGroupId: optionGroup.id,
        name,
        sortOrder: idx,
      })),
    });
  }

  await prisma.actionLog.create({
    data: {
      tenantId: tenant.id,
      eventId: event.id,
      action: "ADMIN_CREATE_OPTION_GROUP",
      metadata: { telegramId, groupName, optionNames },
    },
  });

  res.redirect(`/t/${tenant.slug}/events/${event.id}`);
});

app.get("/", (req, res) => {
  res.redirect("/admin");
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${port}`);
});

