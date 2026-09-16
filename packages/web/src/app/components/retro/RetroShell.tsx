"use client";
import { usePathname } from "next/navigation";
import RetroWindow from "./RetroWindow";
import RetroContentsNav from "./RetroContentsNav";
import GlobalRightSidebar from "../GlobalRightSidebar";
import { canSeeAdmin } from "@/lib/routes";
import { useAuth } from "../../hooks/useAuth";
import { useUiSettings } from "../../context/UiSettingsContext";

export default function RetroShell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { settings } = useUiSettings();
  const showAdmin = canSeeAdmin(user?.role);

  return (
    <RetroWindow title={`TruthSeekers — ${pathname}`} path={pathname} status="TruthSeekers • Ready">
      {settings.showLeftNav && <RetroContentsNav pathname={pathname} showAdmin={showAdmin} />}
      <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-[var(--r-surface)] rounded-[var(--r-radius)] transition-colors duration-200">
        <div className="r-doc m-1 sm:m-2 flex-1 overflow-auto r-scroll min-h-0 p-3 sm:p-8">
          <div className={`${wide ? "" : "max-w-[980px] "}mx-auto`}>{children}</div>
        </div>
      </div>
      {settings.showRightRail && <GlobalRightSidebar />}
    </RetroWindow>
  );
}
