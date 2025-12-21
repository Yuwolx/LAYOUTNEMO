# 로컬 환경 설정 가이드

## 1. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가하세요:

```env
OPENAI_API_KEY=your-openai-api-key-here
```

### OpenAI API 키 받는 방법

1. https://platform.openai.com 접속
2. 계정 생성 또는 로그인
3. https://platform.openai.com/api-keys 에서 "Create new secret key" 클릭
4. 생성된 키를 복사하여 `.env.local`에 붙여넣기

**참고:** API 키는 한 번만 표시되므로 반드시 즉시 복사하세요.

## 2. 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 브라우저에서 http://localhost:3000 접속
```

## 3. 비용 정보

현재 사용하는 모델: **gpt-4o-mini** (매우 저렴)

- 입력: $0.15 / 1M tokens
- 출력: $0.60 / 1M tokens
- 블록 하나 만들기: 약 $0.0001~0.0003
- 정리하기 한 번: 약 $0.001~0.002

일반적인 사용으로는 월 $1~5 정도 예상됩니다.

## 4. 문제 해결

### localStorage is not defined 에러
- Next.js의 SSR 중에 발생하는 에러입니다
- 이미 수정되어 있으므로 최신 코드를 사용하세요

### 예시 블록이 안 보임
- 브라우저 localStorage를 지우고 새로고침하세요
- 개발자 도구 → Application → Local Storage → localhost:3000 → 모두 삭제

### AI 기능이 작동하지 않음
- `.env.local` 파일이 제대로 생성되었는지 확인
- OPENAI_API_KEY가 올바른지 확인
- 개발 서버를 재시작하세요 (npm run dev)

## 5. 데이터 저장

- 모든 데이터는 브라우저의 localStorage에 저장됩니다
- 백엔드 서버나 데이터베이스는 필요하지 않습니다
- 브라우저 캐시를 지우면 데이터가 사라지므로 주의하세요

## 6. 프로덕션 빌드

```bash
# 프로덕션 빌드
npm run build

# 빌드된 앱 실행
npm start
```

## 7. Vercel 배포 (선택사항)

로컬에서 테스트 후 Vercel에 배포하려면:

1. Vercel 계정 생성
2. GitHub에 코드 푸시
3. Vercel에서 프로젝트 Import
4. 환경 변수에 OPENAI_API_KEY 추가
5. 자동 배포 완료
```
