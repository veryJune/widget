# Steal Book 설정 · 배포 가이드

## 지금 연결된 상태 (2026-11-09)

| 항목 | 값 |
|---|---|
| 앱 주소 | https://steal-book.vercel.app |
| Vercel 프로젝트 | `steal-book` (팀 v-june, Root Directory `StealBook`, main에 푸시하면 자동 배포) |
| Supabase 프로젝트 | `steal-book` (June's App Factory, 서울 리전) |
| 로그인 계정 | verymore.june@gmail.com — 처음 받은 임시 비밀번호는 앱 **설정 → 비밀번호 바꾸기**로 바꾸기 |
| 새 가입 | 데이터베이스에서 막혀 있음 (`stealbook_single_owner` 트리거, 아래 1-3 참고) |
| 데이터베이스 구조 | `schema.sql` 최신본 적용됨 (하위 카테고리 · 휴지통 `deleted_at` · 모음 `collections` 포함) |

아래 내용은 처음부터 다시 만들거나 다른 곳에 하나 더 만들 때를 위한 기록입니다.

개발자가 아니어도 순서대로 따라 하면 되도록 썼습니다. 전체 20~30분 정도 걸립니다.

```
[PC 브라우저]   [안드로이드 폰]
       \           /
        Vercel  ── 화면을 띄워 주는 곳 (상영관)
          |
       Supabase ── 글·사진·영상을 보관하고 기기끼리 맞춰 주는 곳 (필름 창고)
```

Vercel은 화면만 띄워 주고 데이터는 보관하지 않습니다. 그래서 Supabase를 함께 붙여서
여러 PC와 휴대폰이 같은 내용을 보게 만듭니다. 둘 다 무료 플랜으로 충분합니다.

---

## 0. 먼저 내 PC에서 열어 보기 (체험 모드, 5분)

Supabase를 연결하기 전에도 바로 써 볼 수 있습니다. 이때는 **이 브라우저에만** 저장됩니다.

PowerShell을 열고:

```powershell
$env:Path = "C:\Program Files\nodejs;$env:Path"
cd C:\Users\one\Documents\GitHub\widget\StealBook
& 'C:\Program Files\nodejs\npm.cmd' install
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

터미널에 나온 주소(보통 `http://localhost:5173`)를 브라우저로 엽니다.
왼쪽 아래에 **체험 모드**라고 보이면 정상입니다.

> 체험 모드에서 담은 것은 나중에 Supabase를 연결한 뒤 **설정 → 클라우드로 옮기기** 버튼으로 옮길 수 있습니다.

---

## 1. Supabase 만들기 (10분)

### 1-1. 프로젝트 만들기
1. https://supabase.com 접속 → **Start your project** → GitHub 계정으로 로그인
2. **New project**
   - Name: `steal-book`
   - Database Password: 아무거나 길게 (어딘가 적어 두기만 하면 됩니다. 앱에서는 쓰지 않음)
   - Region: **Northeast Asia (Seoul)**
   - Plan: **Free**
3. 1~2분 기다리면 프로젝트가 준비됩니다.

### 1-2. 데이터베이스 · 저장소 설정 (복사 → 붙여넣기 한 번)
1. 왼쪽 메뉴 **SQL Editor** → **New query**
2. 이 폴더의 `supabase/schema.sql` 파일을 메모장으로 열어 **전체 복사** → 붙여넣기
3. 오른쪽 아래 **Run**
4. `Success. No rows returned` 가 나오면 끝
   (앱을 업데이트한 뒤에도 이 파일을 다시 Run 하면 새 칸·표만 덧붙고 기존 데이터는 그대로입니다)

이것으로 아래가 한 번에 만들어집니다.
- 카테고리 · 항목 · 모음 표 (휴지통 칸 포함)
- 본인만 읽고 쓸 수 있는 보안 규칙
- 다른 기기 변경이 바로 반영되는 실시간 동기화
- 사진·영상 저장 공간 `media` (비공개, 파일 하나 최대 50MB)

### 1-3. 내 계정 만들기 + 다른 사람 가입 막기
Steal Book에는 회원가입 화면이 없습니다. 내 계정 하나만 만들어 둡니다.

1. 왼쪽 **Authentication → Users** → **Add user → Create new user**
   - 이메일, 비밀번호 입력 (이게 앱 로그인 정보입니다)
   - **Auto Confirm User** 체크
2. 다른 사람 가입은 `schema.sql` 6번의 트리거가 막습니다. **첫 계정이 생긴 뒤에는 어떤 경로로도 새 계정이 만들어지지 않습니다.**
   (계정을 새로 만들어야 하면 SQL Editor에서 `drop trigger stealbook_single_owner on auth.users;` 실행 → 만든 뒤 `schema.sql` 다시 Run)
3. (선택) **Authentication → Sign In / Providers** 에서 **Allow new users to sign up** 도 꺼 두면 이중으로 막힙니다.

### 1-4. 연결 정보 복사
1. 왼쪽 아래 **Project Settings → API Keys** (또는 상단 **Connect** 버튼)
2. 두 가지를 복사해 둡니다.
   - **Project URL**: `https://abcdefgh.supabase.co` 형태
   - **Publishable key**: `sb_publishable_...` 형태
     (예전 화면이면 `anon` `public` 키 — 같은 역할)

> Publishable key는 화면 코드에 들어가도 되는 공개용 키입니다. 데이터는 1-2의 보안 규칙과 로그인으로 보호됩니다.
> **service_role / secret 키는 절대 쓰지 마세요.**

### 1-5. 내 PC에 연결해 보기 (선택)
`StealBook` 폴더에 `.env.local` 파일을 새로 만들고:

```text
VITE_SUPABASE_URL=https://abcdefgh.supabase.co
VITE_SUPABASE_KEY=sb_publishable_xxxxxxxxxxxx
```

`npm run dev` 를 다시 실행하면 로그인 화면이 나옵니다. 1-3에서 만든 계정으로 로그인하세요.
`.env.local` 은 `.gitignore` 에 들어 있어 GitHub에 올라가지 않습니다.

---

## 2. Vercel에 배포 (10분)

다른 위젯들과 같은 방식입니다. 레포는 그대로 두고 `StealBook` 폴더만 배포합니다.

1. GitHub Desktop(또는 VS Code)에서 `widget` 레포에 `StealBook` 폴더를 커밋 → Push
2. https://vercel.com → **Add New… → Project** → `veryJune/widget` **Import**
3. 설정
   - **Project Name**: `steal-book`
   - **Root Directory**: **Edit** → `StealBook` 선택
   - Framework Preset: **Vite** (자동으로 잡힘)
4. **Environment Variables** 펼쳐서 두 개 추가
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | 1-4의 Project URL |
   | `VITE_SUPABASE_KEY` | 1-4의 Publishable key |
5. **Deploy**
6. 1~2분 뒤 나오는 주소(`https://steal-book-xxxx.vercel.app`)로 접속 → 로그인

이후에는 GitHub에 Push할 때마다 자동으로 다시 배포됩니다.

> 환경변수를 나중에 바꿨다면 **Deployments → 맨 위 배포 … → Redeploy** 를 한 번 눌러야 반영됩니다.

### 배포 보호 설정
Vercel 팀 기본값은 `*.vercel.app` 주소에도 Vercel 로그인을 요구합니다. 휴대폰에서 Vercel 로그인 없이 쓰도록
`steal-book` 프로젝트만 **Standard Protection**(미리보기·배포별 주소만 보호, `steal-book.vercel.app`은 공개)으로 바꿔 두었습니다.
앱 데이터는 Steal Book 로그인과 Supabase 보안 규칙으로 보호됩니다.

### 자동 깨우기 (따로 할 일 없음)
Supabase 무료 프로젝트는 **7일 동안 요청이 없으면 일시정지**됩니다. `vercel.json` 에 하루 한 번
`/api/keepalive` 를 부르는 예약 작업이 들어 있어서, 오래 안 써도 멈추지 않게 해 둡니다.
(Vercel 대시보드 → 프로젝트 → **Settings → Cron Jobs** 에서 확인 가능)

---

## 3. 안드로이드 폰에 설치 + 공유 메뉴 연결 (2분)

1. 폰의 **크롬**으로 배포 주소 접속 → 로그인
2. 크롬 메뉴(⋮) → **홈 화면에 추가** 또는 **앱 설치**
   (앱의 **설정 → 지금 앱으로 설치** 버튼이 보이면 그걸 눌러도 됩니다)
3. 이제 유튜브·인스타그램·브라우저에서 **공유** → 목록에서 **Steal Book** 선택
   → 작성 창이 링크가 채워진 채로 열립니다 → 카테고리·한 줄 메모 → **담기**

> 공유 목록에 바로 안 보이면 **더보기**를 눌러 찾거나, 설치 후 폰을 한 번 재시작해 보세요.

---

## 4. 무료로 오래 쓰는 법

2026년 11월 확인 기준 무료 한도:

| 항목 | 무료 한도 | Steal Book에서 |
|---|---|---|
| Supabase 파일 저장 | 1GB | 사진은 자동 압축(보통 장당 0.2~0.6MB) → 수천 장 가능. 영상 원본이 가장 큼 |
| Supabase 데이터베이스 | 500MB | 글·링크 정보만 들어가서 사실상 넉넉함 |
| Supabase 전송량 | 월 5GB | 갤러리는 작은 썸네일만, 원본은 열 때만 받음 |
| 파일 하나 크기 | 50MB | 넘으면 720p로 내보내서 올리기 |
| 일시정지 | 7일 미사용 시 | 자동 깨우기로 해결 |
| Vercel Hobby | 개인·비상업 용도 | 개인 아카이브라 해당 |

- **영상은 가능하면 유튜브·인스타 링크로 담고**, 꼭 필요한 짧은 클립만 파일로 올리세요.
- 사용량은 앱 **설정 → 저장 · 동기화** 에서 막대로 보입니다. 85%를 넘으면 표시가 바뀝니다.
- 1GB가 부족해지면: 파일 저장만 **Cloudflare R2(무료 10GB, 결제수단 등록 필요)** 로 옮길 수 있게
  코드를 나눠 두었습니다 (`src/lib/backend/supabase.ts` 의 `upload / remove / signUrls`).

---

## 5. 백업

- **설정 → 백업 내려받기**: 글·링크·카테고리 정보를 JSON 파일 하나로 저장
- 사진·영상 원본은 Supabase **Storage → media** 에 그대로 있습니다
- 한 달에 한 번 정도 백업 파일을 받아 두기를 권장합니다

---

## 6. 문제가 생기면

| 증상 | 확인할 것 |
|---|---|
| 로그인 화면이 안 나오고 "체험 모드" | Vercel 환경변수 이름이 정확히 `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` 인지, 바꾼 뒤 Redeploy 했는지 |
| "이메일 또는 비밀번호가 맞지 않습니다" | 1-3에서 만든 계정인지, **Auto Confirm** 했는지 |
| "이메일 인증이 끝나지 않은 계정" | Authentication → Users → 해당 사용자 … → **Confirm email** |
| 사진 올리기 실패 | `schema.sql` 을 끝까지 실행했는지 (Storage에 `media` 버킷이 있는지) |
| 다른 기기에 바로 안 뜸 | 앱을 한 번 닫았다 열기. 계속 안 되면 SQL Editor에서 `schema.sql` 다시 Run |
| 갑자기 아무것도 안 불러옴 | Supabase 대시보드에서 프로젝트가 **Paused** 인지 → **Restore** |
| 링크 미리보기 제목이 안 나옴 | 인스타그램 등 일부 사이트는 로그인 벽 때문에 정보를 안 줍니다. 제목·메모를 직접 쓰거나, 스크린샷을 함께 붙여넣으면 카드 표지가 됩니다 |
| 아이폰 .mov(HEVC) 영상 썸네일이 없음 | 크롬이 일부 HEVC 영상을 못 읽어서입니다. 원본은 저장되고, 상세 보기에서 재생은 됩니다 |
