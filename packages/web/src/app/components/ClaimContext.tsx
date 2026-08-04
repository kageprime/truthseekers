"use client";

import { createContext, useContext } from "react";
import type { ClaimStatus } from "@/lib/claim-parser";

const ClaimContext = createContext<Map<string, ClaimStatus>>(new Map());

export function useClaims() {
  return useContext(ClaimContext);
}

export { ClaimContext };
