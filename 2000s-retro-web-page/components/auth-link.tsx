"use client";

import Link from "next/link";
import { useAuth } from "./auth-provider";

// ponytail: tiny client island — header stays a server component.
export function AuthLink() {
  const { user, loading, logout } = useAuth();
  if (loading) return null;
  if (!user) {
    return (
      <Link href="/login" className="hover:underline">
        Log in
      </Link>
    );
  }
  return (
    <span className="flex items-center gap-4">
      <span className="opacity-70">{user.name || user.email}</span>
      <button type="button" onClick={logout} className="hover:underline">
        Log out
      </button>
    </span>
  );
}
