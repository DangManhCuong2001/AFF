import type { ProductInput, ProductAnalysis, VideoStrategy, VideoStoryboard, StoryboardScene } from '../core/types'
import type { CreativePlan } from '../creative/types'
import type { ContentAngle, ContentPlan, ImageInsight, ProductFact } from './types'
import {distinctFacts} from './copy-novelty'
import {extractProductFacts, isMerchantCopy, isProductDetail} from './product-facts'
import {buyingProfileFor} from './buying-profile'
import {rankCommerceHooks} from './hook-ranking'
import {buildCommerceMessage} from './message-plan'
import {planSceneLayouts} from './scene-layouts'
import {createCommerceCopy, factKeywords, intentForFact, sellingBody, visualMatch} from './commerce-copy'
import {automaticDuration, type DurationMode} from './duration'

export const isProductImage = (asset: ProductInput['assets'][number]) => ['image', 'PRODUCT_IMAGE', 'DETAIL_IMAGE'].includes(asset.type)
const words = (text: string) => text.trim().split(/\s+/).filter(Boolean)
const short = (text: string, limit = 16) => words(text).length <= limit ? text : words(text).slice(0, limit).join(' ') + '…'

export function collectProductFacts(product: ProductInput): ProductFact[] {
  return extractProductFacts(product).facts
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

export function planAdaptiveVideo(product: ProductInput, requestedDuration = 22, angle?: ContentAngle, vision: ImageInsight[] = [], preferredFocusId?: string, durationMode: DurationMode = 'manual') {
  const images = (product.assets || []).filter(isProductImage)
  const primaryIndex = Math.max(0, images.findIndex((asset) => asset.isPrimary))
  const extraction = extractProductFacts(product)
  const facts = extraction.facts
  const inspected = images.map<ImageInsight>((asset) => vision.find((image) => image.assetId === asset.id) || {
    assetId: asset.id, role: asset.role === 'detail' || asset.type === 'DETAIL_IMAGE' ? 'detail' : asset.role === 'lifestyle' ? 'lifestyle' : asset.role === 'packaging' ? 'packaging' : 'primary', source: 'metadata',
  }).map((image) => image.observation && !isProductDetail(image.observation) ? {...image, observation: undefined} : image)
  for (const image of inspected) {
    if (image.source !== 'vision') continue
    if (image.observation) facts.push({id: `image-${image.assetId}`, text: image.observation, source: 'image', assetId: image.assetId})
    for (const [index, detail] of (image.details || []).entries()) {
      if (isProductDetail(detail.text) && words(detail.text).length <= 18) facts.push({id: `image-${image.assetId}-detail-${index + 1}`, text: detail.text, source: 'image', assetId: image.assetId})
    }
  }
  const preferred = facts.find((fact) => fact.id === preferredFocusId)
  const usefulFacts = distinctFacts(preferred ? [preferred, ...facts.filter((fact) => fact !== preferred)] : facts).filter((fact) => words(fact.text).length <= 18)
  const profile = buyingProfileFor(product)
  const selectedAngle = angle || (usefulFacts.length >= 2 ? 'features' : 'design')
  const problem = product.problemSolved && isProductDetail(product.problemSolved) ? product.problemSolved : undefined
  const audience = product.targetAudience && !isMerchantCopy(product.targetAudience) ? product.targetAudience : 'Người đang cân nhắc sản phẩm này'
  const format = selectedAngle === 'fit' ? 'buying-guide' : selectedAngle === 'design' ? 'design-showcase' : problem && extraction.cleaned.benefits.length ? 'problem-solution' : 'feature-explainer'
  const missingInformation = [!extraction.cleaned.description && !extraction.cleaned.features.length && 'Mô tả hoặc thông số riêng của sản phẩm', !extraction.cleaned.howToUse && 'Cách sử dụng / tương thích', images.length < 2 && 'Ảnh chi tiết hoặc góc chụp bổ sung'].filter((value): value is string => !!value)
  const warnings: string[] = []
  if (extraction.excludedCount) warnings.push(`Đã bỏ ${extraction.excludedCount} dòng tiêu đề, quảng cáo hoặc chính sách không mô tả đặc điểm sản phẩm.`)
  if (!images.length) warnings.push('Chưa có ảnh sản phẩm; cần thêm ảnh trước khi xuất video.')
  if (!facts.length) warnings.push('Ít dữ liệu: dùng nội dung chọn mua và thiết kế, không khẳng định hiệu quả sử dụng.')
  else if (!usefulFacts.length) warnings.push('Thông tin đầu vào còn dài; dùng video ngắn, ưu tiên bổ sung mô tả từng chi tiết cụ thể.')
  if (images.length === 1) warnings.push('Chỉ có một ảnh: giữ góc sản phẩm gốc, không mô phỏng mặt sau hoặc thao tác chưa thấy.')
  if (!inspected.some((image) => image.source === 'vision')) warnings.push('Chưa đọc được nội dung ảnh; bố cục dùng toàn ảnh và vai trò ảnh do bạn cung cấp.')
  const automatic = automaticDuration(usefulFacts)
  // Use the same content allowance as auto mode. The old manual cap (e.g. 22s
  // for three facts) rejected a valid 30s request despite auto allowing 28s.
  const maxDuration = usefulFacts.length >= 4 && images.length >= 3 ? 40 : automatic.seconds
  const duration = durationMode === 'auto' ? automatic.seconds : Math.max(12, Math.min(requestedDuration, maxDuration))
  if (durationMode === 'manual' && duration < requestedDuration) warnings.push(`Đề xuất ${duration}s vì dữ liệu hiện có chưa đủ cho ${requestedDuration}s.`)
  const name = short(product.name, 8)
  const copy = createCommerceCopy(name, selectedAngle, usefulFacts, preferredFocusId, profile.priorities)
  let hook = copy.hooks[0].text
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
      subheadline: type !== 'cta' ? fact?.text : undefined,
      renderPlan: {purpose, assetId: asset?.id || '', assetIndex: targetIndex, framing: detail ? 'detail' : 'full', crop: detail ? insight.focus : insight?.productBounds,
        annotation: detail ? insight.observation : undefined, evidenceIds: fact ? [fact.id] : [],
        factLabel: fact ? intentForFact(fact).label : undefined, ctaLabel: type === 'cta' ? copy.intent.cta : undefined,
        copySource: 'rules', decisionPrompt: type === 'cta' ? copy.buyerQuestion : undefined},
    })
  }
  add('hook', copy.headline, hook, 'Nêu sản phẩm và một chi tiết có nguồn ngay từ đầu', primaryIndex, copy.focus)
  const concise = copy.orderedFacts.filter((fact) => words(fact.text).length <= 18)
  const firstFact = concise[0]
  add('product_hero', firstFact ? intentForFact(firstFact).label : name, firstFact ? sellingBody(firstFact) : `Quan sát ${name} qua ảnh sản phẩm.`, 'Giải thích chi tiết chính và lý do cân nhắc theo nhu cầu', primaryIndex, firstFact)
  const bodyLimit = duration <= 18 ? 2 : duration <= 25 ? 3 : 4
  for (const [index, fact] of concise.slice(1, bodyLimit).entries()) {
    const voice = selectedAngle === 'fit' ? sellingBody(fact) : fact.text
    add('benefit', intentForFact(fact).label, voice, 'Bổ sung một thông tin có nguồn để chọn mua', (index + 1) % Math.max(1, images.length), fact)
  }
  add('cta', copy.ctaHeadline, cta, 'Nêu rõ lý do nhấn sản phẩm trong giỏ hàng', primaryIndex, copy.focus)
  const candidates = copy.hooks.map((candidate) => ({...candidate, headline: copy.headline, source: 'rules' as const, evidenceIds: copy.focus ? [copy.focus.id] : [], type: 'curiosity' as const, scores: {}}))
  const ranked = rankCommerceHooks(candidates, {product, facts, scenes, images: inspected, focusId: copy.focus?.id})
  const hooks = ranked.length ? ranked : [{...candidates[0], text: `${name}: xem chi tiết trong ảnh.`, evidenceIds: [], reasoning: 'Giới thiệu ảnh sản phẩm khi chưa có câu mở đáp ứng kiểm tra nguồn.'}]
  const selected = hooks[0]
  hook = selected.text
  scenes[0] = {...scenes[0], voice: hook, tts: hook, headline: selected.headline, renderPlan: {...scenes[0].renderPlan!, evidenceIds: selected.evidenceIds}}
  const storyboard: VideoStoryboard = {scenes: distributeSceneDurations(planSceneLayouts(scenes, images, inspected, facts), duration), totalDuration: duration}
  const contentPlan: ContentPlan = {message: buildCommerceMessage(product, facts, storyboard.scenes, inspected, copy.focus?.id, copy.buyerQuestion), buyingProfile: profile, format, formatReason: `${images.length} ảnh, ${usefulFacts.length} ý khác nhau có nguồn; chọn số cảnh theo nội dung hiện có.`, angle: selectedAngle,
    primaryBuyingReason: copy.focus?.text || 'Thiết kế và mức độ phù hợp với nhu cầu', buyerQuestion: copy.buyerQuestion, focusFactId: copy.focus?.id, clickReason: copy.intent.clickReason, ctaLabel: copy.intent.cta, inputMode: !images.length ? 'details-only' : facts.length ? 'images-and-details' : 'image-only',
    images: inspected, facts, missingInformation, warnings, recommendedDuration: duration, source: 'rules',
    durationPlan: {mode: durationMode, source: 'rules', suggestedSeconds: duration, reason: durationMode === 'auto' ? automatic.reason : duration < requestedDuration ? `Bạn chọn ${requestedDuration}s; dữ liệu hiện có phù hợp bản ${duration}s hơn, tránh kéo dài bằng câu lặp.` : `Lập kế hoạch theo mốc ${requestedDuration}s bạn chọn. Thời lượng cuối được cập nhật theo giọng đọc.`, ...(durationMode === 'manual' ? {requestedSeconds: requestedDuration} : {})}}
  const analysis: ProductAnalysis = {productType: product.name, mainProblem: problem || 'Cần chọn sản phẩm phù hợp', mainBenefit: contentPlan.primaryBuyingReason,
    secondaryBenefits: extraction.cleaned.benefits.slice(1), targetAudience: audience, sellingMechanism: format,
    visualDemoPotential: 'low', recommendedFormat: format, reasoningSummary: contentPlan.formatReason, claimsAllowed: facts.map((fact) => fact.text), claimsToAvoid: ['Trải nghiệm cá nhân chưa có', 'Hiệu quả chưa được chứng minh', 'Ưu đãi chưa xác minh']}
  const strategy: VideoStrategy = {concept: `Giúp chọn ${name} dựa trên ảnh và thông tin`, format, hook, angle: selectedAngle, tone: 'rõ ràng, tự nhiên', targetDuration: duration, cta,
    visualDirection: {mood: 'rõ sản phẩm', lighting: 'giữ ảnh gốc', palette: ['#f5f2eb', '#252922'], environment: 'nền trung tính'}}
  const creativePlan: CreativePlan = {concept: strategy.concept, viewerInsight: analysis.mainProblem, sellingMechanism: format, storyApproach: 'three-reasons', hook,
    story: storyboard.scenes.map((scene) => scene.voice).join(' '), productRole: name, payoff: contentPlan.primaryBuyingReason, offerAngle: 'Xem thông tin hiện tại tại trang sản phẩm',
    ctaAngle: cta, tone: strategy.tone, durationTarget: duration, pacing: 'medium', soundtrackMood: 'clean-warm', emotionalArc: ['Tò mò', 'Hiểu sản phẩm', 'Cân nhắc', 'Xem thêm'], cta,
    hookCandidates: hooks,
    selectedHook: selected, spokenScenes: storyboard.scenes.map((scene) => ({headline: scene.headline, voice: scene.voice})), totalScenes: storyboard.scenes.length}
  return {analysis, strategy, storyboard, creativePlan, contentPlan, suggestedCaption: `${name}${copy.focus ? ` — ${copy.focus.text}` : ''}. ${copy.intent.clickReason} Xem sản phẩm trong giỏ hàng.`, suggestedHashtags: ['#sanpham', '#chonmua']}
}

export function withOpeningHook(scenes: StoryboardScene[], hook: string, duration: number, headline = hook, copy?: {source?: 'gemini' | 'rules'; evidenceIds?: string[]}): StoryboardScene[] {
  return distributeSceneDurations(scenes.map((scene, index) => index === 0 ? {...scene, voice: hook, tts: hook, headline,
    renderPlan: scene.renderPlan && copy ? {...scene.renderPlan, copySource: copy.source || scene.renderPlan.copySource, evidenceIds: copy.evidenceIds || scene.renderPlan.evidenceIds} : scene.renderPlan,
  } : scene), duration)
}
