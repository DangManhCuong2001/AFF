import type {ProductFact} from './types'
import {distinctFacts} from './copy-novelty'
import {isProductDetail} from './product-facts'

export type VideoDurationSelection = 'auto' | 15 | 22 | 30 | 45
export type DurationMode = 'auto' | 'manual'
export const isVideoDurationSelection = (value: unknown): value is VideoDurationSelection => value === 'auto' || [15, 22, 30, 45].includes(value as number)

/** A content budget, never a mandatory minimum or filler to reach twenty seconds. */
export function automaticDuration(facts: ProductFact[]) {
  const count = distinctFacts(facts.filter(fact => isProductDetail(fact.text) && fact.text.trim().split(/\s+/).length <= 18)).length
  const seconds = count === 0 ? 12 : count === 1 ? 18 : count === 2 ? 24 : count === 3 ? 28 : 35
  const ceiling = count === 0 ? 15 : count === 1 ? 20 : count === 2 ? 30 : count === 3 ? 35 : 45
  const reason = count === 0 ? 'Chưa đủ chi tiết có nguồn; dùng bản giới thiệu ngắn, không kéo dài bằng câu lặp.'
    : count === 1 ? 'Một điểm chính có nguồn; đủ cho câu mở, giải thích và lời mời xem sản phẩm.'
    : `${count} chi tiết khác nhau có nguồn; đủ để nêu nhu cầu, giải thích điểm chính và thêm căn cứ trước lời mời xem sản phẩm.`
  return {seconds, ceiling, reason}
}
