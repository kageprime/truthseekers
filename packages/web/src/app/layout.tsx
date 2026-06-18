import type { Metadata, Viewport } from "next";
import "./globals.css";
import ErrorBoundary from "./components/ErrorBoundary";
import QueryProvider from "./components/QueryProvider";
import ThemeProvider from "./components/ThemeProvider";
import { FloatingChatProvider } from "./FloatingChatContext";
import { ChatProvider } from "./chat/ChatContext";
import { HeaderSearchProvider } from "./HeaderSearchContext";
import AppShell from "./AppShell";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf8f2",
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
        <style>{`
          :root {
            --surface: #faf8f2;
            --surface-elevated: #ffffff;
            --ink: #1a1a1a;
            --ink-secondary: #4a4a4a;
            --muted: #6b6b6b;
            --subtle: #b0ada6;
            --border: #d9d5cc;
            --border-light: #ede8df;
            --accent: #1e40af;
            --accent-dark: #1e3a8a;
            --accent-subtle: #bfdbfe;
            --accent-bg: #eff6ff;
            --green: #15803d;
            --green-subtle: #dcfce7;
            --red: #dc2626;
            --red-subtle: #fee2e2;
            --blue: #2563eb;
            --gold: #b8860b;
            --gold-bg: #fef3c7;
            --cream: #fef3c7;
            --surface-glass: rgba(250, 248, 242, 0.6);
            --glass: rgba(250, 248, 242, 0.85);
            --glass-border: rgba(0, 0, 0, 0.06);
            --glass-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
            --skeleton-start: #e6e1d8;
            --skeleton-end: #f0ebe3;
          }
          .dark {
            --surface: #1a1614;
            --surface-elevated: #241f1b;
            --ink: #e8e0d5;
            --ink-secondary: #c4b9a8;
            --muted: #8c8273;
            --subtle: #5a5248;
            --border: #3a3228;
            --border-light: #2a241c;
            --accent: #60a5fa;
            --accent-dark: #3b82f6;
            --accent-subtle: #1e3a5f;
            --accent-bg: #172554;
            --green: #4ade80;
            --green-subtle: #14532d;
            --red: #f87171;
            --red-subtle: #7f1d1d;
            --blue: #60a5fa;
            --gold: #d4a853;
            --gold-bg: #422006;
            --cream: #2a241c;
            --surface-glass: rgba(36, 31, 27, 0.6);
            --glass: rgba(26, 22, 20, 0.85);
            --glass-border: rgba(255, 255, 255, 0.06);
            --glass-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
            --skeleton-start: #2a241c;
            --skeleton-end: #3a3228;
          }
          * { box-sizing: border-box; }
          body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            background-color: var(--surface);
            color: var(--ink);
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }

          /* ── Glass Utilities ─────────────────────────────────── */
          .glass {
            background: var(--glass);
            backdrop-filter: blur(24px) saturate(1.4);
            -webkit-backdrop-filter: blur(24px) saturate(1.4);
            border: 1px solid var(--glass-border);
            box-shadow: var(--glass-shadow);
          }
          .glass-sm {
            background: var(--glass);
            backdrop-filter: blur(12px) saturate(1.3);
            -webkit-backdrop-filter: blur(12px) saturate(1.3);
            border: 1px solid var(--glass-border);
            box-shadow: var(--glass-shadow);
          }
          .glass-lg {
            background: var(--glass);
            backdrop-filter: blur(40px) saturate(1.5);
            -webkit-backdrop-filter: blur(40px) saturate(1.5);
            border: 1px solid var(--glass-border);
            box-shadow: 0 8px 40px rgba(0,0,0,0.10);
          }
          .glass-card {
            background: var(--surface-elevated);
            border-radius: 4px;
            border: 1px solid var(--border);
            box-shadow: 0 1px 3px rgba(0,0,0,0.04);
            transition: all 0.2s cubic-bezier(0.23, 1, 0.32, 1);
          }
          .glass-card:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.06);
          }
          .glass-card-static {
            background: var(--surface-elevated);
            border-radius: 4px;
            border: 1px solid var(--border);
            box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          }
          .dark .glass-card,
          .dark .glass-card-static {
            background: var(--surface-elevated);
            border-color: var(--border);
          }

          /* ── Buttons ─────────────────────────────────────────── */
          .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.375rem;
            padding: 0.5rem 1rem;
            border-radius: 10px;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s cubic-bezier(0.23, 1, 0.32, 1);
            border: none;
            min-height: 40px;
            text-decoration: none;
            line-height: 1;
          }
          .btn:active {
            transform: scale(0.97);
          }
          .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
          }
          .btn-primary {
            background: var(--accent);
            color: white;
          }
          .btn-primary:hover {
            background: var(--accent-dark);
            box-shadow: 0 2px 8px rgba(30,64,175,0.25);
          }
          .btn-secondary {
            background: var(--surface-elevated);
            color: var(--ink);
            border: 1px solid var(--border);
          }
          .btn-secondary:hover {
            border-color: var(--ink);
            background: var(--surface);
          }
          .btn-ghost {
            background: transparent;
            color: var(--muted);
            padding: 0.375rem 0.625rem;
            border-radius: 8px;
            font-size: 0.8125rem;
            min-height: 32px;
          }
          .btn-ghost:hover {
            background: rgba(0,0,0,0.05);
            color: var(--ink);
          }
          .dark .btn-ghost:hover {
            background: rgba(255,255,255,0.05);
          }
          .btn-sm {
            padding: 0.375rem 0.75rem;
            font-size: 0.8125rem;
            min-height: 32px;
            border-radius: 8px;
          }
          .btn-lg {
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
            min-height: 48px;
            border-radius: 12px;
          }
          .btn-icon {
            width: 40px;
            height: 40px;
            padding: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border-radius: 10px;
            min-height: 40px;
          }

          /* ── Inputs ──────────────────────────────────────────── */
          .input {
            font-family: inherit;
            padding: 0.75rem 1rem;
            border: 1px solid var(--border);
            border-radius: 12px;
            outline: none;
            font-size: 0.9375rem;
            width: 100%;
            background: var(--surface-elevated);
            color: var(--ink);
            transition: border-color 0.2s, box-shadow 0.2s;
          }
          .input:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--accent-bg);
          }
          .input::placeholder {
            color: var(--subtle);
          }

          /* ── Tags / Chips ────────────────────────────────────── */
          .tag {
            display: inline-flex;
            align-items: center;
            padding: 0.125rem 0.5rem;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 500;
            background: var(--accent-bg);
            color: var(--accent);
            border: 1px solid transparent;
          }
          .tag-subtle {
            background: oklch(0% 0 0 / 0.04);
            color: var(--muted);
          }

          /* ── Typography ──────────────────────────────────────── */
          .pixel {
            font-family: 'Press Start 2P', monospace;
            letter-spacing: -0.5px;
          }

          /* ── Focus ───────────────────────────────────────────── */
          button:focus-visible, a:focus-visible, [tabindex]:focus-visible {
            outline: 2px solid var(--accent);
            outline-offset: 2px;
            border-radius: 4px;
          }

          /* ── Scrollbar ────────────────────────────────────────── */
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb {
            background: var(--border);
            border-radius: 4px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: var(--subtle);
          }

          /* ── Article Prose ───────────────────────────────────── */
          article.prose {
            font-family: 'Lora', Georgia, 'Times New Roman', serif;
            font-size: 1.1rem;
            line-height: 1.85;
            color: var(--ink);
          }
          article.prose h2 {
            font-family: 'Playfair Display', Georgia, serif;
            font-size: 1.5rem;
            font-weight: 700;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid var(--accent);
            margin-top: 2.5rem;
            margin-bottom: 1rem;
            letter-spacing: -0.01em;
            color: var(--ink);
          }
          article.prose h3 {
            font-family: 'Playfair Display', Georgia, serif;
            font-size: 1.25rem;
            font-weight: 700;
            margin-top: 1.75rem;
            margin-bottom: 0.75rem;
            color: var(--ink);
          }
          article.prose p {
            margin-bottom: 1rem;
            color: var(--ink-secondary);
          }
          article.prose a {
            color: var(--accent);
            text-decoration: underline;
            text-underline-offset: 3px;
            text-decoration-thickness: 1px;
          }
          article.prose a:hover {
            text-decoration-thickness: 2px;
          }
          article.prose strong {
            color: var(--ink);
            font-weight: 700;
          }
          article.prose blockquote {
            border-left: 3px solid var(--accent);
            padding: 0.75rem 1.25rem;
            margin: 1rem 0;
            background: var(--accent-bg);
            border-radius: 4px;
            font-style: italic;
          }
          article.prose ul, article.prose ol {
            padding-left: 1.5rem;
            margin-bottom: 1rem;
          }
          article.prose li {
            margin-bottom: 0.25rem;
          }
          article.prose table {
            font-family: 'Inter', system-ui, sans-serif;
          }
          article.prose pre,
          article.prose code {
            font-family: 'JetBrains Mono', 'Fira Code', monospace;
          }

          /* ── Generate Page ───────────────────────────────────── */
          .generate-page {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
          }
          .generate-viewer {
            flex: 1;
            display: flex;
            flex-direction: column;
            max-width: 960px;
            width: 100%;
            margin: 0 auto;
            padding: 1rem;
          }
          .generate-header {
            padding: 1rem 0 0.5rem;
            border-bottom: 1px solid var(--border);
            margin-bottom: 1rem;
          }
          .generate-title {
            font-size: 1.25rem;
            font-weight: 600;
            letter-spacing: -0.01em;
            margin: 0 0 1rem;
            word-break: break-word;
          }

          /* Phase Timeline */
          .phase-timeline {
            display: flex;
            align-items: center;
            gap: 0;
            overflow-x: auto;
            padding: 0.75rem 0;
            scrollbar-width: none;
          }
          .phase-timeline::-webkit-scrollbar { display: none; }
          .phase-step {
            display: flex;
            align-items: center;
            gap: 0;
            flex-shrink: 0;
          }
          .phase-node {
            width: 32px;
            height: 32px;
            border: 2px solid var(--border);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: var(--surface-elevated);
            transition: all 0.3s;
            position: relative;
            font-size: 13px;
          }
          .phase-step.done .phase-node {
            background: var(--green);
            border-color: var(--green);
          }
          .phase-step.active .phase-node {
            background: var(--accent);
            border-color: var(--accent);
            box-shadow: 0 0 0 4px var(--accent-bg);
          }
          .phase-step.error .phase-node {
            background: var(--red);
            border-color: var(--red);
          }
          .phase-step:not(.done):not(.active) .phase-node {
            opacity: 0.4;
          }
          .phase-label {
            font-family: 'Inter', system-ui, sans-serif;
            font-size: 0.6875rem;
            font-weight: 500;
            margin-left: 6px;
            white-space: nowrap;
            color: var(--muted);
          }
          .phase-step.done .phase-label { color: var(--green); }
          .phase-step.active .phase-label { color: var(--accent); }
          .phase-step:not(.done):not(.active) .phase-label { opacity: 0.5; }
          .phase-line {
            width: 20px;
            height: 2px;
            background: var(--border);
            margin: 0 4px;
            flex-shrink: 0;
            transition: background 0.3s;
            border-radius: 1px;
          }
          .phase-line.done { background: var(--green); }

          /* Queuing */
          .queuing-banner {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1rem;
            margin-top: 0.75rem;
            background: var(--accent-bg);
            border-radius: 10px;
            font-size: 0.8125rem;
            font-weight: 500;
            color: var(--accent);
          }
          .queuing-spinner {
            width: 14px;
            height: 14px;
            border: 2px solid var(--accent-bg);
            border-top-color: var(--accent);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }

          /* Activity Feed */
          .activity-feed {
            flex: 1;
            overflow-y: auto;
            padding: 0.5rem 0 2rem;
            scroll-behavior: smooth;
          }
          .activity-card {
            display: flex;
            align-items: flex-start;
            gap: 0.75rem;
            padding: 0.75rem;
            margin-bottom: 0.5rem;
            border: 1px solid var(--border);
            border-radius: 10px;
            background: var(--surface-elevated);
            animation: slide-up 0.25s cubic-bezier(0.23, 1, 0.32, 1);
          }
          @keyframes slide-up {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .activity-card.error {
            border-color: var(--red);
            background: var(--red-subtle);
          }
          .activity-card.tool_use {
            border-color: oklch(85% 0.05 200);
            background: oklch(95% 0.03 200);
          }
          .activity-card.tool_result {
            border-color: var(--border-light);
            background: var(--surface);
          }
          .activity-card.text {
            border-color: oklch(88% 0.06 80);
            background: oklch(96% 0.03 80);
          }
          .dark .activity-card.tool_use {
            border-color: oklch(30% 0.05 200);
            background: oklch(20% 0.03 200);
          }
          .dark .activity-card.text {
            border-color: oklch(30% 0.06 80);
            background: oklch(22% 0.03 80);
          }
          .activity-icon {
            font-size: 1.1rem;
            width: 26px;
            height: 26px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .activity-body { flex: 1; min-width: 0; }
          .activity-content {
            font-size: 0.875rem;
            line-height: 1.5;
            word-break: break-word;
          }
          .activity-card.text .activity-content {
            font-style: italic;
            color: var(--muted);
          }
          .activity-meta { margin-top: 0.25rem; }
          .activity-meta code {
            font-size: 0.7rem;
            color: var(--subtle);
            word-break: break-all;
            display: block;
            max-height: 60px;
            overflow: hidden;
          }
          .activity-time {
            font-size: 0.6875rem;
            color: var(--subtle);
            flex-shrink: 0;
            margin-top: 2px;
            font-weight: 450;
          }
          .activity-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            padding: 4rem 1rem;
            text-align: center;
            color: var(--subtle);
            font-size: 0.875rem;
          }
          .empty-pulse {
            width: 20px;
            height: 20px;
            border: 2px solid var(--accent);
            border-radius: 50%;
            opacity: 0.6;
          }

          /* Done banner */
          .done-banner {
            text-align: center;
            padding: 3rem 1rem;
            animation: slide-up 0.5s cubic-bezier(0.23, 1, 0.32, 1);
          }
          .done-icon {
            font-size: 2.5rem;
            margin-bottom: 1rem;
          }
          .done-banner h2 {
            font-size: 1.25rem;
            font-weight: 600;
            margin: 0 0 0.5rem;
            letter-spacing: -0.01em;
          }
          .done-banner p {
            font-size: 0.9375rem;
            color: var(--muted);
            margin: 0 0 1.5rem;
          }
          .done-actions {
            display: flex;
            gap: 0.75rem;
            justify-content: center;
            flex-wrap: wrap;
          }

          /* Inline activity feed inside GenerationBar */
          .activity-feed-inline {
            max-height: 320px;
            overflow-y: auto;
            scroll-behavior: smooth;
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 0.5rem;
            background: var(--surface);
          }
          .done-banner-inline {
            text-align: center;
            padding: 2rem 1rem;
            animation: slide-up 0.5s cubic-bezier(0.23, 1, 0.32, 1);
          }
          .done-banner-inline .done-icon {
            font-size: 2rem;
            margin-bottom: 0.75rem;
          }
          .done-banner-inline h2 {
            font-size: 1.1rem;
            font-weight: 600;
            margin: 0 0 0.5rem;
          }
          .done-banner-inline p {
            font-size: 0.875rem;
            color: var(--muted);
            margin: 0 0 1.25rem;
          }

          /* Skeleton */
          @keyframes shimmer-sweep {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          .skeleton {
            background: linear-gradient(
              90deg,
              var(--skeleton-start) 25%,
              var(--skeleton-end) 50%,
              var(--skeleton-start) 75%
            );
            background-size: 200% 100%;
            animation: shimmer-sweep 1.5s ease-in-out infinite;
            border-radius: 8px;
          }

          /* Streaming cursor */
          .streaming-cursor::after {
            content: "▊";
            animation: cursor-blink 1s ease-in-out infinite;
            color: var(--accent);
            font-weight: 300;
          }
          @keyframes cursor-blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }

          /* Line clamp */
          .line-clamp-2 {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .line-clamp-3 {
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }

          /* Touch targets */
          @media (max-width: 639px) {
            .btn, .btn-sm, .btn-lg, .btn-icon, .btn-ghost {
              min-height: 44px;
            }
            button, a[role="button"], [tabindex][role="button"] {
              min-height: 44px;
            }
          }
        `}</style>
        <ErrorBoundary>
          <QueryProvider>
            <ThemeProvider>
              <FloatingChatProvider>
                <ChatProvider>
                  <HeaderSearchProvider>
                    <AppShell>{children}</AppShell>
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
