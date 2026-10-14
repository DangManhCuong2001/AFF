import type { ProductInput, ProductAnalysis, VideoStrategy, VideoStoryboard, StoryboardScene } from '../core/types'
import type { CreativePlan } from '../creative/types'
import type { ContentAngle, ContentPlan, ImageInsight, ProductFact } from './types'

export const isProductImage = (asset: ProductInput['assets'][number]) => ['image', 'PRODUCT_IMAGE', 'DETAIL_IMAGE'].includes(asset.type)
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean)
const short = (text: string, limit = 16) => words(text).length <= limit ? text : words(text).slice(0, limit).join(' ') + '…'
const firstStatement = (text: string) => text.trim().split(/(?:[.!?](?=\s|$)|\n)/).find(Boolean)?.trim() || ''

export function collectProductFacts(product: ProductInput): ProductFact[] {
  const raw = [...(product.features || []), ...(product.benefits || []), ...(product.description || '').split(/[;\n]/), product.howToUse || '']
  const unique = [...new Set(raw.map(firstStatement).filter(Boolean))]
  // Price/discount copy is not evergreen evidence for video claims.
  return unique.filter((text) => !/\d[\d.,]*\s*(?:k\b|đ|₫|vnd|%)/i.test(text)).slice(0, 8)
    .map((text, index) => ({id: `fact-${index + 1}`, text, source: 'user_input'}))
}

export function distributeSceneDurations(scenes: StoryboardScene[], duration: number): StoryboardScene[] {
  const weights = scenes.map((scene) => Math.max(5, words(scene.voice).length))
  const sum = weights.reduce((total, count) => total + count, 0)
  let remaining = Math.round(duration * 10)
  return scenes.map((scene, index) => {
    const ticks = index === scenes.length - 1 ? remaining : Math.round(duration * 10 * weights[index] / sum)
    remaining -= ticks
    return {...scene, duration: ticks / 10, tts: scene.voice}
  })
}

