import type { ProductInput, ProductAnalysis, VideoStrategy, VideoStoryboard, StoryboardScene } from '../core/types'
import type { CreativePlan } from '../creative/types'
import type { ContentAngle, ContentPlan, ImageInsight, ProductFact } from './types'
import {createCommerceCopy, factKeywords, intentForFact, visualMatch} from './commerce-copy'

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

export function planAdaptiveVideo(product: ProductInput, requestedDuration = 22, angle?: ContentAngle, vision: ImageInsight[] = [], preferredFocusId?: string) {
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
  const copy = createCommerceCopy(name, selectedAngle, facts, preferredFocusId)
  const hooks = copy.hooks
  const hook = hooks[0].text
  const cta = copy.cta
  const scenes: StoryboardScene[] = []
  const add = (type: StoryboardScene['type'], headline: string, voice: string, purpose: string, fallbackIndex = primaryIndex, fact?: ProductFact) => {
    const matches = inspected.map((image, index) => ({index, score: fact ? visualMatch(fact, image) : 0})).sort((a, b) => b.score - a.score)
    const targetIndex = fact?.assetId ? Math.max(0, images.findIndex((image) => image.id === fact.assetId)) : matches[0]?.score > 0 ? matches[0].index : fallbackIndex
    const asset = images[targetIndex]
    const insight = inspected[targetIndex]
    // A crop of a USB port must not illustrate an unrelated cable-length claim.
    const detail = type === 'benefit' && !!insight?.focus && !!fact && visualMatch(fact, insight) > 0
    scenes.push({id: `scene-${scenes.length + 1}`, type, duration: 3, headline: short(headline, 9), voice, tts: voice,
      productAssetIds: asset ? [asset.id] : [], backgroundType: 'color', keywords: fact ? factKeywords(fact.text) : [],
      subheadline: fact?.text,
      renderPlan: {purpose, assetId: asset?.id || '', assetIndex: targetIndex, framing: detail ? 'detail' : 'full', crop: detail ? insight.focus : insight?.productBounds,
        annotation: detail ? insight.observation : undefined, evidenceIds: fact ? [fact.id] : [],
        factLabel: fact ? intentForFact(fact).label : undefined, ctaLabel: type === 'cta' ? copy.intent.cta : undefined,
        copySource: 'rules', decisionPrompt: type === 'cta' ? copy.intent.clickReason : undefined},
    })
  }
  add('hook', copy.headline, hook, 'Nêu sản phẩm và một chi tiết có nguồn ngay từ đầu', primaryIndex, copy.focus)
  const concise = copy.orderedFacts.filter((fact) => words(fact.text).length <= 18)
  const firstFact = concise[0]
  add('product_hero', firstFact ? intentForFact(firstFact).label : name, firstFact?.text || `Quan sát ${name} qua ảnh sản phẩm.`, 'Cho thấy sản phẩm và thông tin chính', primaryIndex, firstFact)
  const detailCount = duration <= 18 ? 1 : duration <= 25 ? 2 : 3
  let hasCheck = false
  for (let index = 0; index < detailCount; index++) {
    const fact = concise[selectedAngle === 'fit' && index > 0 ? index : index + 1]
    const fallbackIndex = (index + 1) % Math.max(1, images.length)
    if (fact && selectedAngle !== 'fit') {
      add('benefit', intentForFact(fact).label, fact.text, 'Làm rõ một chi tiết có nguồn, chọn ảnh khớp thông tin', fallbackIndex, fact)
    } else if (fact && index > 0) {
      add('benefit', intentForFact(fact).label, fact.text, 'Thông tin bổ sung để đối chiếu trước khi chọn', fallbackIndex, fact)
    } else {
      const check = !hasCheck ? copy.intent.check : 'Kiểm tra ảnh và mô tả của đúng phiên bản bạn định đặt.'
      add('benefit', !hasCheck ? copy.intent.cta : 'Đúng phiên bản bạn cần?', check, 'Giải đáp việc cần kiểm tra trước khi đặt', fallbackIndex)
      hasCheck = true
    }
  }
  add('cta', copy.ctaHeadline, cta, 'Nêu rõ lý do nhấn sản phẩm trong giỏ hàng')
  const storyboard: VideoStoryboard = {scenes: distributeSceneDurations(scenes, duration), totalDuration: duration}
  const contentPlan: ContentPlan = {format, formatReason: `${images.length} ảnh, ${facts.length} thông tin có nguồn; chọn format theo dữ liệu hiện có.`, angle: selectedAngle,
    primaryBuyingReason: copy.focus?.text || 'Thiết kế và mức độ phù hợp với nhu cầu', focusFactId: copy.focus?.id, clickReason: copy.intent.clickReason, ctaLabel: copy.intent.cta, inputMode: !images.length ? 'details-only' : facts.length ? 'images-and-details' : 'image-only',
    images: inspected, facts, missingInformation, warnings, recommendedDuration: duration, source: 'rules'}
  const analysis: ProductAnalysis = {productType: product.name, mainProblem: product.problemSolved || 'Cần chọn sản phẩm phù hợp', mainBenefit: contentPlan.primaryBuyingReason,
    secondaryBenefits: (product.benefits || []).slice(1), targetAudience: product.targetAudience || 'Người đang cân nhắc sản phẩm này', sellingMechanism: format,
    visualDemoPotential: 'low', recommendedFormat: format, reasoningSummary: contentPlan.formatReason, claimsAllowed: facts.map((fact) => fact.text), claimsToAvoid: ['Trải nghiệm cá nhân chưa có', 'Hiệu quả chưa được chứng minh', 'Ưu đãi chưa xác minh']}
  const strategy: VideoStrategy = {concept: `Giúp chọn ${name} dựa trên ảnh và thông tin`, format, hook, angle: selectedAngle, tone: 'rõ ràng, tự nhiên', targetDuration: duration, cta,
    visualDirection: {mood: 'rõ sản phẩm', lighting: 'giữ ảnh gốc', palette: ['#f5f2eb', '#252922'], environment: 'nền trung tính'}}
  const creativePlan: CreativePlan = {concept: strategy.concept, viewerInsight: analysis.mainProblem, sellingMechanism: format, storyApproach: 'three-reasons', hook,
    story: storyboard.scenes.map((scene) => scene.voice).join(' '), productRole: name, payoff: contentPlan.primaryBuyingReason, offerAngle: 'Xem thông tin hiện tại tại trang sản phẩm',
    ctaAngle: cta, tone: strategy.tone, durationTarget: duration, pacing: 'medium', soundtrackMood: 'clean-warm', emotionalArc: ['Tò mò', 'Hiểu sản phẩm', 'Cân nhắc', 'Xem thêm'], cta,
    hookCandidates: hooks.map((candidate) => ({...candidate, headline: copy.headline, source: 'rules', evidenceIds: copy.focus ? [copy.focus.id] : [], type: 'curiosity', scores: {}})),
    selectedHook: {id: selectedAngle, text: hook}, spokenScenes: storyboard.scenes.map((scene) => ({headline: scene.headline, voice: scene.voice})), totalScenes: storyboard.scenes.length}
  return {analysis, strategy, storyboard, creativePlan, contentPlan, suggestedCaption: `${name}${copy.focus ? ` — ${copy.focus.text}` : ''}. ${copy.intent.clickReason} Xem sản phẩm trong giỏ hàng.`, suggestedHashtags: ['#sanpham', '#chonmua']}
}

export function withOpeningHook(scenes: StoryboardScene[], hook: string, duration: number, headline = hook, copy?: {source?: 'gemini' | 'rules'; evidenceIds?: string[]}): StoryboardScene[] {
  return distributeSceneDurations(scenes.map((scene, index) => index === 0 ? {...scene, voice: hook, tts: hook, headline,
    renderPlan: scene.renderPlan && copy ? {...scene.renderPlan, copySource: copy.source || scene.renderPlan.copySource, evidenceIds: copy.evidenceIds || scene.renderPlan.evidenceIds} : scene.renderPlan,
  } : scene), duration)
}
