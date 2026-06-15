# MinimalMind

미니멀한 마인드맵 웹 앱 (빌드 없는 정적 사이트).

## 폴더 구조
```
minimalmind/
├── index.html        # 마크업
├── css/style.css     # 스타일
├── js/
│   ├── data.js       # 영감 데이터·상수
│   ├── security.js   # XSS 차단·이미지 화이트리스트·문서 검증
│   ├── storage.js    # ProjectStore (다중 프로젝트, 클라우드 교체 가능)
│   └── app.js        # 마인드맵 엔진·UI
├── vercel.json       # 정적 배포 설정
└── README.md
```

## 로컬 실행
빌드 도구가 필요 없습니다. 다음 중 하나로 실행하세요.
- `index.html`을 브라우저로 바로 열기, 또는
- 간단한 정적 서버: `python -m http.server 5050 --directory .` 후 `http://localhost:5050`

## Vercel 배포
이 앱은 `widget/minimalmind/` 하위에 있으므로, 레포를 옮기지 않고 그대로 배포합니다.

1. Vercel에서 **New Project → 이 GitHub 레포 선택**
2. **Root Directory** 를 `widget/minimalmind` 로 지정
3. Framework Preset: **Other** (빌드 명령 없음, 정적)
4. Deploy

이후 GitHub에 push할 때마다 자동 배포됩니다.

## 데이터 저장
- 기본은 **브라우저 localStorage** 에 다중 프로젝트로 저장됩니다(기기 단위, 로컬 우선).
- 중요한 맵은 툴바의 **파일 저장(.json)** 으로 백업하세요.

## 클라우드 동기화 (Phase 2 · 선택)
단일 비밀번호로 여러 기기에서 프로젝트를 동기화합니다. 데이터는 Vercel Blob의
비공개 경로 JSON 한 개에 저장되고, `/api/store` 서버리스 함수만 접근합니다.
클라이언트는 비밀번호(헤더 `x-mm-key`)로만 인증하며, 비밀번호는 서버 환경변수와 비교합니다.

### 설정 (1회)
1. **Blob 저장소 생성**: Vercel 프로젝트 → **Storage → Create → Blob** → 연결.
   → `BLOB_READ_WRITE_TOKEN` 환경변수가 자동 추가됩니다.
2. **비밀번호 설정**: 프로젝트 → **Settings → Environment Variables** →
   `APP_PASSWORD` = 원하는 비밀번호 (Production/Preview/Development 모두 체크).
3. **재배포**: 다시 Deploy 하면 `package.json`의 `@vercel/blob`이 설치되고
   `/api/store` 함수가 활성화됩니다.
4. 앱 상단 **☁ 버튼 → 비밀번호 입력 → 연결**. 다른 기기에서도 같은 비밀번호로 연결.

### 동작
- 로컬이 기준(source of truth). 변경 시 **자동 업로드(디바운스)**, 접속/로드 시 **자동 다운로드 후 병합**(프로젝트별 최신본 우선).
- ⚠️ 삭제는 기기 간 전파되지 않습니다(안전 우선). 한 기기에서 지운 프로젝트가 다른 기기에 남아 있을 수 있습니다.
- 백엔드 미설정 시 ☁ 연결은 실패하며, 앱은 로컬 모드로 정상 동작합니다.

### 보안 메모
- **비공개(private) Blob 저장소**를 사용합니다. 업로드된 데이터는 토큰 없이는 URL을 알아도 읽을 수 없습니다.
- 접근은 단일 비밀번호(서버측 검증)로 게이트됩니다. 토큰(`BLOB_READ_WRITE_TOKEN`)은 서버에만 있고 클라이언트엔 노출되지 않습니다.
- 데이터 자체는 평문(JSON)으로 저장되므로, Vercel 계정 소유자/제공사는 접근 가능합니다.
  더 강한 보안이 필요하면 *클라이언트측 암호화(비밀번호 기반)* 를 추가할 수 있습니다(후속 옵션).
