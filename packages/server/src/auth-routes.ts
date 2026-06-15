import { Hono } from "hono";
import jwt from "jsonwebtoken";
import { createUser, getUserByEmail, getUserById, updateUser, setUserOnboarded } from "@encarta/storage";
import { sendMagicLink } from "./email.js";
import crypto from "node:crypto";

const JWT_SECRET = process.env.JWT_SECRET ?? (() => { throw new Error("JWT_SECRET environment variable is required"); })();
const TOKEN_EXPIRY = "30d";

// In-memory magic link tokens (in production, use DB/Redis)
const magicTokens = new Map<string, { email: string; expiresAt: number }>();

interface JwtPayload {
  sub: string;
  email: string;
}

function issueToken(user: { id: string; email: string; name: string; avatar: string; subscriptionTier: string; onboarded: boolean }): string {
  return jwt.sign({ sub: user.id, email: user.email } satisfies JwtPayload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function userResponse(user: { id: string; email: string; name: string; avatar: string; subscriptionTier: string; onboarded: boolean }) {
  return { id: user.id, email: user.email, name: user.name, avatar: user.avatar || "", subscriptionTier: user.subscriptionTier, onboarded: user.onboarded };
}

async function findOrCreateUser(email: string) {
  const normalized = email.toLowerCase().trim();
  let user = await getUserByEmail(normalized);
  if (!user) {
    const id = crypto.randomUUID();
    const created = await createUser(id, normalized);
    user = { ...created, avatar: "" };
  }
  return user;
}

const auth = new Hono();

// POST /auth/login — email-only login, creates user if new
auth.post("/login", async (c) => {
  const { email } = await c.req.json<{ email: string }>();
  if (!email || !email.includes("@")) return c.json({ error: "Valid email required" }, 400);

  const user = await findOrCreateUser(email);
  const token = issueToken(user);

  // In dev, return token directly
  if (process.env.NODE_ENV !== "production" || !process.env.RESEND_API_KEY) {
    return c.json({ token, user: userResponse(user) });
  }

  // In production, send magic link
  const linkToken = crypto.randomBytes(32).toString("hex");
  magicTokens.set(linkToken, { email: user.email, expiresAt: Date.now() + 15 * 60_000 });
  const link = `${c.req.header("origin") || "http://localhost:3001"}/auth/verify?token=${linkToken}`;
  await sendMagicLink(user.email, link);
  return c.json({ sent: true, email: user.email });
});

// POST /auth/verify — verify magic link token
auth.post("/verify", async (c) => {
  const { token: linkToken } = await c.req.json<{ token: string }>();
  if (!linkToken) return c.json({ error: "Token required" }, 400);

  const data = magicTokens.get(linkToken);
  if (!data || Date.now() > data.expiresAt) {
    magicTokens.delete(linkToken);
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  magicTokens.delete(linkToken);
  const user = await getUserByEmail(data.email);
  if (!user) return c.json({ error: "User not found" }, 404);

  const token = issueToken(user);
  return c.json({ token, user: userResponse(user) });
});

// GET /auth/me — returns current user from JWT
auth.get("/me", async (c) => {
  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) return c.json({ error: "Missing authorization header" }, 401);

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
  if (!authHeader?.startsWith("Bearer ")) return c.json({ error: "Missing authorization header" }, 401);

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

// ── OAuth ──────────────────────────────────────────────────────────────────

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";
const GOOGLE_CLIENT_ID_ENV = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

// GitHub
auth.get("/github", (c) => {
  if (!GITHUB_CLIENT_ID) return c.json({ error: "GitHub OAuth not configured" }, 503);
  const redirectUri = `${c.req.header("origin") || "http://localhost:3001"}/auth/github/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  return c.redirect(url);
});

auth.get("/github/callback", async (c) => {
  if (!GITHUB_CLIENT_ID) return c.json({ error: "GitHub OAuth not configured" }, 503);

  const code = c.req.query("code");
  if (!code) return c.json({ error: "No code provided" }, 400);

  const redirectUri = `${c.req.header("origin") || "http://localhost:3001"}/auth/github/callback`;

  try {
    // Exchange code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code, redirect_uri: redirectUri }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) return c.json({ error: "Failed to get access token" }, 400);

    // Get user email
    const emailRes = await fetch("https://api.github.com/user/emails", {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json" },
    });
    const emails = await emailRes.json() as Array<{ email: string; primary: boolean }>;
    const primary = emails.find((e) => e.primary);
    if (!primary) return c.json({ error: "No email found" }, 400);

    const user = await findOrCreateUser(primary.email);
    const jwtToken = issueToken(user);
    // Redirect back to frontend with token in hash
    const frontendUrl = `${c.req.header("origin") || "http://localhost:3001"}/auth/callback#token=${jwtToken}`;
    return c.redirect(frontendUrl);
  } catch {
    return c.json({ error: "OAuth failed" }, 500);
  }
});

// Google
auth.get("/google", (c) => {
  if (!GOOGLE_CLIENT_ID_ENV) return c.json({ error: "Google OAuth not configured" }, 503);
  const redirectUri = `${c.req.header("origin") || "http://localhost:3001"}/auth/google/callback`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID_ENV}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=email`;
  return c.redirect(url);
});

auth.get("/google/callback", async (c) => {
  if (!GOOGLE_CLIENT_ID_ENV) return c.json({ error: "Google OAuth not configured" }, 503);

  const code = c.req.query("code");
  if (!code) return c.json({ error: "No code provided" }, 400);

  const redirectUri = `${c.req.header("origin") || "http://localhost:3001"}/auth/google/callback`;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code, client_id: GOOGLE_CLIENT_ID_ENV, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) return c.json({ error: "Failed to get access token" }, 400);

    // Get user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData = await userRes.json() as { email?: string };
    if (!userData.email) return c.json({ error: "No email found" }, 400);

    const user = await findOrCreateUser(userData.email);
    const jwtToken = issueToken(user);
    const frontendUrl = `${c.req.header("origin") || "http://localhost:3001"}/auth/callback#token=${jwtToken}`;
    return c.redirect(frontendUrl);
  } catch {
    return c.json({ error: "OAuth failed" }, 500);
  }
});

export default auth;