export function planAdaptiveVideo(product: ProductInput, requestedDuration = 22, angle?: ContentAngle, vision: ImageInsight[] = []) {
  const images = (product.assets || []).filter(isProductImage)
  const primaryIndex = Math.max(0, images.findIndex((asset) => asset.isPrimary))
  const facts = collectProductFacts(product)
  const inspected = images.map<ImageInsight>((asset) => vision.find((image) => image.assetId === asset.id) || {
    assetId: asset.id, role: asset.role === 'detail' || asset.type === 'DETAIL_IMAGE' ? 'detail' : asset.role === 'lifestyle' ? 'lifestyle' : asset.role === 'packaging' ? 'packaging' : 'primary', source: 'metadata',
  })
  for (const image of inspected) {
    if (image.source === 'vision' && image.observation) facts.push({id: `image-${image.assetId}`, text: image.observation, source: 'image', assetId: image.assetId})
  }
  const selectedAngle = angle || (facts.length >= 2 ? 'features' : 'design')
  const format = selectedAngle === 'fit' ? 'buying-guide' : selectedAngle === 'design' ? 'design-showcase' : product.problemSolved && product.benefits?.length ? 'problem-solution' : 'feature-explainer'
  const missingInformation = [!product.description && 'Mô tả sản phẩm', !product.features?.length && 'Thông số hoặc tính năng', !product.howToUse && 'Cách sử dụng / tương thích', images.length < 2 && 'Ảnh chi tiết hoặc góc chụp bổ sung'].filter((value): value is string => !!value)
  const warnings: string[] = []
  if (!images.length) warnings.push('Chưa có ảnh sản phẩm; cần thêm ảnh trước khi xuất video.')
  if (!facts.length) warnings.push('Ít dữ liệu: dùng nội dung chọn mua và thiết kế, không khẳng định hiệu quả sử dụng.')
  if (images.length === 1) warnings.push('Chỉ có một ảnh: giữ góc sản phẩm gốc, không mô phỏng mặt sau hoặc thao tác chưa thấy.')
  if (!inspected.some((image) => image.source === 'vision')) warnings.push('Chưa đọc được nội dung ảnh; bố cục dùng toàn ảnh và vai trò ảnh do bạn cung cấp.')
  const maxDuration = facts.length >= 4 && images.length >= 3 ? 40 : facts.length >= 2 ? 25 : 18
  const duration = Math.max(12, Math.min(requestedDuration, maxDuration))
  if (duration < requestedDuration) warnings.push(`Đề xuất ${duration}s vì dữ liệu hiện có chưa đủ cho ${requestedDuration}s.`)
  const name = short(product.name, 8)
  const hooks = [
    {id: 'design', text: `Bạn thích thiết kế này? Nhìn kỹ ${name}.`},
    {id: 'features', text: `${name}: xem điểm nào trước khi chọn?`},
    {id: 'fit', text: `Đang chọn ${name}? Kiểm tra trước khi mua.`},
  ]
  const hook = hooks.find((candidate) => candidate.id === selectedAngle)!.text
  const cta = 'Nhấn sản phẩm trong giỏ hàng để xem thông số và giá hiện tại.'
  const scenes: StoryboardScene[] = []
  const add = (type: StoryboardScene['type'], headline: string, voice: string, purpose: string, assetIndex = primaryIndex, fact?: ProductFact) => {
    const targetIndex = fact?.assetId ? Math.max(0, images.findIndex((image) => image.id === fact.assetId)) : assetIndex
    const asset = images[targetIndex]
    const insight = inspected[targetIndex]
    const detail = type === 'benefit' && !!insight?.focus
    scenes.push({id: `scene-${scenes.length + 1}`, type, duration: 3, headline: short(headline, 7), voice, tts: voice,
      productAssetIds: asset ? [asset.id] : [], backgroundType: 'color', keywords: [],
      subheadline: fact ? short(fact.text, 12) : undefined,
      renderPlan: {purpose, assetId: asset?.id || '', assetIndex: targetIndex, framing: detail ? 'detail' : 'full', crop: detail ? insight.focus : insight?.productBounds,
        annotation: detail ? short(insight.observation || headline, 7) : undefined, evidenceIds: fact ? [fact.id] : []},
    })
  }
  add('hook', selectedAngle === 'fit' ? 'Hợp nhu cầu của bạn?' : selectedAngle === 'design' ? 'Nhìn kỹ thiết kế này' : 'Xem gì trước khi chọn?', hook, 'Thu hút đúng người đang cân nhắc sản phẩm')
  add('product_hero', name, `Đây là ${name}. Xem ảnh và thông tin trước khi chọn.`, 'Cho thấy rõ sản phẩm', primaryIndex)
  const detailCount = duration <= 18 ? 1 : duration <= 25 ? 2 : 3
  if (selectedAngle === 'fit') {
    add('benefit', 'Kiểm tra trước khi chọn', 'Đối chiếu kích thước và thông tin tương thích với nhu cầu của bạn.', 'Giải đáp băn khoăn về độ phù hợp', images.length > 1 ? 1 : primaryIndex)
    if (facts[0] && detailCount > 1) add('benefit', 'Thông tin cần xem', words(facts[0].text).length <= 18 ? facts[0].text : 'Đọc kỹ mô tả và thông số tại trang sản phẩm trước khi chọn.', 'Trình bày thông tin từ đầu vào', primaryIndex, facts[0])
  } else if (facts.length) {
    facts.slice(0, detailCount).forEach((fact, index) => add('benefit', fact.source === 'image' ? 'Chi tiết trong ảnh' : 'Thông tin sản phẩm', words(fact.text).length <= 18 ? fact.text : 'Đọc kỹ chi tiết này tại trang sản phẩm trước khi chọn.', 'Làm rõ một thông tin có nguồn', (index + 1) % Math.max(1, images.length), fact))
  } else {
    add('benefit', 'Xem kỹ ảnh và thông số', 'Quan sát thiết kế. Kiểm tra kích thước và phiên bản tại trang sản phẩm.', 'Giúp chọn mua khi ít thông tin', primaryIndex)
  }
  add('cta', 'Xem trong giỏ hàng', cta, 'Mời xem thông tin và lựa chọn sản phẩm')
  const storyboard: VideoStoryboard = {scenes: distributeSceneDurations(scenes, duration), totalDuration: duration}
  const contentPlan: ContentPlan = {format, formatReason: `${images.length} ảnh, ${facts.length} thông tin có nguồn; chọn format theo dữ liệu hiện có.`, angle: selectedAngle,
    primaryBuyingReason: facts[0]?.text || 'Thiết kế và mức độ phù hợp với nhu cầu', inputMode: !images.length ? 'details-only' : facts.length ? 'images-and-details' : 'image-only',
    images: inspected, facts, missingInformation, warnings, recommendedDuration: duration, source: 'rules'}
  const analysis: ProductAnalysis = {productType: product.name, mainProblem: product.problemSolved || 'Cần chọn sản phẩm phù hợp', mainBenefit: contentPlan.primaryBuyingReason,
    secondaryBenefits: (product.benefits || []).slice(1), targetAudience: product.targetAudience || 'Người đang cân nhắc sản phẩm này', sellingMechanism: format,
    visualDemoPotential: 'low', recommendedFormat: format, reasoningSummary: contentPlan.formatReason, claimsAllowed: facts.map((fact) => fact.text), claimsToAvoid: ['Trải nghiệm cá nhân chưa có', 'Hiệu quả chưa được chứng minh', 'Ưu đãi chưa xác minh']}
  const strategy: VideoStrategy = {concept: `Giúp chọn ${name} dựa trên ảnh và thông tin`, format, hook, angle: selectedAngle, tone: 'rõ ràng, tự nhiên', targetDuration: duration, cta,
    visualDirection: {mood: 'rõ sản phẩm', lighting: 'giữ ảnh gốc', palette: ['#f5f2eb', '#252922'], environment: 'nền trung tính'}}
  const creativePlan: CreativePlan = {concept: strategy.concept, viewerInsight: analysis.mainProblem, sellingMechanism: format, storyApproach: 'three-reasons', hook,
    story: storyboard.scenes.map((scene) => scene.voice).join(' '), productRole: name, payoff: contentPlan.primaryBuyingReason, offerAngle: 'Xem thông tin hiện tại tại trang sản phẩm',
    ctaAngle: cta, tone: strategy.tone, durationTarget: duration, pacing: 'medium', soundtrackMood: 'clean-warm', emotionalArc: ['Tò mò', 'Hiểu sản phẩm', 'Cân nhắc', 'Xem thêm'], cta,
    hookCandidates: hooks.map((candidate) => ({...candidate, type: 'curiosity', reasoning: 'Góc nội dung theo dữ liệu sản phẩm', scores: {}})),
    selectedHook: {id: selectedAngle, text: hook}, spokenScenes: storyboard.scenes.map((scene) => ({headline: scene.headline, voice: scene.voice})), totalScenes: storyboard.scenes.length}
  return {analysis, strategy, storyboard, creativePlan, contentPlan, suggestedCaption: `${name} — xem chi tiết và lựa chọn phù hợp trong giỏ hàng.`, suggestedHashtags: ['#sanpham', '#chonmua']}
}
