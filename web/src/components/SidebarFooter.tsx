import { useEffect, useState } from "react";
import { Typography } from "@nous-research/ui/ui/components/typography/index";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import {
  shouldShowUpdateDot,
  versionLabel,
  versionTooltip,
  type LyraVersion,
} from "@/lib/lyra-version";

export function SidebarFooter() {
  const { t } = useI18n();
  // Lyra's own version, not `status.version` — that one reports the upstream
  // CLI this is built on, which is not the product the user is running.
  const [lyra, setLyra] = useState<LyraVersion | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getLyraVersion()
      .then((payload) => {
        if (active) setLyra(payload as LyraVersion);
      })
      .catch(() => {
        // A version badge must never be able to break the sidebar.
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-between gap-2",
        "px-5 py-2.5",
        "border-t border-current/10",
      )}
    >
      <Typography
        className="font-mono-ui flex items-center gap-1.5 text-xs tabular-nums tracking-[0.08em] text-text-tertiary lowercase"
        title={versionTooltip(lyra)}
      >
        {versionLabel(lyra)}
        {shouldShowUpdateDot(lyra) && (
          <span
            aria-label="Update available"
            role="status"
            className="inline-block h-1.5 w-1.5 rounded-full bg-warning"
          />
        )}
      </Typography>

      <span
        className={cn(
          "font-sans text-display text-xs tracking-[0.12em] text-midground",
        )}
      >
        {t.app.brand}
      </span>
    </div>
  );
}
