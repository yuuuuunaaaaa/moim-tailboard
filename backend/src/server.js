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

// Require auth for non-public routes: allow login/auth endpoints; else require JWT or username cookie.
// Unauthenticated → redirect to /login so PC users can open the site in a browser and see the login screen.
function requireTelegramAuth(req, res, next) {
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
    const isAdmin = !!req.admin;
    const [tenants] = await pool.query(
      "SELECT id, slug, name FROM tenant ORDER BY name ASC",
    );
    res.render("home", {
      tenants: isAdmin ? tenants : [],
      canChooseTenant: isAdmin,
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

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
