"use client";
import { usePathname } from "next/navigation";
import RetroWindow from "./RetroWindow";
import RetroContentsNav from "./RetroContentsNav";
import { canSeeAdmin } from "@/lib/routes";
import { useAuth } from "../../hooks/useAuth";

// ponytail: global retro shell — shared contents nav + content pane. Wide mode skips the 960px cap for atlas pages.
export default function RetroShell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const showAdmin = canSeeAdmin(user?.role);
  return (
    <RetroWindow title={`TruthSeekers — ${pathname}`} path={pathname} status="TruthSeekers • Ready">
      <RetroContentsNav pathname={pathname} showAdmin={showAdmin} />
      <div className="flex-1 min-w-0 bg-[#efe9d5] flex flex-col min-h-0">
        <div className="bg-white border-[3px] m-1.5 sm:m-2 flex-1 overflow-auto r-scroll min-h-0" style={{ borderStyle: "inset", borderWidth: 3, borderColor: "#8a7f68 #fff8e0 #fff8e0 #8a7f68" }}>
          <div className={`${wide ? "" : "max-w-[960px] "}mx-auto p-3 sm:p-8`}>{children}</div>
        </div>
      </div>
    </RetroWindow>
  );
}
