const path = require("path");

console.log("[server] Starting...");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
require("express-async-errors");

const express = require("express");
const cookieParser = require("cookie-parser");
const { pool } = require("./db/mysql");
const { optionalAuthMiddleware, UNAUTH_MESSAGE } = require("./middleware/auth");
const eventsRouter = require("./routes/events");
const participantsRouter = require("./routes/participants");
const adminRouter = require("./routes/admin");
const authRouter = require("./routes/auth");

const app = express();

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Railway 등 배포 환경 헬스 체크 (인증 없이 200 반환)
app.get("/health", (req, res) => res.status(200).send("ok"));

// Resolve JWT from Authorization header or auth_token cookie; set req.auth and req.admin
app.use(optionalAuthMiddleware);

// 권한·사용자명 전역: username 있을 때만 공동체 선택/관리 노출
app.use(function (req, res, next) {
  const raw =
    (req.auth && req.auth.username) || (req.cookies && req.cookies.username);
  res.locals.username = raw ? String(raw).trim() : null;
  const hasUsername = !!res.locals.username;
  res.locals.isAdmin = hasUsername && !!req.admin;
  res.locals.canChooseTenant = hasUsername && !!(req.admin && req.admin.is_superadmin);
  next();
});

// 로컬/개발 환경에서는 로그인 없이 진입 가능 (UI 작업용)
const isLocalDev =
  process.env.NODE_ENV === "development" ||
  process.env.ALLOW_LOCAL_WITHOUT_AUTH === "1";

// Require auth for non-public routes: allow login/auth endpoints; else require JWT or username cookie.
// Unauthenticated → redirect to /login so PC users can open the site in a browser and see the login screen.
function requireTelegramAuth(req, res, next) {
  if (isLocalDev) return next();
  const allowPath =
    req.path === "/login" ||
    (req.path === "/auth/telegram" && (req.method === "GET" || req.method === "POST")) ||
    (req.path === "/auth/telegram-webapp" && req.method === "POST");
  if (allowPath) return next();
  if (req.auth || req.cookies.username) return next();
  // Prefer redirect so PC users see login page; 401 for API (e.g. Accept: application/json)
  if (req.get("Accept") && req.get("Accept").includes("application/json")) {
    return res.status(401).send(UNAUTH_MESSAGE);
  }
  return res.redirect("/login");
}
app.use(requireTelegramAuth);

// /t 만 오면 홈으로 (일부 클라이언트가 /t 요청하는 경우 대비)
app.get("/t", (req, res) => res.redirect(302, "/"));

app.get("/", async (req, res) => {
  try {
    const canChooseTenant = res.locals.canChooseTenant;
    const [tenants] = await pool.query(
      "SELECT id, slug, name FROM tenant ORDER BY name ASC",
    );
    res.render("home", {
      tenants: canChooseTenant ? tenants : [],
      canChooseTenant,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("DB error");
  }
});

app.use("/", authRouter);
app.use("/", eventsRouter);
app.use("/", participantsRouter);
app.use("/", adminRouter);

// 라우트/미들웨어에서 next(err) 된 경우 500 응답 (프로세스 크래시 방지)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send("Server error");
});

// 미처리 예외 시 로그 출력 (502 원인 파악용)
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log("[server] Listening on", HOST + ":" + PORT);
});
