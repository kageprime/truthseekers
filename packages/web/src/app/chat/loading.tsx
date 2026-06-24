import ContentCard from "../components/ContentCard";

export default function Loading() {
  return (
    <ContentCard
      header={
        <div className="px-6 py-5 border-b border-border/40">
          <div className="h-5 skeleton w-32" />
        </div>
      }
    >
      <div className="px-6 py-8 space-y-4">
        <div className="h-3 skeleton w-3/4" />
        <div className="h-3 skeleton w-1/2" />
        <div className="h-3 skeleton w-2/3" />
      </div>
    </ContentCard>
  );
}
