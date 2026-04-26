"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Mail, User, Calendar } from "lucide-react"
import { useLanguage, useT } from "@/lib/i18n/context"

interface AboutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const INFO = {
  ko: {
    title: "LAYOUTNEMO 정보",
    tagline: "만들고, 잇고, 펼쳐놓으세요.",
    description:
      "LAYOUTNEMO는 업무를 리스트에 욱여넣는 대신, 캔버스 위에 자유롭게 펼쳐놓는 사고 공간입니다. 네모난 블럭을 만들고, 가까이 놓아 잇고, 결로 맥락을 나눠 정리합니다.",
    developer: "개발자",
    email: "이메일",
    year: "개발 연도",
    website: "웹사이트",
    feedback: "피드백 보내기",
    close: "닫기",
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
