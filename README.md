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
| 🍃 | Cozy Cove | react / three.js | 3D 디오라마. 드래그로 돌려보기. |
| 🟣 | Bouncing Orbs | html / canvas | 클릭하면 공이 떨어지는 물리 장난감. |
