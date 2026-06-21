# BaroName Setup and Deploy Guide

작성일: 2026-06-21

이 문서는 비개발자 기준으로 BaroName을 로컬에서 실행하고, GitHub를 거쳐 Vercel에 배포하는 방법을 설명한다.

## 1. 현재 앱 구조

BaroName은 Next.js 웹앱이다.

포함된 기능:

- 비밀번호 잠금 화면
- Gemini API 서버 호출
- 영어 우선 글로벌 네이밍 후보 12개 생성
- 후보 카드, 점수, 리스크, 발음 표시
- 후보 저장(Picks)
- 선택 후보 비교
- 후보 기반 변주 생성
- 프로젝트 로컬 저장
- JSON/TXT/CSV 내보내기
- JSON 가져오기

Gemini는 SDK를 설치하지 않고 공식 REST API로 호출한다. 그래서 별도의 Gemini SDK 설치는 필요 없다.

## 2. 준비물

필요한 것:

- Node.js
- Google 계정
- Gemini API Key
- GitHub 계정
- Vercel 계정

현재 PC에는 Node.js가 설치되어 있지만, 터미널 PATH에 잡히지 않을 수 있다. 이 경우 명령어 앞에 아래 경로를 사용하면 된다.

```powershell
& 'C:\Program Files\nodejs\npm.cmd'
& 'C:\Program Files\nodejs\node.exe'
```

## 3. 로컬 실행 방법

PowerShell에서 아래 폴더로 이동한다.

```powershell
cd C:\Users\JUNE\Documents\GitHub\widget\BaroName
```

패키지를 설치한다.

```powershell
& 'C:\Program Files\nodejs\npm.cmd' install
```

설치가 끝나면 `.env.local` 파일을 만든다.

`BaroName` 폴더 안에 새 파일을 만들고 이름을 정확히 아래처럼 지정한다.

```text
.env.local
```

내용은 아래처럼 넣는다.

```text
GEMINI_API_KEY=여기에_구글_Gemini_API_키
APP_PASSWORD=내가_접속할_때_쓸_비밀번호
SESSION_SECRET=아무도_모를_긴_랜덤_문자열
GEMINI_MODEL=gemini-3.5-flash
GENERATION_COOLDOWN_SECONDS=8
```

예시:

```text
GEMINI_API_KEY=AIzaSy...
APP_PASSWORD=my-private-baroname-password
SESSION_SECRET=baroname-long-secret-please-change-this-2026
GEMINI_MODEL=gemini-3.5-flash
GENERATION_COOLDOWN_SECONDS=8
```

앱을 실행한다.

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

터미널에 주소가 나오면 브라우저에서 연다.

보통 아래 주소다.

```text
http://localhost:3000
```

처음 화면에서 `APP_PASSWORD`에 넣은 비밀번호를 입력하면 앱에 들어갈 수 있다.

## 4. Gemini 무료 티어 API 키 받는 방법

1. 브라우저에서 Google AI Studio에 접속한다.

   https://aistudio.google.com/

2. Google 계정으로 로그인한다.

3. 왼쪽 또는 상단 메뉴에서 `Get API key` 또는 `API keys`를 찾는다.

4. `Create API key`를 누른다.

5. Google Cloud 프로젝트를 선택하라는 화면이 나오면 새 프로젝트를 만들거나 기존 프로젝트를 선택한다.

6. 생성된 API 키를 복사한다.

7. 복사한 키를 `.env.local`의 `GEMINI_API_KEY=` 뒤에 붙여넣는다.

주의:

- API 키는 절대 GitHub에 올리면 안 된다.
- `.env.local`은 `.gitignore`에 포함되어 있어 GitHub에 올라가지 않도록 설정되어 있다.
- 무료 티어의 실제 사용 한도는 모델과 프로젝트 상태에 따라 달라진다.
- 한도가 걸리면 앱에 rate limit 메시지가 표시될 수 있다. 이 경우 잠시 후 다시 생성하면 된다.

공식 문서:

- https://ai.google.dev/gemini-api/docs/rate-limits
- https://ai.google.dev/gemini-api/docs/pricing

