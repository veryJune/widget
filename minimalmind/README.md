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
- 현재는 **브라우저 localStorage** 에 다중 프로젝트로 저장됩니다(기기 단위).
- 중요한 맵은 툴바의 **파일 저장(.json)** 으로 백업하세요.
- (예정) 클라우드 + 단일 비밀번호 동기화 — `js/storage.js`의 `ProjectStore` 인터페이스만 교체하면 됩니다.
