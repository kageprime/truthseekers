import ContentCard from "../components/ContentCard";

export default function Loading() {
  return (
    <ContentCard
      header={
        <div className="px-6 py-5 border-b border-border/40">
          <div className="h-5 skeleton w-32" />
          <div className="h-3 skeleton w-48 mt-2" />
        </div>
      }
    >
      <div className="px-6 py-8 space-y-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 skeleton w-24" />
            <div className="h-9 skeleton w-full" />
          </div>
        ))}
      </div>
    </ContentCard>
  );
}
