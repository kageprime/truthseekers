"use client";

const GRADIENTS: Record<string, string> = {
  blue: "from-[#0c4a6e] via-[#0284c7] to-[#7dd3fc]",
  green: "from-[#065f46] via-[#059669] to-[#6ee7b7]",
};

export default function PageHero({
  title,
  subtitle,
  gradient = "blue",
  waveColor = "var(--surface)",
  children,
}: {
  title: string;
  subtitle?: string;
  gradient?: "blue" | "green";
  waveColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={`relative overflow-hidden bg-gradient-to-b ${GRADIENTS[gradient]}`}>
      <div className="relative z-10 py-16 md:py-20 text-center">
        <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold tracking-tighter text-white mb-2 drop-shadow-lg">
          {title}
        </h1>
        {subtitle && (
          <p className="text-lg text-[#e0f2fe] tracking-wide font-medium">
            {subtitle}
          </p>
        )}
        {children && (
          <div className="mt-6 max-w-2xl mx-auto px-4">
            {children}
          </div>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-16 md:h-24 overflow-hidden pointer-events-none">
        <svg className="absolute bottom-0 w-[200%] h-full wave-anim" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M0,60 C200,100 400,20 600,60 C800,100 1000,20 1200,60 L1200,120 L0,120 Z" fill={waveColor} />
        </svg>
      </div>
    </header>
  );
}
