"use client";

interface FactItem {
  label: string;
  value: string;
}

interface InfoboxCardProps {
  title?: string;
  subtitle?: string;
  gradient?: string;
  facts?: FactItem[];
}

export default function InfoboxCard({
  title = "Infobox",
  subtitle = "Corpus Infobox",
  gradient = "from-zinc-900 via-zinc-800 to-zinc-900",
  facts = [],
}: InfoboxCardProps) {
  if (!facts || facts.length === 0) return null;
  return (
    <div className="rounded-2xl overflow-hidden border border-zinc-200 bg-white shadow-xs my-6">
      {/* Header Plate */}
      <div className={`h-28 sm:h-32 bg-gradient-to-br ${gradient} p-5 sm:p-6 flex flex-col justify-end text-white relative`}>
        <span className="text-[10px] font-mono tracking-widest uppercase opacity-75 font-semibold">
          {subtitle}
        </span>
        <h3 className="text-base sm:text-lg font-bold tracking-tight text-white mt-1">
          {title}
        </h3>
      </div>

      {/* Facts Grid */}
      <div className="p-5 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#FEFDF8] text-xs border-t border-zinc-100">
        {facts.map((f, i) => (
          <div key={i} className="space-y-0.5">
            <div className="text-[10px] font-mono uppercase text-zinc-400 font-semibold tracking-wider">
              {f.label}
            </div>
            <div className="font-bold text-zinc-900 text-xs sm:text-sm truncate">
              {f.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
