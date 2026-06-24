import ContentCard from "../components/ContentCard";

export default function Loading() {
  return (
    <ContentCard
      header={
        <div className="px-6 py-5 border-b border-border/40">
          <div className="h-5 skeleton w-24" />
        </div>
      }
    >
      <div className="px-6 py-8 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 skeleton w-1/3" />
            <div className="h-12 skeleton w-full" />
          </div>
        ))}
      </div>
    </ContentCard>
  );
}
