"use client";

import { useState } from "react";
import Link from "next/link";
import PageLayout from "../components/PageLayout";
import { useAuth } from "../hooks/useAuth";
import { BASE } from "@/lib/api";
import { IconCheck, IconLightning } from "../components/Icons";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "/month",
    description: "Get started with basic encyclopedia access",
    features: [
      "10 article generations per month",
      "Basic search & browsing",
      "Community articles access",
      "Standard support",
    ],
    cta: "Current plan",
    disabled: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For power users and small teams",
    features: [
      "100 article generations per month",
      "Priority queue processing",
      "DALL-E image generation",
      "Full-text search",
      "Priority support",
    ],
    priceId: "price_pro_monthly",
    cta: "Upgrade to Pro",
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$99",
    period: "/month",
    description: "For organizations at scale",
    features: [
      "Unlimited generations",
      "Dedicated worker pool",
      "SSO & API key management",
      "Custom integrations",
      "24/7 dedicated support",
    ],
    priceId: "price_enterprise_monthly",
    cta: "Contact Sales",
  },
];

export default function PricingPage() {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleUpgrade(priceId: string) {
    if (!token) return;
    setLoading(priceId);
    try {
      const res = await fetch(`${BASE}/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ priceId, successUrl: `${window.location.origin}/settings`, cancelUrl: `${window.location.origin}/pricing` }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {}
    setLoading(null);
  }

  return (
    <PageLayout>
      <div className="max-w-5xl mx-auto w-full px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold tracking-tight mb-3" style={{ color: "var(--ink)" }}>Pricing</h1>
          <p className="text-lg" style={{ color: "var(--muted)" }}>Choose the plan that fits your needs</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrent = user?.subscriptionTier === plan.id;
            const isLoading = loading === plan.priceId;

            return (
              <div
                key={plan.id}
                className="glass-card-static p-6 flex flex-col relative"
                style={plan.popular ? { borderColor: "var(--accent)", borderWidth: 2 } : {}}
              >
                {plan.popular && (
                  <span
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase px-3 py-1 rounded-full"
                    style={{ background: "var(--accent)", color: "white" }}
                  >
                    Most popular
                  </span>
                )}

                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-1" style={{ color: "var(--ink)" }}>{plan.name}</h2>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-3xl font-bold" style={{ color: "var(--ink)" }}>{plan.price}</span>
                    <span className="text-sm" style={{ color: "var(--subtle)" }}>{plan.period}</span>
                  </div>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>{plan.description}</p>
                </div>

                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm" style={{ color: "var(--ink-secondary)" }}>
                      <IconCheck size={16} style={{ color: "var(--green)" }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button disabled className="btn w-full opacity-60" style={{ background: "var(--border-light)", color: "var(--muted)" }}>
                    Current plan
                  </button>
                ) : plan.id === "free" ? (
                  <Link href="/register" className="btn btn-secondary w-full text-center no-underline">
                    Get started
                  </Link>
                ) : (
                  <button
                    onClick={() => plan.priceId && handleUpgrade(plan.priceId)}
                    disabled={isLoading || !token}
                    className={`btn w-full ${plan.popular ? "btn-primary" : "btn-secondary"}`}
                  >
                    {isLoading ? "Redirecting..." : plan.cta}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {!user && (
          <div className="text-center mt-8">
            <Link href="/login" className="text-sm font-medium underline underline-offset-2" style={{ color: "var(--accent)" }}>
              Sign in to subscribe
            </Link>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
