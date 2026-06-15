import { Hono } from "hono";
import Stripe from "stripe";
import { getUserById, updateUser } from "@encarta/storage";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-prod";

let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-03-31.basil" as any });
}

const s = new Hono();

// POST /stripe/checkout — create checkout session for a price
s.post("/checkout", async (c) => {
  if (!stripe) return c.json({ error: "Stripe not configured" }, 503);

  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { sub: string };
    const user = await getUserById(payload.sub);
    if (!user) return c.json({ error: "User not found" }, 404);

    const { priceId, successUrl, cancelUrl } = await c.req.json<{ priceId: string; successUrl: string; cancelUrl: string }>();
    if (!priceId) return c.json({ error: "priceId required" }, 400);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id,
      success_url: successUrl || `${c.req.header("origin") || "http://localhost:3001"}/chat`,
      cancel_url: cancelUrl || `${c.req.header("origin") || "http://localhost:3001"}/chat`,
      metadata: { userId: user.id },
    });

    return c.json({ url: session.url });
  } catch {
    return c.json({ error: "Failed to create checkout session" }, 500);
  }
});

// GET /stripe/portal — create customer portal session
s.get("/portal", async (c) => {
  if (!stripe) return c.json({ error: "Stripe not configured" }, 503);

  const authHeader = c.req.header("authorization");
  if (!authHeader?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);

  try {
    const payload = jwt.verify(authHeader.slice(7), JWT_SECRET) as { sub: string };
    const user = await getUserById(payload.sub);
    if (!user || !user.stripeCustomerId) return c.json({ error: "No subscription found" }, 404);

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${c.req.header("origin") || "http://localhost:3001"}/chat`,
    });

    return c.json({ url: session.url });
  } catch {
    return c.json({ error: "Failed to create portal session" }, 500);
  }
});

// POST /stripe/webhook — handle subscription events
s.post("/webhook", async (c) => {
  if (!stripe) return c.json({ error: "Stripe not configured" }, 503);

  const sig = c.req.header("stripe-signature");
  if (!sig) return c.json({ error: "Missing signature" }, 400);

  const raw = await c.req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET || "");
  } catch {
    return c.json({ error: "Invalid signature" }, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId || session.client_reference_id;
        if (userId) {
          await updateUser(userId, { stripeCustomerId: session.customer as string, subscriptionTier: "pro" });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const tier = sub.status === "active" || sub.status === "trialing" ? "pro" : "free";
        // Find user by stripeCustomerId and update tier
        // For simplicity, we'd need a lookup by stripeCustomerId
        break;
      }
    }
  } catch {}

  return c.json({ received: true });
});

export default s;
