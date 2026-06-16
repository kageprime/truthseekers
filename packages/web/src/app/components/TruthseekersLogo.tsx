import Link from "next/link";

export default function TruthseekersLogo({ variant = "full", size = 40 }: { variant?: "full" | "icon" | "text"; size?: number }) {
  const src = variant === "full" ? "/logo.png" : variant === "icon" ? "/logo-icon.png" : "/logo-text.png";

  return (
    <Link href="/" className="flex items-center gap-2 group" style={{ textDecoration: "none" }}>
      <img src={src} alt="Truthseekers" height={size} style={{ height: size, width: "auto", objectFit: "contain" }} />
    </Link>
  );
}
