import type { Metadata, Viewport } from "next";
import "./globals.css";
import ErrorBoundary from "./components/ErrorBoundary";
import QueryProvider from "./components/QueryProvider";
import ThemeProvider from "./components/ThemeProvider";
import { FloatingChatProvider } from "./FloatingChatContext";
import { ChatProvider } from "./chat/ChatContext";
import { HeaderSearchProvider } from "./HeaderSearchContext";
import { ArticleViewProvider } from "./ArticleViewContext";
import { AuthProvider } from "./components/AuthProvider";
import { TimeMachineProvider } from "./hooks/useTimeMachine";
import { UiSettingsProvider } from "./context/UiSettingsContext";
import { UiModeProvider } from "./context/UiModeContext";
import TimeMachineBar from "./components/TimeMachineBar";
import RegisterSw from "./components/RegisterSw";
import ScrollReveal from "./components/ScrollReveal";
import { ToastProvider } from "./components/Toast";
import AppShell from "./AppShell";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#FCFCF9",
};

export const metadata: Metadata = {
  title: "Truthseekers — The Living Encyclopedia",
  description: "An LLM-powered interactive encyclopedia. Research, write, verify — all by AI agents.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Truthseekers", statusBarStyle: "black-translucent" },
  icons: [
    { rel: "icon", url: "/logo-icon.png" },
    { rel: "apple-touch-icon", url: "/icons/apple-touch-icon.png" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Inter:wght@300;400;500;600;700;800&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=JetBrains+Mono:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("theme")||"light";document.documentElement.classList.toggle("dark",t==="dark")}catch(e){}})()` }} />
      </head>
      <body className="antialiased bg-[#FCFCF9] text-[#18181B]" style={{ margin: 0 }}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-white focus:rounded-lg focus:text-sm focus:shadow-lg" style={{ color: "var(--ink)", zIndex: "var(--z-skip-link)" }}>
          Skip to main content
        </a>
        <ErrorBoundary>
          <QueryProvider>
            <ThemeProvider>
              <AuthProvider>
                <FloatingChatProvider>
                  <ChatProvider>
                    <TimeMachineProvider>
                      <HeaderSearchProvider>
                        <ArticleViewProvider>
                          <UiSettingsProvider>
                            <UiModeProvider>
                              <ToastProvider>
                                <ScrollReveal />
                                <RegisterSw />
                                <TimeMachineBar />
                                <AppShell>{children}</AppShell>
                              </ToastProvider>
                            </UiModeProvider>
                          </UiSettingsProvider>
                        </ArticleViewProvider>
                      </HeaderSearchProvider>
                    </TimeMachineProvider>
                  </ChatProvider>
                </FloatingChatProvider>
              </AuthProvider>
            </ThemeProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
