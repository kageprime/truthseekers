import type { MetadataRoute } from "next";
import { BASE } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/admin/", "/onboarding/", "/settings/", "/queue/"] },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
