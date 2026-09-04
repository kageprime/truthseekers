import { BASE } from "@/lib/constants";
import type { Article } from "@encarta/core";

interface ClaimReviewJsonLdProps {
  slug: string;
  article: Article;
  claims: Array<{
    id: string;
    text: string;
    status?: string;
    derived_confidence?: number;
  }>;
}

export default function ClaimReviewJsonLd({ slug, article, claims }: ClaimReviewJsonLdProps) {
  if (!claims || claims.length === 0) return null;

  const url = `${BASE.replace(/\/$/, "")}/article/${slug}`;
  const items = claims
    .filter((c) => c.text)
    .slice(0, 50)
    .map((c) => ({
      "@type": "ClaimReview",
      url,
      claimReviewed: c.text,
      title: c.text.slice(0, 120),
      reviewRating: {
        "@type": "Rating",
        ratingValue: c.derived_confidence != null ? Math.round(c.derived_confidence * 5 * 100) / 100 : 0,
        bestRating: 5,
        worstRating: 0,
        description: c.status || "unknown",
      },
      datePublished: article.metadata?.updated || article.metadata?.created || new Date().toISOString(),
      author: { "@type": "Organization", name: "Truthseekers", url: BASE },
    }));

  const payload = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.abstract,
    url,
    datePublished: article.metadata?.created || new Date().toISOString(),
    dateModified: article.metadata?.updated || new Date().toISOString(),
    author: { "@type": "Organization", name: "Truthseekers", url: BASE },
    publisher: { "@type": "Organization", name: "Truthseekers", url: BASE },
    hasPart: items,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
