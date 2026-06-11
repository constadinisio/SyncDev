"use client";

import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeContext, useThemeState } from "@/hooks/useTheme";
import { useServiceWorker } from "@/hooks/useServiceWorker";

export function Providers({ children }: { readonly children: React.ReactNode }) {
  const themeValue = useThemeState();
  useServiceWorker();

  return (
    <SessionProvider>
      <ThemeContext.Provider value={themeValue}>
        <ToastProvider>{children}</ToastProvider>
      </ThemeContext.Provider>
    </SessionProvider>
  );
}
