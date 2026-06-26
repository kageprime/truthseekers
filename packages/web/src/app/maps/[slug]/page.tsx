"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";

const AtlasMap = dynamic(() => import("../../components/AtlasAntiquaMap"), { ssr: false });

export default function MapDetailPage() {
  const params = useParams();
  const [slug, setSlug] = useState<string>("");

  useEffect(() => {
    if (params?.slug) setSlug(params.slug as string);
  }, [params]);

  return <AtlasMap focusSlug={slug} />;
}
