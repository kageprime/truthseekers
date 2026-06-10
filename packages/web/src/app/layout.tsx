import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Encarta-NG — The Living Encyclopedia",
  description: "An LLM-powered interactive encyclopedia. Research, write, verify — all by AI agents.",
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
        `}</style>
        {children}
      </body>
    </html>
  );
}