## 5. Vercel 배포 방법

### 5.1 GitHub에 올리기

GitHub Desktop을 쓰는 경우:

1. GitHub Desktop을 연다.
2. 현재 저장소 `widget`을 선택한다.
3. 변경 파일 목록에서 `BaroName` 폴더가 보이는지 확인한다.
4. 커밋 메시지에 `Add BaroName MVP`처럼 입력한다.
5. `Commit`을 누른다.
6. `Push origin`을 누른다.

명령어로 하는 경우:

```powershell
cd C:\Users\JUNE\Documents\GitHub\widget
git add BaroName
git commit -m "Add BaroName MVP"
git push
```

### 5.2 Vercel 프로젝트 만들기

1. Vercel에 접속한다.

   https://vercel.com/

2. GitHub 계정으로 로그인한다.

3. `Add New...` 또는 `New Project`를 누른다.

4. GitHub 저장소 `widget`을 선택한다.

5. Root Directory를 `BaroName`으로 설정한다.

   이 단계가 중요하다. 저장소 전체가 아니라 `BaroName` 폴더를 앱 루트로 지정해야 한다.

6. Framework Preset은 `Next.js`로 자동 인식되면 그대로 둔다.

7. Environment Variables에 아래 값을 추가한다.

```text
GEMINI_API_KEY
APP_PASSWORD
SESSION_SECRET
GEMINI_MODEL
GENERATION_COOLDOWN_SECONDS
```

예:

```text
GEMINI_MODEL=gemini-3.5-flash
GENERATION_COOLDOWN_SECONDS=8
```

8. `Deploy`를 누른다.

배포가 끝나면 Vercel이 접속 주소를 보여준다. 그 주소에 들어가면 비밀번호 화면이 먼저 나온다.

## 6. Vercel 환경변수 수정 방법

나중에 API 키나 비밀번호를 바꾸려면:

1. Vercel 프로젝트로 들어간다.
2. `Settings`를 누른다.
3. `Environment Variables`로 이동한다.
4. 값을 수정한다.
5. 수정 후 새 배포가 필요하면 `Redeploy`를 누른다.

## 7. 무료 티어 보호 방식

BaroName은 개인용 사용을 기준으로 제한을 빡빡하게 걸지 않는다.

현재 방식:

- 하루 생성 횟수 제한 없음
- 한 번에 하나의 생성 요청만 실행
- 생성 버튼 재클릭은 약 8초만 완충
- 같은 입력값은 서버 캐시가 있으면 재사용
- Gemini가 429 rate limit을 반환하면 잠시 후 다시 시도하도록 안내

즉, 혼자 쓰는 동안에는 거의 막히지 않지만, 짧은 시간에 버튼을 계속 눌러 무료 티어 한도를 급격히 소모하는 상황만 줄인다.

## 8. 자주 생길 수 있는 문제

### npm 명령어를 찾을 수 없다고 나올 때

아래처럼 전체 경로로 실행한다.

```powershell
& 'C:\Program Files\nodejs\npm.cmd' install
```

### 앱에서 Gemini API Key가 없다고 나올 때

`.env.local` 파일이 있는지 확인한다.

파일 위치:

```text
C:\Users\JUNE\Documents\GitHub\widget\BaroName\.env.local
```

수정 후에는 개발 서버를 껐다가 다시 켠다.

### Vercel 배포 후 비밀번호가 안 맞는다고 나올 때

Vercel의 `APP_PASSWORD` 환경변수 값을 확인한다.

로컬 `.env.local`과 Vercel 환경변수는 자동으로 공유되지 않는다. Vercel에는 따로 입력해야 한다.

### Gemini rate limit 메시지가 나올 때

무료 티어 한도에 잠깐 걸린 것이다. 몇 분 후 다시 시도한다.

### 모델 이름 오류가 나올 때

`GEMINI_MODEL` 값을 AI Studio 또는 공식 문서에서 현재 무료 티어로 사용 가능한 Flash 모델명으로 바꾼다.

초기 추천:

```text
gemini-3.5-flash
```
