const path = require("path");
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

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
