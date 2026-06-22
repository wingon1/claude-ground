# claude-ground

ai 테스트 및 성능 확인 작업물들 모음

🔗 Live: `https://wingon1.github.io/claude-ground/`

---

## 폴더 구조

```
claude-ground/
│
├── src/
│   └── projects/
│       ├── registry.ts          ← ✅ 모든 작업물을 여기에 등록
│       │
│       ├── cozy-cove/           ← React 작업물 예시
│       │   ├── CozyCove.tsx
│       │   └── components/
│       │
│       └── <내-작업-이름>/      ← 새 React 작업물은 여기 만들기
│           └── index.tsx
│
└── public/
    └── projects/
        ├── bouncing-orbs/       ← 정적(HTML) 작업물 예시
        │   └── index.html
        │
        └── <내-작업-이름>/      ← 새 HTML/게임/p5.js 작업물은 여기 만들기
            └── index.html
```

---

## 새 작업물 추가하는 법

### React 컴포넌트 작업물 (Three.js, 애니메이션 등)

**1단계 — 폴더 만들기**

`src/projects/<id>/index.tsx` 파일 생성. 반드시 **default export** 컴포넌트.

```tsx
// src/projects/my-art/index.tsx
export default function MyArt() {
  return <div>내 작업물</div>
}
```

**2단계 — registry에 등록**

`src/projects/registry.ts` 파일 열어서 `projects` 배열에 추가:

```ts
{
  id: 'my-art',           // URL에 쓰임: #/p/my-art
  title: 'My Art',        // 카드 제목
  description: '짧은 설명.', 
  emoji: '✨',            // 카드 커버 이미지 대신 쓰는 이모지
  tags: ['react'],        // 카드에 표시되는 태그 (없어도 됨)
  kind: 'react',
  load: () => import('./my-art'),
},
```

---

### 정적 작업물 (순수 HTML / p5.js / 캔버스 게임 / 외부 라이브러리 등)

**1단계 — 파일 놓기**

`public/projects/<id>/index.html` 에 자기완결적 HTML 파일 넣기.  
(CSS, JS, 이미지 등 에셋은 같은 폴더에 같이 두면 됨)

**2단계 — registry에 등록**

```ts
{
  id: 'my-game',
  title: 'My Game',
  description: '짧은 설명.',
  emoji: '🎮',
  tags: ['html', 'game'],
  kind: 'iframe',
  path: 'projects/my-game/index.html',
},
```

**그게 전부.** registry에 추가하면 갤러리 카드가 자동으로 생깁니다.

---

### 외부 URL 작업물 (다른 곳에 배포된 사이트)

코드가 이 레포에 없고 외부에 배포된 작업물(Netlify, GitHub Pages 등)은 URL만으로 등록할 수 있습니다.
카드를 누르면 페이지 이동 없이 뷰어 안 **iframe으로 실행**되며, 임베딩이 막힌 사이트를 위해 "새 탭에서 열기" 버튼도 함께 표시됩니다.

`src/projects/registry.ts` 의 `projects` 배열에 추가:

```ts
{
  id: 'my-external',
  title: 'My External Work',
  description: '짧은 설명.',
  emoji: '🔗',
  tags: ['external', 'game'],
  kind: 'external',
  url: 'https://my-work.netlify.app',
},
```

---

### 카드 숨기기 (노출 제어)

작업물을 지우지 않고 갤러리에서만 숨기려면 `enabled: false` 를 추가합니다.
필드가 없거나 `true` 면 평소대로 노출됩니다.

```ts
{
  id: 'wip-project',
  // ...
  enabled: false,   // 갤러리에서 숨김
},
```

---

## 배포

`main` 브랜치에 push하면 `.github/workflows/deploy.yml` 이 자동으로 빌드해서 GitHub Pages에 올립니다.  
보통 1~2분 이내에 사이트에 반영됩니다.

---

## 로컬 개발

```bash
npm install
npm run dev      # 로컬 개발 서버 (http://localhost:5173/claude-ground/)
npm run build    # 빌드 (타입 체크 포함)
npm run lint
```

---

## 등록된 작업물

| 이모지 | 이름 | 종류 | 설명 |
| --- | --- | --- | --- |
| 🏝️ | 코지 아일랜드 | react / canvas | 탭 이동·자동 상호작용 픽셀 섬 키우기. 스태미나·수면 성장·농사·요리·건설·퀘스트·광산, 절차적 사운드. |
| 🍃 | Cozy Cove | react / three.js | 3D 디오라마. 드래그로 돌려보기. |
| 🏡 | Pixel Village | react / canvas | 절차적 픽셀아트 마을. 아이소 타일·디더링·물결 애니·드래그 패닝. |
| 🟣 | Bouncing Orbs | html / canvas | 클릭하면 공이 떨어지는 물리 장난감. |
| 🎵 | 토두지 리듬게임 | external | 외부 배포 리듬게임. |
| ⚔️ | 토리 vs 두조 | external | 2D 대전 액션 게임. |
| 🏝️ | 두두 아일랜드 | external | 3D 탐험 게임. |
| 🚪 | 백룸 게임 | external | 백룸 분위기의 게임. |
