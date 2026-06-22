import type { NPCDef } from '../types'

// 데이터 기반 두 캐릭터. 시간은 하루의 분 단위(0..1440).
export const NPCS: Record<string, NPCDef> = {
  barnaby: {
    id: 'barnaby',
    name: '바나비',
    color: '#c8763e',
    accent: '#fbe3b3',
    heartsMax: 5,
    pointsPerHeart: 200,
    giftPrefs: {
      loved: ['crop_golden_pumpkin_perfect', 'crop_golden_pumpkin_gold'],
      liked: ['crop_strawberry_normal', 'herbal_tea', 'crop_parsnip_normal'],
      disliked: ['wood'],
      hated: ['stone'],
    },
    normalLines: [
      '어서 오게, 어서 와! 잡화점엔 늘 미소가 재고로 있다네.',
      '좋은 수확은 좋은 씨앗에서, 그리고 좋은 친구에서 시작되지!',
      '사람들은 내가 말이 많다고 하지만, 난 그냥 말값을 후하게 쳐주는 거라네!',
      '북쪽의 저 오래된 신단 말이야? 우리 할아버지는 저게 골짜기 전체를 축복했다고 믿으셨지.',
      '자네 작물을 신선하게 팔아주면 온 마을이 잘 먹는다네. 서로 좋은 일이지!',
    ],
    timeLines: [
      {
        from: 8 * 60,
        to: 17 * 60,
        lines: [
          '계산대 열렸네! 오늘은 뭘 도와드릴까?',
          '새 씨앗이 막 들어왔어. 봄은 농부를 기다려주지 않으니까!',
        ],
      },
      {
        from: 17 * 60,
        to: 20 * 60,
        lines: [
          '곧 문 닫으려고 — 광장에서 다리 좀 풀고 있다네.',
          '저녁 공기는 가게 주인에게도 보약이지. 같이 좀 걸을 텐가?',
        ],
      },
    ],
    milestoneLines: {
      2: '있잖나, 자네 이제 단골이 다 됐어! 자, 친구끼리 씨앗 할인 좀 해주지.',
      4: '진짜 농부에겐 진짜 가방이 필요한 법! 자네한테 딱 맞게 가방을 키워뒀다네!',
      5: '이제 한 식구나 다름없지. 자네가 파는 건 뭐든 출하 보너스를 얹어주겠네. 건배!',
    },
    giftReactions: {
      loved: ['세상에 — 나를 주는 건가? 정말 훌륭하군! 진심으로 고맙네!'],
      liked: ['오호, 이거 좋은 선물인걸! 고맙게 받겠네, 친구.'],
      neutral: ['음, 마음 써줘서 고맙군. 잘 쓰겠네!'],
      disliked: ['아... 마음은 고맙게 받겠네, 그래.'],
      hated: ['돌이라고? 설마 나 놀리는 건 아니겠지?'],
    },
  },
  faye: {
    id: 'faye',
    name: '페이',
    color: '#6e8f5e',
    accent: '#d9c6ec',
    heartsMax: 5,
    pointsPerHeart: 200,
    giftPrefs: {
      loved: ['daffodil'],
      liked: ['crop_strawberry_normal', 'herbal_tea'],
      disliked: ['wood', 'hardwood'],
      hated: ['stone'],
    },
    normalLines: [
      '충분히 천천히 걸으면, 숲이 속삭이는 소리가 들려요.',
      '모든 잡초는 아직 이해받지 못한 약초일 뿐이죠.',
      '난 수선화와 함께 있는 게 좋아요. 절대 말을 끊지 않거든요.',
      '당신에게선 갓 갈아엎은 흙 냄새가 나요. 내 고향에선 그게 칭찬이에요.',
      '이 골짜기는 마을 사람들보다 더 많은 걸 기억하고 있어요.',
    ],
    timeLines: [
      {
        from: 6 * 60,
        to: 12 * 60,
        lines: [
          '아침 이슬이 최고의 약이에요. 보지도 못한 채 마르게 두지 말아요.',
          '난 밤이 남긴 것들을 모아요. 조용한 일, 좋은 일이죠.',
        ],
      },
      {
        from: 17 * 60,
        to: 20 * 60,
        lines: [
          '해질녘이면 신단이 울려요. 당신도 느껴지나요?',
          '오래된 돌, 오래된 약속. 언젠가 이곳은 다시 깨어날 거예요.',
        ],
      },
    ],
    milestoneLines: {
      3: '조금은 신뢰를 얻으셨네요. 자 — 내 허브차 비법이에요. 몸과 마음을 다잡아 주죠.',
      5: '숲을 나처럼 보는 사람은 드물어요. 이 지식을 받아요: 이제 양분이 당신 안에 더 오래 머물 거예요.',
    },
    giftReactions: {
      loved: ['수선화라니... 기억하고 있었군요. 정말 눈부셔요. 고마워요, 정원사님.'],
      liked: ['친절하기도 하지. 오늘 숲이 당신을 조금 더 마음에 들어 하네요.'],
      neutral: ['받아둘게요. 모든 것엔 제철이 있으니까요.'],
      disliked: ['잘린 나무라니. 나무들도 나도 그러지 않았으면 했어요.'],
      hated: ['차갑고 죽은 돌이군요. 제발... 그러지 말아요.'],
    },
  },
}

export const NPC_LIST = Object.values(NPCS)
