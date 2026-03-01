"use client";

import { createContext, useContext, useMemo } from "react";
import type { TokenPayload } from "@/lib/types";

interface RunSheetContextValue extends TokenPayload {
  token: string;
}

const RunSheetContext = createContext<RunSheetContextValue | null>(null);

export function RunSheetProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: RunSheetContextValue;
}) {
  const memo = useMemo(() => value, [value]);
  return (
    <RunSheetContext.Provider value={memo}>{children}</RunSheetContext.Provider>
  );
}

export function useRunSheetAuth() {
  const ctx = useContext(RunSheetContext);
  if (!ctx) throw new Error("useRunSheetAuth must be used within RunSheetProvider");
  return ctx;
}

export function useRunSheetAuthOptional() {
  return useContext(RunSheetContext);
}
