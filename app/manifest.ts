import type { MetadataRoute } from "next"

// PWA 웹 앱 매니페스트 — Next.js 가 /manifest.webmanifest 로 서빙하고 <head> 에 자동 연결한다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LAYOUTNEMO — 캔버스 위 사고 공간",
    short_name: "LAYOUTNEMO",
    description:
      "캔버스 위에 펼쳐놓는 사고 공간. 블럭을 만들고, 결로 맥락을 나누고, 가까이 두면 자동으로 이어집니다.",
    id: "/",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    // 라이트 모드 캔버스 배경과 동일 — 스플래시/타이틀바 색. (다크 전환은 런타임에서)
    background_color: "#fafaf9",
    theme_color: "#fafaf9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
