import type { Metadata, Viewport } from "next";
import "./globals.css";
import ErrorBoundary from "./components/ErrorBoundary";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fffaf0",
};

export const metadata: Metadata = {
  title: "Truthseekers — The Living Encyclopedia",
  description: "An LLM-powered interactive encyclopedia. Research, write, verify — all by AI agents.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "Truthseekers", statusBarStyle: "default" },
  icons: [
    { rel: "icon", url: "/favicon.ico" },
    { rel: "apple-touch-icon", url: "/apple-icon.png" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700;900&family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased" style={{ margin: 0 }}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-white focus:border-2 focus:border-black focus:text-sm focus:pixel" style={{ color: "var(--ink)" }}>
          Skip to main content
        </a>
        <style>{`
          :root {
            --ink: #1c1917;
            --warm: #fffaf0;
            --orange: #ea580c;
            --gold: #f59e0b;
            --blue: #0c4a6e;
            --sky: #7dd3fc;
            --green: #22c55e;
            --red: #dc2626;
            --purple: #a21caf;
            --pink: #ec4899;
            --cream: #fef3c7;
            --ice: #e0f2fe;
            --muted: #5f6368;
            --subtle: #9aa0a6;
            --border: #dadce0;
            --skeleton: #f1f3f4;
            --hover: #f5f5f4;
          }
          * { box-sizing: border-box; }
          body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--warm);
            color: var(--ink);
            background-image: radial-gradient(#f5d0a9 1px, transparent 1px);
            background-size: 24px 24px;
          }
          .pixel {
            font-family: 'Press Start 2P', monospace;
            letter-spacing: -0.5px;
          }
          .pixel-card {
            border: 3px solid var(--ink);
            box-shadow: 6px 6px 0px var(--ink);
            transition: all 0.15s ease-out;
            background: white;
          }
          .pixel-card:hover {
            transform: translate(-3px, -3px);
            box-shadow: 9px 9px 0px var(--ink);
          }
          .pixel-card:active {
            transform: translate(2px, 2px);
            box-shadow: 3px 3px 0px var(--ink);
          }
          .pixel-card-sm {
            border: 2px solid var(--ink);
            box-shadow: 4px 4px 0px var(--ink);
            transition: all 0.12s ease-out;
            background: white;
          }
          .pixel-card-sm:hover {
            transform: translate(-2px, -2px);
            box-shadow: 6px 6px 0px var(--ink);
          }
          .pixel-btn {
            font-family: 'Press Start 2P', monospace;
            font-size: 10px;
            padding: 0.6rem 1.2rem;
            border: 2px solid var(--ink);
            box-shadow: 3px 3px 0px var(--ink);
            cursor: pointer;
            transition: all 0.1s ease-out;
            text-transform: uppercase;
          }
          .pixel-btn:hover {
            transform: translate(-1px, -1px);
            box-shadow: 5px 5px 0px var(--ink);
          }
          .pixel-btn:active {
            transform: translate(2px, 2px);
            box-shadow: 1px 1px 0px var(--ink);
          }
          .pixel-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
          }
          .btn-primary {
            font-family: 'Press Start 2P', monospace;
            font-size: 10px;
            text-transform: uppercase;
            padding: 0.6rem 1.2rem;
            border: 2px solid var(--ink);
            box-shadow: 3px 3px 0px var(--ink);
            background: var(--orange);
            color: white;
            cursor: pointer;
            transition: all 0.1s ease-out;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.25rem;
            min-height: 44px;
            line-height: 1;
            text-decoration: none;
          }
          .btn-primary:hover {
            transform: translate(-1px, -1px);
            box-shadow: 5px 5px 0px var(--ink);
          }
          .btn-primary:active {
            transform: translate(2px, 2px);
            box-shadow: 1px 1px 0px var(--ink);
          }
          .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
            box-shadow: 1px 1px 0px var(--ink);
          }
          .btn-primary[data-color="green"] { background: var(--green); }
          .btn-primary[data-color="blue"] { background: var(--blue); }
          .btn-primary[data-color="red"] { background: var(--red); }
          .btn-sm {
            font-size: 8px;
            padding: 0.4rem 0.8rem;
            min-height: 36px;
          }
          @media (min-width: 640px) {
            .btn-sm { min-height: auto; }
            .btn-primary { min-height: auto; }
          }
          .btn-lg {
            font-size: 12px;
            padding: 0.8rem 1.6rem;
          }
          .btn-secondary {
            font-family: 'Press Start 2P', monospace;
            font-size: 10px;
            text-transform: uppercase;
            padding: 0.6rem 1.2rem;
            border: 2px solid var(--ink);
            box-shadow: 3px 3px 0px var(--ink);
            background: white;
            color: var(--ink);
            cursor: pointer;
            transition: all 0.1s ease-out;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.25rem;
            min-height: 44px;
            line-height: 1;
            text-decoration: none;
          }
          .btn-secondary:hover {
            transform: translate(-1px, -1px);
            box-shadow: 5px 5px 0px var(--ink);
          }
          .btn-secondary:active {
            transform: translate(2px, 2px);
            box-shadow: 1px 1px 0px var(--ink);
          }
          .btn-secondary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
          }
          @media (min-width: 640px) {
            .btn-secondary { min-height: auto; }
          }
          .btn-ghost {
            font-family: 'Press Start 2P', monospace;
            font-size: 8px;
            background: transparent;
            border: none;
            cursor: pointer;
            color: var(--muted);
            transition: color 0.1s;
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          .btn-ghost:hover { color: var(--ink); }
          button:focus-visible, a:focus-visible, [tabindex]:focus-visible {
            outline: 2px solid var(--orange);
            outline-offset: 2px;
          }
          .pixel-input {
            font-family: 'Outfit', sans-serif;
            padding: 0.75rem 1rem;
            border: 3px solid var(--ink);
            box-shadow: 4px 4px 0px var(--ink);
            outline: none;
            font-size: 1rem;
            width: 100%;
            background: white;
            transition: box-shadow 0.1s;
          }
          .pixel-input:focus {
            box-shadow: 6px 6px 0px var(--orange);
            border-color: var(--ink);
          }
          .pixel-tag {
            display: inline-block;
            font-size: 0.75rem;
            padding: 0.2rem 0.6rem;
            border: 2px solid var(--ink);
            background: var(--cream);
            box-shadow: 2px 2px 0px var(--ink);
            font-weight: 500;
          }
          .pixel-section-header {
            font-family: 'Press Start 2P', monospace;
            font-size: 1rem;
            padding: 0.75rem 1.5rem;
            border: 3px solid var(--ink);
            box-shadow: 5px 5px 0px rgba(0,0,0,0.15);
            display: inline-block;
            margin-bottom: 1.5rem;
          }
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
          }
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          @keyframes wave {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          @keyframes wave-drift-1 { 0% { transform: translateX(0); } 100% { transform: translateX(-33.33%); } }
          @keyframes wave-drift-2 { 0% { transform: translateX(0); } 100% { transform: translateX(-33.33%); } }
          @keyframes wave-drift-3 { 0% { transform: translateX(0); } 100% { transform: translateX(-33.33%); } }
          .wave-1 { animation: wave-drift-1 22s ease-in-out infinite; }
          .wave-2 { animation: wave-drift-2 16s ease-in-out infinite; }
          .wave-3 { animation: wave-drift-3 11s ease-in-out infinite; }
          @media (max-width: 639px) {
            .wave-anim { animation: wave 24s linear infinite; }
          }
          @media (min-width: 640px) {
            .wave-anim { animation: wave 12s linear infinite; }
          }
          .float-anim { animation: float 4s ease-in-out infinite; }
          .line-clamp-3 {
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          ::-webkit-scrollbar { width: 10px; }
          ::-webkit-scrollbar-track { background: #fed7aa; }
          ::-webkit-scrollbar-thumb { background: var(--orange); border: 2px solid var(--ink); }

          article.prose h2 {
            font-family: 'Press Start 2P', monospace;
            font-size: 0.8rem;
            padding-bottom: 0.5rem;
            border-bottom: 3px solid var(--ink);
            margin-top: 2.5rem;
            margin-bottom: 1rem;
          }
          article.prose p {
            line-height: 1.8;
            font-size: 1.05rem;
            margin-bottom: 1rem;
          }
          article.prose a {
            color: var(--orange);
            font-weight: 600;
            text-decoration: underline;
            text-underline-offset: 3px;
          }
          article.prose strong {
            color: var(--ink);
          }
          article.prose blockquote {
            border-left: 4px solid var(--orange);
            padding: 0.75rem 1rem;
            margin: 1rem 0;
            background: var(--cream);
          }

          /* ── Generate Page ─────────────────────────────────── */
          @keyframes breathe {
            0%, 100% { opacity: 0.4; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.02); }
          }
          @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 0 8px var(--orange); }
            50% { box-shadow: 0 0 20px var(--orange), 0 0 40px rgba(234,88,12,0.3); }
          }
          @keyframes slide-up {
            from { opacity: 0; transform: translateY(16px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes page-enter {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .page-enter { animation: page-enter 0.3s ease-out both; }
          @keyframes slide-in-main {
            from { opacity: 0; transform: translateX(24px); }
            to { opacity: 1; transform: translateX(0); }
          }
          .chat-enter { animation: slide-in-main 0.35s ease-out both; }
          @keyframes shimmer-bar {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          @keyframes spin-slow {
            to { transform: rotate(360deg); }
          }

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
            border-bottom: 2px solid var(--ink);
            margin-bottom: 1rem;
          }
          .generate-title {
            font-family: 'Press Start 2P', monospace;
            font-size: 1rem;
            text-transform: uppercase;
            margin: 0 0 1rem;
            letter-spacing: 0.5px;
            word-break: break-word;
          }

          /* Phase Timeline */
          .phase-timeline {
            display: flex;
            align-items: center;
            gap: 0;
            overflow-x: auto;
            padding: 0.5rem 0;
          }
          .phase-step {
            display: flex;
            align-items: center;
            gap: 0;
            flex-shrink: 0;
          }
          .phase-node {
            width: 36px;
            height: 36px;
            border: 2px solid var(--ink);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: white;
            transition: all 0.3s;
            position: relative;
          }
          .phase-step.done .phase-node {
            background: var(--green);
            border-color: var(--green);
            animation: none;
          }
          .phase-step.active .phase-node {
            background: var(--orange);
            border-color: var(--orange);
            animation: pulse-glow 2s ease-in-out infinite;
          }
          .phase-step.error .phase-node {
            background: var(--red);
            border-color: var(--red);
          }
          .phase-step:not(.done):not(.active) .phase-node {
            opacity: 0.4;
          }
          .phase-icon {
            font-size: 14px;
            line-height: 1;
          }
          .phase-label {
            font-family: 'Press Start 2P', monospace;
            font-size: 7px;
            margin-left: 4px;
            white-space: nowrap;
            color: var(--ink);
            width: 0;
            overflow: visible;
          }
          .phase-step.done .phase-label { color: var(--green); }
          .phase-step.active .phase-label { color: var(--orange); }
          .phase-step:not(.done):not(.active) .phase-label { opacity: 0.4; }
          .phase-line {
            width: 24px;
            height: 2px;
            background: #ccc;
            margin: 0 4px;
            flex-shrink: 0;
            transition: background 0.3s;
          }
          .phase-line.done { background: var(--green); }

          /* Queuing */
          .queuing-banner {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1rem;
            margin-top: 0.75rem;
            border: 2px solid var(--ink);
            background: var(--cream);
            font-family: 'Press Start 2P', monospace;
            font-size: 8px;
          }
          .queuing-spinner {
            width: 12px;
            height: 12px;
            border: 2px solid var(--ink);
            border-top-color: var(--orange);
            border-radius: 50%;
            animation: spin-slow 0.8s linear infinite;
          }

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
            border: 2px solid var(--ink);
            background: white;
            animation: slide-up 0.3s ease-out;
          }
          .activity-card.error {
            border-color: var(--red);
            background: #fef2f2;
          }
          .activity-card.tool_use {
            border-color: #bae6fd;
            background: #f0f7ff;
          }
          .activity-card.tool_result {
            border-color: var(--border);
            background: #fafafa;
          }
          .activity-card.text {
            border-color: #fde68a;
            background: #fff8e1;
          }
          .activity-icon {
            font-size: 1.2rem;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
          }
          .activity-body {
            flex: 1;
            min-width: 0;
          }
          .activity-content {
            font-size: 0.9rem;
            line-height: 1.5;
            word-break: break-word;
          }
          .activity-card.text .activity-content {
            font-style: italic;
            color: #444;
          }
          .activity-meta {
            margin-top: 0.25rem;
          }
          .activity-meta code {
            font-size: 0.7rem;
            color: #666;
            word-break: break-all;
            display: block;
            max-height: 60px;
            overflow: hidden;
          }
          .activity-time {
            font-family: 'Press Start 2P', monospace;
            font-size: 7px;
            color: #aaa;
            flex-shrink: 0;
            margin-top: 2px;
          }
          .activity-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            padding: 4rem 1rem;
            text-align: center;
            color: #9aa0a6;
            font-family: 'Press Start 2P', monospace;
            font-size: 8px;
          }
          .empty-pulse {
            width: 24px;
            height: 24px;
            border: 3px solid var(--orange);
            border-radius: 50%;
            animation: breathe 2s ease-in-out infinite;
          }

          /* Done banner */
          .done-banner {
            text-align: center;
            padding: 3rem 1rem;
            animation: slide-up 0.5s ease-out;
          }
          .done-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
            animation: breathe 2s ease-in-out infinite;
          }
          .done-banner h2 {
            font-family: 'Press Start 2P', monospace;
            font-size: 1rem;
            margin: 0 0 0.5rem;
          }
          .done-banner p {
            font-size: 1rem;
            color: #5f6368;
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
            border: 2px solid var(--ink);
            padding: 0.5rem;
            background: #fafafa;
          }
          .done-banner-inline {
            text-align: center;
            padding: 2rem 1rem;
            animation: slide-up 0.5s ease-out;
          }
          .done-banner-inline .done-icon {
            font-size: 2.5rem;
            margin-bottom: 0.75rem;
            animation: breathe 2s ease-in-out infinite;
          }
          .done-banner-inline h2 {
            font-family: 'Press Start 2P', monospace;
            font-size: 0.9rem;
            margin: 0 0 0.5rem;
          }
          .done-banner-inline p {
            font-size: 0.95rem;
            color: #5f6368;
            margin: 0 0 1.25rem;
          }

          @media (max-width: 639px) {
            .generate-title { font-size: 0.75rem; }
            .phase-node { width: 28px; height: 28px; }
            .phase-icon { font-size: 11px; }
            .phase-label { font-size: 6px; }
            .phase-line { width: 14px; }
            .btn-sm, .btn-lg { min-height: 44px !important; }
            .btn-ghost { min-height: 44px; }
            button, a[role="button"], [tabindex][role="button"] { min-height: 44px; }
          }
          @media (min-width: 640px) {
            .btn-lg { min-height: auto; }
          }
          .footer-text { font-size: 8px; }
          @media (min-width: 640px) { .footer-text { font-size: 8px; } }
        `}</style>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
