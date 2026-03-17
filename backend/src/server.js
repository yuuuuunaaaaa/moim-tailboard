const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
require("express-async-errors");

const express = require("express");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { pool, testConnection } = require("./db/mysql");
const { optionalAuthMiddleware, UNAUTH_MESSAGE } = require("./middleware/auth");
const eventsRouter = require("./routes/events");
const participantsRouter = require("./routes/participants");
const adminRouter = require("./routes/admin");
const authRouter = require("./routes/auth");

// 필수 환경변수 경고 (exit 하지 않음 — 서버는 기동하고 요청 시 에러 확인)
const REQUIRED_ENV = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME", "JWT_SECRET", "TELEGRAM_BOT_TOKEN"];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length > 0) {
  console.error("[server] WARNING: Missing env vars:", missingEnv.join(", "));
}

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(morgan("combined"));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Railway 등 배포 환경 헬스 체크
app.get("/health", (req, res) => res.status(200).send("ok"));

// JWT from Authorization header or auth_token cookie → req.auth, req.admin
app.use(optionalAuthMiddleware);

app.use(function (req, res, next) {
  const raw = (req.auth && req.auth.username) || (req.cookies && req.cookies.username);
  res.locals.username = raw ? String(raw).trim() : null;
  const hasUsername = !!res.locals.username;
  res.locals.isAdmin = hasUsername && !!req.admin;
  res.locals.canChooseTenant = hasUsername && !!(req.admin && req.admin.is_superadmin);
  next();
});

const isLocalDev =
  process.env.NODE_ENV === "development" ||
  process.env.ALLOW_LOCAL_WITHOUT_AUTH === "1";

function requireTelegramAuth(req, res, next) {
  if (isLocalDev) return next();
  const allowPath =
    req.path === "/login" ||
    (req.path === "/auth/telegram" && (req.method === "GET" || req.method === "POST")) ||
    (req.path === "/auth/telegram-webapp" && req.method === "POST");
  if (allowPath) return next();
  if (req.auth || req.cookies.username) {
    // 비관리자가 PC(WebApp 아님)로 접근 시 차단
    const isAdmin = !!(req.admin);
    const isWebApp = !!(req.auth && req.auth.via_webapp);
    if (!isAdmin && !isWebApp) {
      return res.status(403).send(
        '<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>접근 불가</title></head><body style="font-family:sans-serif;text-align:center;padding:48px">' +
        '<h2>텔레그램 앱에서만 이용할 수 있습니다.</h2>' +
        '<p>이 서비스는 텔레그램 봇을 통해서만 접근할 수 있습니다.</p>' +
        '</body></html>'
      );
    }
    return next();
  }
  if (req.get("Accept") && req.get("Accept").includes("application/json")) {
    return res.status(401).send(UNAUTH_MESSAGE);
  }
  return res.redirect("/login");
}
app.use(requireTelegramAuth);

app.get("/t", (req, res) => res.redirect(302, "/"));

app.get("/", async (req, res) => {
  const canChooseTenant = res.locals.canChooseTenant;
  const [tenants] = await pool.query(
    "SELECT id, slug, name FROM tenant ORDER BY name ASC",
  );
  res.render("home", {
    tenants: canChooseTenant ? tenants : [],
    canChooseTenant,
  });
});

app.use("/", authRouter);
app.use("/", eventsRouter);
app.use("/", participantsRouter);
app.use("/", adminRouter);

// express-async-errors + 명시적 next(err) 처리
app.use((err, req, res, next) => {
  console.error("[error]", err);
  res.status(500).send("Server error");
});

process.on("unhandledRejection", (err) => console.error("[unhandledRejection]", err));
process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

async function start() {
  try {
    await testConnection();
    console.log("[db] Connection OK");
  } catch (err) {
    console.error("[db] Connection FAILED:", err.message);
    // DB 없이도 서버는 기동 — 요청 시 DB 에러는 500으로 처리
  }
  app.listen(PORT, HOST, () => {
    console.log("[server] Listening on", HOST + ":" + PORT);
  });
}

start();
