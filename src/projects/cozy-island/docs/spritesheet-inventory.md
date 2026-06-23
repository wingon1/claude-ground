# 코지 아일랜드 — 스프라이트시트 인벤토리

## 목적

코드로 즉석 도트를 그리는 방식에서 `assets/spritesheet.png`와 `assets/spritesheet.json`을 기준으로 잘라 쓰는 방식으로 전환한다.
새 visible object가 필요할 때 해당 sprite id가 없으면, 먼저 이 목록과 manifest를 갱신하고 시트에 그래픽을 추가한다.

## Manifest 규칙

각 스프라이트는 다음 정보를 가진다.

```json
{
  "id": "tree.oak.large",
  "x": 0,
  "y": 0,
  "w": 48,
  "h": 64,
  "anchor": "foot",
  "scale": 1,
  "tags": ["world", "resource"]
}
```

- `id`: `category.name.variant` 형식.
- `anchor`: `foot`, `center`, `topLeft` 중 하나.
- `scale`: Canvas 렌더 시 기본 배율. 원본은 1x 픽셀 단위로 유지.
- `tags`: 검색/검증용. 런타임 로직에 의존하지 않는다.

## 아트 스타일 규칙

- 파스텔 톤과 낮은 대비를 기본으로 하며, 검은색/진한 외곽선 대신 오브젝트 색상보다 한두 단계 진한 컬러 픽셀로 가장자리를 정리한다.
- 스프라이트 자체에는 바닥 그림자나 분리된 타원 그림자를 넣지 않는다. 접지감은 발/기둥/바닥 접점 픽셀과 월드 바닥 텍스처로 처리한다.
- 같은 시트 안에서 외곽선이 있는 오브젝트와 없는 오브젝트를 섞지 않는다.
- 작은 실루엣으로 뭉개지지 않도록 프레임을 필요한 만큼 키우고, 내부 패널/천 주름/장식/잎사귀/하이라이트 같은 세부 픽셀을 충분히 사용한다.
- `building.shop.lv1`은 `building.tent.lv1`보다 최소 2배 큰 시각적 면적을 유지한다.

## 1차 제작 대상

홈 구역과 초반 루프에서 항상 보이는 대상이다. 이 세트를 먼저 완성하고 코드 렌더를 전환한다.

| id | 용도 | frame |
| --- | --- | --- |
| `player.idle.down` | 기본 대기 | 32x48 |
| `player.walk.down.0..3` | 이동 애니메이션 | 32x48 |
| `player.action.pickaxe.0..1` | 채집/채광 액션 | 40x48 |
| `player.tired.down` | 스태미나 0 | 32x48 |
| `building.tent.lv1` | 텐트 | 80x88 |
| `building.shop.lv1` | 상점 | 160x96 |
| `building.cooking_fire.lv1` | 요리불 | 56x56 |
| `building.storage.lv1` | 창고 | 64x56 |
| `building.mine_entrance.lv1` | 광산 입구 | 104x80 |
| `resource.tree.small` | 작은 나무 | 56x72 |
| `resource.tree.large` | 큰 나무 | 80x96 |
| `resource.rock.small` | 작은 바위 | 56x40 |
| `resource.rock.large` | 큰 바위 | 64x48 |
| `resource.bush.berry` | 덤불 | 56x44 |
| `resource.ore.node` | 광산 노드 | 48x40 |
| `plot.wheat.0..4` | 밀밭 성장 단계 | 56x36 |
| `ui.coin`, `ui.gem`, `ui.bolt`, `ui.bag`, `ui.shop`, `ui.hammer`, `ui.pickaxe`, `ui.pot`, `ui.scroll`, `ui.book`, `ui.gear` | HUD/메뉴 | 16x16 |

## 2차 제작 대상

콘텐츠 확장과 반복 플레이에서 체감되는 대상이다.

| id | 용도 | frame |
| --- | --- | --- |
| `plot.carrot.0..4` | 당근 성장 단계 | 48x32 |
| `plot.strawberry.0..4` | 딸기 성장 단계 | 48x32 |
| `plot.tomato.0..4` | 토마토 성장 단계 | 48x32 |
| `plot.potato.0..4` | 감자 성장 단계 | 48x32 |
| `animal.chicken.idle.0..1` | 닭 | 32x32 |
| `animal.cow.idle.0..1` | 소 | 56x40 |
| `animal.bee.idle.0..1` | 벌 | 24x24 |
| `building.chicken_coop.lv1` | 닭장 | 72x56 |
| `building.barn.lv1` | 외양간 | 88x72 |
| `building.apiary.lv1` | 양봉장 | 56x48 |
| `tile.fence.horizontal`, `tile.fence.vertical`, `tile.gate` | 울타리/게이트 | 16x16 |
| `tile.mine.floor.0..3` | 광산 바닥 | 32x32 |
| `item.*` | 인벤토리 아이콘 | 16x16 |

## 3차 제작 대상

던전/업그레이드/VFX처럼 후속 기능과 함께 확장할 대상이다.

- `building.*.lv2/lv3`
- `building.build_site.*`
- `dungeon.entrance`
- `dungeon.tile.*`
- `dungeon.hazard.*`
- `vfx.leaf.*`
- `vfx.chip.*`
- `vfx.sparkle.*`
- `vfx.tap_marker.*`

## 작업 순서

1. `assets/spritesheet.png`와 `assets/spritesheet.json` 생성.
2. `render/spriteSheet.ts` 로더 작성.
3. 1차 제작 대상 중 홈 구역 오브젝트부터 시트 렌더로 연결.
4. fallback으로 기존 `render/sprites.ts` 함수를 유지.
5. 모든 신규 visible object 작업은 먼저 이 인벤토리를 갱신한다.
