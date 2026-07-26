import { useStore } from '@nanostores/react'
import { useEffect } from 'react'

import { BrandMark } from '@/components/brand-mark'
import { useI18n } from '@/i18n'
import { $desktopVersion, refreshDesktopVersion } from '@/store/updates'

import { SettingsContent } from './primitives'
import { UninstallSection } from './uninstall-section'

export function AboutSettings() {
  const { t } = useI18n()
  const a = t.settings.about
  const version = useStore($desktopVersion)

  useEffect(() => {
    void refreshDesktopVersion()
  }, [])

  return (
    <SettingsContent>
      <div className="flex flex-col items-center gap-3 pt-6 pb-2 text-center">
        <BrandMark className="size-16" />
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{a.heading}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {version?.appVersion ? a.version(version.appVersion) : a.versionUnavailable}
          </p>
        </div>
      </div>

      <div className="mx-auto mt-4 w-full max-w-2xl">
        <UninstallSection />
      </div>
    </SettingsContent>
  )
}
