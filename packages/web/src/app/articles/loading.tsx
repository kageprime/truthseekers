import ContentCard from "../components/ContentCard";
import { CardGridSkeleton } from "../components/CardSkeleton";

export default function Loading() {
  return (
    <ContentCard
      header={
        <div className="px-6 py-5 border-b border-border/40">
          <div className="h-5 skeleton w-48" />
          <div className="h-3 skeleton w-72 mt-2" />
        </div>
      }
    >
      <div className="p-4 sm:p-6">
        <CardGridSkeleton count={6} />
      </div>
    </ContentCard>
  );
}
