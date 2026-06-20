import type { Metadata, Viewport } from "next";
import "./globals.css";
import ErrorBoundary from "./components/ErrorBoundary";
import QueryProvider from "./components/QueryProvider";
import ThemeProvider from "./components/ThemeProvider";
import { FloatingChatProvider } from "./FloatingChatContext";
import { ChatProvider } from "./chat/ChatContext";
import { HeaderSearchProvider } from "./HeaderSearchContext";
import { ArticleViewProvider } from "./ArticleViewContext";
import AppShell from "./AppShell";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f5efe0",
};

export const metadata: Metadata = {
  title: "Truthseekers — The Living Encyclopedia",
  description: "An LLM-powered interactive encyclopedia. Research, write, verify — all by AI agents.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Truthseekers", statusBarStyle: "black-translucent" },
  icons: [
    { rel: "icon", url: "/logo-icon.png" },
    { rel: "apple-touch-icon", url: "/logo-icon.png" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300..700&family=Lora:ital,wght@0,400..700;1,400..700&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
      <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem("theme")||"light";document.documentElement.classList.toggle("dark",t==="dark")}catch(e){}})()` }} />
      </head>
      <body className="antialiased" style={{ margin: 0 }}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:rounded-lg focus:text-sm focus:shadow-lg" style={{ color: "var(--ink)" }}>
          Skip to main content
        </a>
        <ErrorBoundary>
          <QueryProvider>
            <ThemeProvider>
              <FloatingChatProvider>
                <ChatProvider>
                  <HeaderSearchProvider>
                    <ArticleViewProvider>
                      <AppShell>{children}</AppShell>
                    </ArticleViewProvider>
                  </HeaderSearchProvider>
                </ChatProvider>
              </FloatingChatProvider>
            </ThemeProvider>
          </QueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
