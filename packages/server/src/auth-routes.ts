import { Hono } from "hono";
import jwt from "jsonwebtoken";
import { createUser, getUserByEmail, getUserById, updateUser, setUserOnboarded } from "@encarta/storage";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-prod";
const TOKEN_EXPIRY = "30d";

interface JwtPayload {
  sub: string;
  email: string;
}

const auth = new Hono();

// POST /auth/login — email-only login, creates user if new
auth.post("/login", async (c) => {
  const { email } = await c.req.json<{ email: string }>();
  if (!email || !email.includes("@")) {
    return c.json({ error: "Valid email required" }, 400);
  }

  const normalized = email.toLowerCase().trim();
  let user = await getUserByEmail(normalized);

  if (!user) {
    const id = crypto.randomUUID();
    const created = await createUser(id, normalized);
    user = { ...created, avatar: "" };
  }

  const token = jwt.sign({ sub: user.id, email: user.email } satisfies JwtPayload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

  // In dev, return token directly (no email infra)
  return c.json({ token, user: { id: user.id, email: user.email, name: user.name, avatar: "", subscriptionTier: user.subscriptionTier, onboarded: user.onboarded } });
});

// GET /auth/me — returns current user from JWT
auth.get("/me", async (c) => {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing authorization header" }, 401);
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as JwtPayload;
    const user = await getUserById(payload.sub);
    if (!user) return c.json({ error: "User not found" }, 404);
    return c.json({ user: { ...user, avatar: user.avatar || "" } });
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
});

// POST /auth/onboard — mark user as onboarded, update name
auth.post("/onboard", async (c) => {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing authorization header" }, 401);
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as JwtPayload;
    const { name } = await c.req.json<{ name?: string }>();
    if (name) await updateUser(payload.sub, { name });
    await setUserOnboarded(payload.sub);
    return c.json({ onboarded: true });
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
});

export default auth;
