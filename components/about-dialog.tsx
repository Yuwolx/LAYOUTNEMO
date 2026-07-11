"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Mail, User, Calendar, MonitorSmartphone } from "lucide-react"
import { useLanguage, useT } from "@/lib/i18n/context"
import { usePWAInstall } from "@/lib/pwa/install-prompt"

interface AboutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const INFO = {
  ko: {
    title: "LAYOUTNEMO 정보",
    tagline: "만들고, 잇고, 펼쳐놓으세요.",
    description:
      "LAYOUTNEMO는 업무를 리스트의 틀에 맞추는 대신, 캔버스 위에 자유롭게 펼쳐놓는 사고 공간입니다. 네모난 블럭을 만들고, 가까이 놓아 잇고, 결로 맥락을 나눠 정리합니다.",
    developer: "개발자",
    email: "이메일",
    year: "개발 연도",
    website: "웹사이트",
    feedback: "피드백 보내기",
    close: "닫기",
    installTitle: "앱으로 설치",
    installDesc: "홈 화면에 추가하면 주소창 없는 전체화면 앱으로 실행되고, 오프라인에서도 열립니다.",
    installButton: "앱으로 설치",
    installIOS: "Safari 하단의 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택하세요.",
  },
  en: {
    title: "About LAYOUTNEMO",
    tagline: "Make. Connect. Layout.",
    description:
      "LAYOUTNEMO is a thinking space where you spread work out freely on a canvas instead of forcing it into lists. Create square blocks, connect them by placing them close together, and organize context with facets.",
    developer: "Developer",
    email: "Email",
    year: "Year",
    website: "Website",
    feedback: "Send feedback",
    close: "Close",
    installTitle: "Install as app",
    installDesc: "Add it to your home screen to run full-screen without the address bar, and open it offline.",
    installButton: "Install app",
    installIOS: "Tap Safari’s Share button, then choose “Add to Home Screen”.",
  },
} as const

const DEVELOPER = "Hyukjun Kwon (권혁준)"
const EMAIL = "yuwolxx@gmail.com"
const YEAR = "2025"
const WEBSITE = "https://layoutnemo.com"

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const { language } = useLanguage()
  const t = useT()
  const info = INFO[language]
  const { canPrompt, isIOS, isStandalone, promptInstall } = usePWAInstall()
  // 이미 앱으로 실행 중이거나, 원클릭 프롬프트도 iOS 안내도 못 주는 브라우저면 섹션 숨김.
  const showInstall = !isStandalone && (canPrompt || isIOS)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-light">{info.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div>
            <h3 className="text-lg font-normal mb-1">LAYOUTNEMO</h3>
            <p className="text-sm text-muted-foreground font-light mb-3">{info.tagline}</p>
            <p className="text-sm leading-relaxed text-foreground/80">{info.description}</p>
          </div>

          {showInstall && (
            <div className="pt-2 border-t border-border/30">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-foreground/70">
                  <MonitorSmartphone className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 text-sm leading-relaxed">
                  <p className="font-semibold text-foreground">{info.installTitle}</p>
                  <p className="text-foreground/65">{info.installDesc}</p>
                  {canPrompt ? (
                    <Button size="sm" className="mt-2.5" onClick={promptInstall}>
                      {info.installButton}
                    </Button>
                  ) : (
                    <p className="mt-1.5 text-xs text-muted-foreground">{info.installIOS}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2.5 pt-2 border-t border-border/30">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{info.developer}:</span>
              <span>{DEVELOPER}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{info.email}:</span>
              <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">
                {EMAIL}
              </a>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">{info.year}:</span>
              <span>{YEAR}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-4 h-4" />
              <span className="text-muted-foreground">{info.website}:</span>
              <a href={WEBSITE} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                {WEBSITE}
              </a>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button asChild variant="outline" className="flex-1">
              <a href={`mailto:${EMAIL}`}>
                <Mail className="w-4 h-4 mr-2" />
                {info.feedback}
              </a>
            </Button>
            <Button onClick={() => onOpenChange(false)} className="flex-1">
              {info.close}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
