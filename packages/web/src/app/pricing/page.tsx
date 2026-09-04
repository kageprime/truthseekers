"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth, useStripeCheckout } from "../hooks";
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
      "Basic search and browsing",
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
      "SSO and API key management",
      "Custom integrations",
      "24/7 dedicated support",
    ],
    priceId: "price_enterprise_monthly",
    cta: "Contact Sales",
  },
];

/* ── Subtle deterministic rotation per card (Z-Axis cascade) ── */
const ROTATIONS = [-1.2, 0.8, -0.5];

export default function PricingPage() {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const { mutate: checkout } = useStripeCheckout();

  async function handleUpgrade(priceId: string) {
    if (!token) return;
    setLoading(priceId);
    try {
      const data = await checkout(priceId);
      if (data?.url) window.location.href = data.url;
    } catch {}
    setLoading(null);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Ethereal Glass background */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {/* Radial gradient orbs */}
        <div
          className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent) 12%, transparent) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
          aria-hidden="true"
        />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[50%] rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--forest) 8%, transparent) 0%, transparent 70%)",
            filter: "blur(60px)",
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 py-16 sm:py-24 px-4">
          <div className="max-w-5xl mx-auto w-full stagger-children">
            {/* Header */}
            <div className="text-center mb-14">
              <span className="inline-block text-[10px] font-semibold uppercase tracking-[0.2em] px-3 py-1 mb-4" style={{ borderRadius: "9999px", background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}>
                Pricing
              </span>
              <h1 className="font-display font-bold mb-3" style={{ fontSize: "clamp(2rem, 4vw, 2.75rem)", letterSpacing: "-0.02em", color: "var(--ink)" }}>
                Choose your plan
              </h1>
              <p className="text-sm" style={{ color: "var(--muted)" }}>Pick the tier that fits how you explore</p>
            </div>

            {/* Cards — Z-Axis Cascade */}
            <div className="flex flex-col md:flex-row items-center md:items-stretch justify-center gap-6 md:gap-0 md:px-8">
              {PLANS.map((plan, i) => {
                const isCurrent = user?.subscriptionTier === plan.id;
                const isLoading = loading === plan.priceId;
                const rot = ROTATIONS[i] ?? 0;

                return (
                  <div
                    key={plan.id}
                    className="w-full max-w-sm md:w-0 md:flex-1 relative"
                    style={{
                      zIndex: plan.popular ? 2 : 1,
                      transform: `rotate(${rot}deg)`,
                      transition: "transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
                      marginLeft: i > 0 ? "-1.5rem" : "0",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = `rotate(0deg) scale(1.02)`; e.currentTarget.style.zIndex = "3"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = `rotate(${rot}deg)`; e.currentTarget.style.zIndex = plan.popular ? "2" : "1"; }}
                  >
                    {/* Double-Bezel Outer Shell */}
                    <div
                      className="p-[3px]"
                      style={{
                        borderRadius: "var(--radius-card-lg, 8px)",
                        background: plan.popular
                          ? "linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 60%, var(--forest)))"
                          : "color-mix(in srgb, var(--border) 15%, transparent)",
                      }}
                    >
                      {/* Inner Core */}
                      <div
                        className="relative flex flex-col p-6 sm:p-7"
                        style={{
                          borderRadius: "calc(var(--radius-card-lg, 8px) - 3px)",
                          background: "var(--surface-elevated)",
                          border: "1px solid var(--border-light)",
                          boxShadow: "inset 0 1px 1px rgba(255,255,255,0.1), 0 4px 24px rgba(0,0,0,0.04)",
                        }}
                      >
                        {/* Popular flag */}
                        {plan.popular && (
                          <span
                            className="absolute -top-[1px] left-1/2 -translate-x-1/2 text-[9px] font-semibold uppercase px-3 py-1"
                            style={{
                              background: "var(--accent)",
                              color: "white",
                              borderRadius: "0 0 var(--radius-sharp) var(--radius-sharp)",
                            }}
                          >
                            Most popular
                          </span>
                        )}

                        <div className="mb-6 pt-1">
                          <h2 className="font-display font-bold mb-1" style={{ fontSize: "1.25rem", color: "var(--ink)" }}>{plan.name}</h2>
                          <div className="flex items-baseline gap-1 mb-2">
                            <span className="text-3xl font-bold tabular-nums" style={{ color: "var(--ink)" }}>{plan.price}</span>
                            <span className="text-sm" style={{ color: "var(--subtle)" }}>{plan.period}</span>
                          </div>
                          <p className="text-sm" style={{ color: "var(--muted)" }}>{plan.description}</p>
                        </div>

                        <ul className="space-y-3 mb-8 flex-1">
                          {plan.features.map((f) => (
                            <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--ink-secondary)" }}>
                              <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "color-mix(in srgb, var(--forest) 10%, transparent)" }}>
                                <IconCheck size={10} style={{ color: "var(--forest)" }} />
                              </span>
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>

                        {isCurrent ? (
                          <button disabled className="w-full py-2.5 px-5 text-sm font-medium rounded-full" style={{ background: "color-mix(in srgb, var(--border) 30%, transparent)", color: "var(--muted)" }}>
                            Current plan
                          </button>
                        ) : plan.id === "free" ? (
                          <Link href="/register" className="block w-full py-2.5 px-5 text-sm font-medium text-center rounded-full no-underline transition-all duration-300" style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)" }}>
                            Get started
                          </Link>
                        ) : (
                          <button
                            onClick={() => plan.priceId && handleUpgrade(plan.priceId)}
                            disabled={isLoading || !token}
                            className="group w-full py-2.5 px-5 text-sm font-medium rounded-full transition-all duration-300 cursor-pointer disabled:opacity-40"
                            style={{
                              background: "var(--accent)",
                              color: "white",
                            }}
                          >
                            <span className="flex items-center justify-center gap-2">
                              {isLoading ? "Redirecting..." : plan.cta}
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center transition-all duration-500 group-hover:translate-x-0.5"
                                style={{
                                  background: "rgba(255,255,255,0.15)",
                                  transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
                                }}
                              >
                                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="9 18 15 12 9 6" />
                                </svg>
                              </span>
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!user && (
              <div className="text-center mt-10">
                <Link href="/login" className="text-xs font-medium underline underline-offset-2" style={{ color: "var(--accent)" }}>
                  Sign in to subscribe
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
