import type { Metadata } from "next";
import GenerateViewer from "@/app/components/GenerateViewer";

export const metadata: Metadata = {
  title: "Generating Article — Truthseekers",
};

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function GeneratePage({ params }: Props) {
  const { slug } = await params;
  const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="generate-page">
      <GenerateViewer slug={slug} />
    </div>
  );
}
