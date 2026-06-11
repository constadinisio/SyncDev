"use client";

import { ToastProvider } from "@/components/ui/Toast";
import { ThemeContext, useThemeState } from "@/hooks/useTheme";
import { useServiceWorker } from "@/hooks/useServiceWorker";

export function Providers({ children }: { readonly children: React.ReactNode }) {
  const themeValue = useThemeState();
  useServiceWorker();

  return (
    <ThemeContext.Provider value={themeValue}>
      <ToastProvider>{children}</ToastProvider>
    </ThemeContext.Provider>
  );
}
