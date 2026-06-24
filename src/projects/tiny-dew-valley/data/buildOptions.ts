import type { BuildOptionDef } from '../types'
import balance from './balance.json'

const buildBalance = Object.fromEntries(balance.fields.buildOptions.map((option) => [option.id, option]))

function optionBalance(id: string) {
  const option = buildBalance[id]
  if (!option) throw new Error(`Missing field build balance: ${id}`)
  return option
}

export const BUILD_OPTIONS: BuildOptionDef[] = [
  {
    ...optionBalance('field_east'),
    name: '동쪽 밭 확장',
    description: '자동 파종/수확이 가능한 밭 6칸을 더 씁니다.',
  },
  {
    ...optionBalance('field_south'),
    name: '아랫밭 정리',
    description: '작물 구역 아래쪽에 밭 12칸을 추가합니다.',
  },
  {
    ...optionBalance('field_far_east'),
    name: '넓은 밭 확장',
    description: '동쪽 빈 땅을 정리해 밭 10칸을 추가합니다.',
  },
]
