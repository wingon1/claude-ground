import type { NPCDef } from '../types'

// Two rich, data-driven characters. Times are in minutes-of-day (0..1440).
export const NPCS: Record<string, NPCDef> = {
  barnaby: {
    id: 'barnaby',
    name: 'Barnaby',
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
      'Welcome, welcome! The General Store always has a smile in stock.',
      'A good harvest starts with good seeds — and good company!',
      "Folks say I talk too much. I say I'm just generously priced on words!",
      'That old shrine up north? My grandpa swore it blessed the whole valley.',
      'Sell me your crops fresh and the whole town eats well. Win-win!',
    ],
    timeLines: [
      {
        from: 8 * 60,
        to: 17 * 60,
        lines: [
          'Counter\'s open! What can I get for you today?',
          'Fresh seeds just came in. Spring waits for no farmer!',
        ],
      },
      {
        from: 17 * 60,
        to: 20 * 60,
        lines: [
          'Closing up soon — just stretching my legs round the square.',
          'Evening air does a shopkeeper good. Care to walk a spell?',
        ],
      },
    ],
    milestoneLines: {
      2: "You know, you're becoming a regular! Here — a little seed discount, friend to friend.",
      4: 'A real farmer needs a real pack. I had this backpack sized up just for you!',
      5: "You're family now. I'll throw in a shipping bonus on everything you sell. Cheers!",
    },
    giftReactions: {
      loved: ['Oh my stars — for ME? This is magnificent! Thank you, truly!'],
      liked: ['Well now, that\'s a fine gift! Much obliged, friend.'],
      neutral: ['Hm, thoughtful of you. I\'ll find a use for it!'],
      disliked: ['Ah... I appreciate the thought, I suppose.'],
      hated: ['A rock? You\'re... pulling my leg, surely?'],
    },
  },
  faye: {
    id: 'faye',
    name: 'Faye',
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
      'The woods whisper, if you slow down enough to listen.',
      'Every weed is a herb that hasn\'t been understood yet.',
      'I prefer the company of daffodils. They never interrupt.',
      'You smell of fresh soil. That\'s a compliment, where I come from.',
      'The valley remembers more than the townsfolk do.',
    ],
    timeLines: [
      {
        from: 6 * 60,
        to: 12 * 60,
        lines: [
          'Morning dew is the best medicine. Don\'t let it dry unseen.',
          'I gather what the night left behind. Quiet work, good work.',
        ],
      },
      {
        from: 17 * 60,
        to: 20 * 60,
        lines: [
          'The shrine hums at dusk. Can you feel it too?',
          'Old stones, old promises. Someday this place will wake again.',
        ],
      },
    ],
    milestoneLines: {
      3: 'You\'ve earned a little trust. Here — my Herbal Tea recipe. It steadies the body and the spirit.',
      5: 'Few have seen the woods as I do. Take this knowledge: nourishment will linger longer in you now.',
    },
    giftReactions: {
      loved: ['Daffodils... you remembered. They\'re radiant. Thank you, gardener.'],
      liked: ['How kind. The woods approve of you a little more today.'],
      neutral: ['I\'ll keep it. Everything has its season.'],
      disliked: ['Cut wood? The trees and I would rather you hadn\'t.'],
      hated: ['A cold, dead stone. Please... don\'t.'],
    },
  },
}

export const NPC_LIST = Object.values(NPCS)
