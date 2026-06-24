// Pixel-art catalogue for Tiny Dew Valley.
//
// This file is intentionally a reference/index only. The actual procedural
// sprite drawing still lives in engine/sprites.ts and engine/game.ts.
// Use `id` or `sourceFn` to find a specific sprite before editing it.

export type SpriteSource = 'sprite-bake' | 'runtime-draw' | 'item-icon' | 'tool-icon' | 'ui-icon'

export type SpriteCategory =
  | 'terrain'
  | 'fence'
  | 'resource'
  | 'crop'
  | 'building'
  | 'character'
  | 'animal'
  | 'monster'
  | 'item'
  | 'tool'
  | 'ui'
  | 'effect'

export interface SpriteCatalogEntry {
  id: string
  label: string
  category: SpriteCategory
  source: SpriteSource
  file: 'engine/sprites.ts' | 'engine/game.ts'
  sourceFn: string
  spriteKey?: string
  frames?: string
  notes?: string
}

export const SPRITE_CATALOG: SpriteCatalogEntry[] = [
  // Terrain tiles.
  { id: 'terrain.grass', label: '잔디', category: 'terrain', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeGrass', spriteKey: 'sprites.grass', frames: '3 variants' },
  { id: 'terrain.soil', label: '밭 흙', category: 'terrain', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeSoil(false)', spriteKey: 'sprites.soil' },
  { id: 'terrain.soil_wet', label: '젖은 밭 흙', category: 'terrain', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeSoil(true)', spriteKey: 'sprites.soilWet' },
  { id: 'terrain.water', label: '물', category: 'terrain', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeWater', spriteKey: 'sprites.water', frames: '4 animation frames' },
  { id: 'terrain.path', label: '길 바닥', category: 'terrain', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakePath', spriteKey: 'sprites.path' },
  { id: 'terrain.mine_floor', label: '광산 바닥/벽', category: 'terrain', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawMineGround', notes: '광산 내부 타일은 캔버스에서 바로 그림' },

  // Fences and signs.
  { id: 'fence.basic', label: '기본 울타리', category: 'fence', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeFence', spriteKey: 'sprites.fence' },
  { id: 'fence.animal_straight', label: '동물 농장 직선 울타리', category: 'fence', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeFenceSmall', spriteKey: 'sprites.fenceSmall', notes: '회전값은 tile.metadata.animalFenceRot' },
  { id: 'fence.animal_corner', label: '동물 농장 모서리 울타리', category: 'fence', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeFenceCorner', spriteKey: 'sprites.fenceCorner', notes: '회전값은 tile.metadata.animalFenceRot' },
  { id: 'fence.field_sign', label: '밭 푯말', category: 'fence', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawSign' },

  // World resources and obstacles.
  { id: 'resource.tree', label: '나무', category: 'resource', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeTree', spriteKey: 'sprites.tree' },
  { id: 'resource.stump', label: '그루터기', category: 'resource', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeStump', spriteKey: 'sprites.stump' },
  { id: 'resource.large_stump', label: '큰 그루터기', category: 'resource', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeLargeStump', spriteKey: 'sprites.largeStump' },
  { id: 'resource.rock', label: '돌', category: 'resource', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeRock', spriteKey: 'sprites.rock' },
  { id: 'resource.copper_ore', label: '구리 광석', category: 'resource', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: "bakeOreRock('#c8753a')", spriteKey: 'sprites.copperOre' },
  { id: 'resource.iron_ore', label: '철 광석', category: 'resource', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: "bakeOreRock('#c8ccd6')", spriteKey: 'sprites.ironOre' },
  { id: 'resource.weed', label: '잡초', category: 'resource', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeWeed', spriteKey: 'sprites.weed' },
  { id: 'resource.flower', label: '꽃', category: 'resource', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeFlower', spriteKey: 'sprites.flower' },

  // Crops.
  { id: 'crop.wheat', label: '밀 작물', category: 'crop', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeCrop -> drawWheat', spriteKey: 'sprites.crops.wheat', frames: '3 growth stages' },
  { id: 'crop.tomato', label: '토마토 작물', category: 'crop', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeCrop -> drawTomato', spriteKey: 'sprites.crops.tomato', frames: '4 growth stages' },
  { id: 'crop.strawberry', label: '딸기 작물', category: 'crop', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeCrop -> drawStrawberry', spriteKey: 'sprites.crops.strawberry', frames: '5 growth stages' },
  { id: 'crop.corn', label: '옥수수 작물', category: 'crop', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeCrop -> drawCorn', spriteKey: 'sprites.crops.corn', frames: '6 growth stages' },
  { id: 'crop.generic', label: '작물 기본 폴백', category: 'crop', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeCrop generic branch', notes: '신규 작물 전용 draw 함수가 없을 때 사용' },

  // Buildings and large world objects.
  { id: 'building.player_tent', label: '플레이어 텐트', category: 'building', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeFarmhouse', spriteKey: 'sprites.farmhouse', notes: '이름은 farmhouse지만 현재 텐트 그림' },
  { id: 'building.store', label: '상점', category: 'building', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeStore', spriteKey: 'sprites.store' },
  { id: 'building.shrine_broken', label: '부서진 비석/신전', category: 'building', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeShrine(false)', spriteKey: 'sprites.shrineBroken' },
  { id: 'building.shrine_restored', label: '복구된 비석/신전', category: 'building', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeShrine(true)', spriteKey: 'sprites.shrineRestored' },
  { id: 'building.animal_house', label: '동물 농장 축사/닭장', category: 'building', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawAnimalFarms', notes: '농장 안 작은 건물' },
  { id: 'building.cooking_fire', label: '화로대', category: 'building', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawCookingFire' },
  { id: 'building.mine_entrance', label: '광산 입구', category: 'building', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawMineEntrance' },
  { id: 'building.blacksmith', label: '대장간', category: 'building', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawBlacksmith' },

  // Characters and NPCs.
  { id: 'character.player', label: '플레이어', category: 'character', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeHumanoidSheet(farmerPal)', spriteKey: 'sprites.farmer', frames: 'down/up/left/right x idle/walk1/walk2' },
  { id: 'character.barnaby', label: '상점/주문 NPC', category: 'character', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeHumanoidSheet(barnabyPal)', spriteKey: 'sprites.barnaby', frames: 'down/up/left/right x idle/walk1/walk2' },
  { id: 'character.faye', label: 'NPC 페이', category: 'character', source: 'sprite-bake', file: 'engine/sprites.ts', sourceFn: 'bakeHumanoidSheet(fayePal)', spriteKey: 'sprites.faye', frames: 'down/up/left/right x idle/walk1/walk2' },
  { id: 'character.blacksmith_npc', label: '대장장이 NPC', category: 'character', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawBlacksmithNpc', notes: '몸은 sprites.barnaby 재사용, 머리 장식/말풍선은 런타임 그림' },

  // Animals.
  { id: 'animal.chicken', label: '닭', category: 'animal', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawAnimal(chicken)' },
  { id: 'animal.cow', label: '소', category: 'animal', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawAnimal(cow)' },
  { id: 'animal.pig', label: '돼지', category: 'animal', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawAnimal(pig)' },

  // Monsters.
  { id: 'monster.slime', label: '슬라임', category: 'monster', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawMonster default branch', notes: '색상/스탯은 data/monsters.ts의 slime' },
  { id: 'monster.bat', label: '박쥐', category: 'monster', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawMonster bat branch', notes: '색상/스탯은 data/monsters.ts의 bat' },
  { id: 'monster.mine_rat', label: '광산쥐', category: 'monster', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawMonster default branch', notes: '색상/스탯은 data/monsters.ts의 mine_rat' },
  { id: 'monster.stone_golem', label: '돌골렘', category: 'monster', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawMonster stone_golem branch', notes: '색상/스탯은 data/monsters.ts의 stone_golem' },
  { id: 'monster.mine_guardian', label: '광산 수호자', category: 'monster', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawMonster mine_guardian branch', notes: '색상/스탯은 data/monsters.ts의 mine_guardian' },

  // Item icons: seeds, permits, animals, upgrades.
  { id: 'item.seed_wheat', label: '밀 씨앗 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon default seed_ branch', spriteKey: 'seed_wheat' },
  { id: 'item.seed_tomato', label: '토마토 재배권 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon seed_tomato branch', spriteKey: 'seed_tomato' },
  { id: 'item.seed_strawberry', label: '딸기 재배권 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon seed_strawberry branch', spriteKey: 'seed_strawberry' },
  { id: 'item.seed_corn', label: '옥수수 재배권 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon seed_corn branch', spriteKey: 'seed_corn' },
  { id: 'item.permit_chicken', label: '닭농장 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon permit branch', spriteKey: 'permit_chicken' },
  { id: 'item.permit_dairy', label: '소농장 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon permit branch', spriteKey: 'permit_dairy' },
  { id: 'item.permit_pig', label: '돼지농장 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon permit branch', spriteKey: 'permit_pig' },
  { id: 'item.animal_chicken', label: '닭 구매 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon animal_chicken branch', spriteKey: 'animal_chicken' },
  { id: 'item.animal_cow', label: '소 구매 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon animal_cow branch', spriteKey: 'animal_cow' },
  { id: 'item.animal_pig', label: '돼지 구매 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon animal_pig branch', spriteKey: 'animal_pig' },
  { id: 'item.fertilizer', label: '비료 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon fertilizer branch', spriteKey: 'fertilizer' },
  { id: 'item.fertilizer_deluxe', label: '고급 비료 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon fertilizer_deluxe branch', spriteKey: 'fertilizer_deluxe' },
  { id: 'item.sprinkler', label: '스프링클러 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon sprinkler branch', spriteKey: 'sprinkler' },
  { id: 'item.sprinkler_quality', label: '고급 스프링클러 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon sprinkler_quality branch', spriteKey: 'sprinkler_quality' },
  { id: 'item.workbench', label: '작업대 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon workbench branch', spriteKey: 'workbench' },

  // Item icons: materials, crops, animal products, food.
  { id: 'item.wood', label: '나무 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon wood branch', spriteKey: 'wood' },
  { id: 'item.hardwood', label: '단단한 나무 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon hardwood branch', spriteKey: 'hardwood' },
  { id: 'item.stone', label: '돌 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon stone branch', spriteKey: 'stone' },
  { id: 'item.copper_ore', label: '구리 광석 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon copper_ore branch', spriteKey: 'copper_ore' },
  { id: 'item.iron_ore', label: '철 광석 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon iron_ore branch', spriteKey: 'iron_ore' },
  { id: 'item.fiber', label: '섬유 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon fiber branch', spriteKey: 'fiber' },
  { id: 'item.daffodil', label: '수선화 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon daffodil branch', spriteKey: 'daffodil' },
  { id: 'item.crop_wheat', label: '밀 수확물 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon crop_ branch', spriteKey: 'crop_wheat' },
  { id: 'item.crop_tomato', label: '토마토 수확물 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon crop_ branch', spriteKey: 'crop_tomato' },
  { id: 'item.crop_strawberry', label: '딸기 수확물 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon crop_ branch', spriteKey: 'crop_strawberry' },
  { id: 'item.crop_corn', label: '옥수수 수확물 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon crop_ branch', spriteKey: 'crop_corn' },
  { id: 'item.flour', label: '밀가루 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon flour branch', spriteKey: 'flour' },
  { id: 'item.egg', label: '달걀 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon egg branch', spriteKey: 'egg' },
  { id: 'item.milk', label: '우유 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon milk branch', spriteKey: 'milk' },
  { id: 'item.bacon', label: '베이컨 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon bacon branch', spriteKey: 'bacon' },
  { id: 'item.butter', label: '버터 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon butter branch', spriteKey: 'butter' },
  { id: 'item.cheese', label: '치즈 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon cheese branch', spriteKey: 'cheese' },
  { id: 'item.bread', label: '빵 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon bread branch', spriteKey: 'bread' },
  { id: 'item.toast', label: '토스트 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon toast branch', spriteKey: 'toast' },
  { id: 'item.bacon_toast', label: '베이컨 토스트 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon bacon_toast branch', spriteKey: 'bacon_toast' },
  { id: 'item.pastry', label: '페스츄리 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon pastry branch', spriteKey: 'pastry' },
  { id: 'item.strawberry_jam', label: '딸기잼 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon strawberry_jam branch', spriteKey: 'strawberry_jam' },
  { id: 'item.strawberry_milk', label: '딸기우유 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon strawberry_milk branch', spriteKey: 'strawberry_milk' },
  { id: 'item.strawberry_jam_toast', label: '딸기잼 토스트 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon strawberry_jam_toast branch', spriteKey: 'strawberry_jam_toast' },
  { id: 'item.tomato_sauce', label: '토마토 소스 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon tomato_sauce branch', spriteKey: 'tomato_sauce' },
  { id: 'item.pizza', label: '피자 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon pizza branch', spriteKey: 'pizza' },
  { id: 'item.butter_corn', label: '버터 옥수수 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon butter_corn branch', spriteKey: 'butter_corn' },
  { id: 'item.corn_pizza', label: '콘 피자 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon corn_pizza branch', spriteKey: 'corn_pizza' },
  { id: 'item.herbal_tea', label: '허브차 아이콘', category: 'item', source: 'item-icon', file: 'engine/sprites.ts', sourceFn: 'bakeItemIcon herbal_tea branch', spriteKey: 'herbal_tea' },

  // Tool icons.
  { id: 'tool.hoe', label: '괭이 아이콘', category: 'tool', source: 'tool-icon', file: 'engine/sprites.ts', sourceFn: 'bakeToolIcon hoe branch', spriteKey: 'hoe' },
  { id: 'tool.watering_can', label: '물뿌리개 아이콘', category: 'tool', source: 'tool-icon', file: 'engine/sprites.ts', sourceFn: 'bakeToolIcon watering_can branch', spriteKey: 'watering_can' },
  { id: 'tool.axe', label: '도끼 아이콘', category: 'tool', source: 'tool-icon', file: 'engine/sprites.ts', sourceFn: 'bakeToolIcon axe branch', spriteKey: 'axe' },
  { id: 'tool.pickaxe', label: '곡괭이 아이콘', category: 'tool', source: 'tool-icon', file: 'engine/sprites.ts', sourceFn: 'bakeToolIcon pickaxe branch', spriteKey: 'pickaxe' },
  { id: 'tool.scythe', label: '낫 아이콘', category: 'tool', source: 'tool-icon', file: 'engine/sprites.ts', sourceFn: 'bakeToolIcon scythe branch', spriteKey: 'scythe' },
  { id: 'tool.sword', label: '검 아이콘', category: 'tool', source: 'tool-icon', file: 'engine/sprites.ts', sourceFn: 'bakeToolIcon sword branch', spriteKey: 'sword' },
  { id: 'tool.hand', label: '손 아이콘', category: 'tool', source: 'tool-icon', file: 'engine/sprites.ts', sourceFn: 'bakeToolIcon hand branch', spriteKey: 'hand' },
  { id: 'tool.backpack', label: '가방 아이콘', category: 'tool', source: 'tool-icon', file: 'engine/sprites.ts', sourceFn: 'bakeToolIcon backpack branch', spriteKey: 'backpack' },

  // UI icons.
  { id: 'ui.coin', label: '골드 UI', category: 'ui', source: 'ui-icon', file: 'engine/sprites.ts', sourceFn: 'bakeUIIcon ui_coin branch', spriteKey: 'ui_coin' },
  { id: 'ui.bolt', label: '스태미나 UI', category: 'ui', source: 'ui-icon', file: 'engine/sprites.ts', sourceFn: 'bakeUIIcon ui_bolt branch', spriteKey: 'ui_bolt' },
  { id: 'ui.hammer', label: '건설 UI', category: 'ui', source: 'ui-icon', file: 'engine/sprites.ts', sourceFn: 'bakeUIIcon ui_hammer branch', spriteKey: 'ui_hammer' },
  { id: 'ui.target', label: '목표 UI', category: 'ui', source: 'ui-icon', file: 'engine/sprites.ts', sourceFn: 'bakeUIIcon ui_target branch', spriteKey: 'ui_target' },
  { id: 'ui.basket', label: '가방 UI', category: 'ui', source: 'ui-icon', file: 'engine/sprites.ts', sourceFn: 'bakeUIIcon ui_basket branch', spriteKey: 'ui_basket' },
  { id: 'ui.sprout', label: '씨앗 UI', category: 'ui', source: 'ui-icon', file: 'engine/sprites.ts', sourceFn: 'bakeUIIcon ui_sprout branch', spriteKey: 'ui_sprout' },
  { id: 'ui.receipt', label: '주문서 UI', category: 'ui', source: 'ui-icon', file: 'engine/sprites.ts', sourceFn: 'bakeUIIcon ui_receipt branch', spriteKey: 'ui_receipt' },
  { id: 'ui.pan', label: '요리 UI', category: 'ui', source: 'ui-icon', file: 'engine/sprites.ts', sourceFn: 'bakeUIIcon ui_pan branch', spriteKey: 'ui_pan' },
  { id: 'ui.bed', label: '잠자기 UI', category: 'ui', source: 'ui-icon', file: 'engine/sprites.ts', sourceFn: 'bakeUIIcon ui_bed branch', spriteKey: 'ui_bed' },
  { id: 'ui.fire', label: '불 UI', category: 'ui', source: 'ui-icon', file: 'engine/sprites.ts', sourceFn: 'bakeUIIcon ui_fire branch', spriteKey: 'ui_fire' },
  { id: 'ui.save', label: '저장 UI', category: 'ui', source: 'ui-icon', file: 'engine/sprites.ts', sourceFn: 'bakeUIIcon ui_save branch', spriteKey: 'ui_save' },
  { id: 'ui.sound', label: '사운드 UI', category: 'ui', source: 'ui-icon', file: 'engine/sprites.ts', sourceFn: 'bakeUIIcon ui_sound branch', spriteKey: 'ui_sound' },
  { id: 'ui.mute', label: '음소거 UI', category: 'ui', source: 'ui-icon', file: 'engine/sprites.ts', sourceFn: 'bakeUIIcon ui_mute branch', spriteKey: 'ui_mute' },
  { id: 'ui.music', label: '음악 UI', category: 'ui', source: 'ui-icon', file: 'engine/sprites.ts', sourceFn: 'bakeUIIcon ui_music branch', spriteKey: 'ui_music' },
  { id: 'ui.trash', label: '삭제 UI', category: 'ui', source: 'ui-icon', file: 'engine/sprites.ts', sourceFn: 'bakeUIIcon ui_trash branch', spriteKey: 'ui_trash' },
  { id: 'ui.settings', label: '설정 UI', category: 'ui', source: 'ui-icon', file: 'engine/sprites.ts', sourceFn: 'bakeUIIcon ui_settings branch', spriteKey: 'ui_settings' },
  { id: 'ui.wheat', label: '밀 UI', category: 'ui', source: 'ui-icon', file: 'engine/sprites.ts', sourceFn: 'bakeUIIcon ui_wheat branch', spriteKey: 'ui_wheat' },

  // Effects and runtime overlays.
  { id: 'effect.ground_item', label: '바닥 아이템 표시', category: 'effect', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawGroundItem', notes: '아이템 아이콘을 바닥에 작게 그림' },
  { id: 'effect.exhaust_bubble', label: '피곤해 말풍선', category: 'effect', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawExhaustBubble' },
  { id: 'effect.work_pose', label: '작업 모션/도구 휘두르기', category: 'effect', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawWorkPose' },
  { id: 'effect.hp_bar', label: '체력/작업 HP 바', category: 'effect', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawHpBar / drawWorldHpBar' },
  { id: 'effect.work_highlight', label: '작업 대상 하이라이트', category: 'effect', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawWorkHighlight' },
  { id: 'effect.particles', label: '파티클', category: 'effect', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawParticles' },
  { id: 'effect.lighting', label: '야간 조명', category: 'effect', source: 'runtime-draw', file: 'engine/game.ts', sourceFn: 'drawLighting' },
]

export const SPRITE_CATEGORIES = [...new Set(SPRITE_CATALOG.map((entry) => entry.category))]

export const SPRITE_INDEX: Record<string, SpriteCatalogEntry> = Object.fromEntries(
  SPRITE_CATALOG.map((entry) => [entry.id, entry]),
)

export function spriteCatalogByCategory(category: SpriteCategory): SpriteCatalogEntry[] {
  return SPRITE_CATALOG.filter((entry) => entry.category === category)
}
