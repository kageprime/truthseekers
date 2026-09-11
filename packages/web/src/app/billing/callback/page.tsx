"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PageLayout from "../../components/PageLayout";
import { useAuth } from "../../hooks/useAuth";
import { usePaystackVerify } from "../../hooks";

function CallbackInner() {
  const params = useSearchParams();
  const { refresh } = useAuth();
  const { mutate: verify } = usePaystackVerify();
  const [state, setState] = useState<"verifying" | "success" | "failed">("verifying");
  const [tier, setTier] = useState("");

  useEffect(() => {
    const ref = params.get("reference") ?? params.get("trxref") ?? "";
    if (!ref) { setState("failed"); return; }
    let cancelled = false;
    verify(ref).then((data) => {
      if (cancelled) return;
      if (data?.status === "success") {
        setTier(data.tier ?? "");
        setState("success");
        refresh();
      } else {
        setState("failed");
      }
    }).catch(() => { if (!cancelled) setState("failed"); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PageLayout maxWidthClass="max-w-xl">
      <div className="py-16 text-center">
        {state === "verifying" && (
          <>
            <h1 className="font-display font-bold mb-3" style={{ fontSize: "1.75rem", color: "var(--ink)" }}>Confirming payment…</h1>
            <p className="text-sm" style={{ color: "var(--muted)" }}>Talking to the payment provider. Don’t close this tab.</p>
          </>
        )}
        {state === "success" && (
          <>
            <h1 className="font-display font-bold mb-3" style={{ fontSize: "1.75rem", color: "var(--ink)" }}>Welcome{tier ? ` to ${tier}` : ""} 🎉</h1>
            <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Your payment went through and your plan is active.</p>
            <div className="flex items-center justify-center gap-4 text-sm">
              <Link href="/article/new" className="font-medium underline underline-offset-2" style={{ color: "var(--accent)" }}>Generate an article</Link>
              <Link href="/settings" className="font-medium underline underline-offset-2" style={{ color: "var(--muted)" }}>View subscription</Link>
            </div>
          </>
        )}
        {state === "failed" && (
          <>
            <h1 className="font-display font-bold mb-3" style={{ fontSize: "1.75rem", color: "var(--ink)" }}>Payment not confirmed</h1>
            <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>We couldn’t confirm this payment. If money left your account, it will reflect shortly or be reversed.</p>
            <div className="flex items-center justify-center gap-4 text-sm">
              <Link href="/pricing" className="font-medium underline underline-offset-2" style={{ color: "var(--accent)" }}>Try again</Link>
              <Link href="/" className="font-medium underline underline-offset-2" style={{ color: "var(--muted)" }}>Home</Link>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}

export default function BillingCallbackPage() {
  return (
    <Suspense>
      <CallbackInner />
    </Suspense>
  );
}
