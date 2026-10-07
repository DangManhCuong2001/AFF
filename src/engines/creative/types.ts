import { ProductAnalysis, ProductInput } from '@/engines/core/types'

export type StoryApproach =
  | 'micro-story'
  | 'problem-solution'
  | 'curiosity-test'
  | 'before-after'
  | 'relatable-moment'
  | 'unexpected-use'
  | 'mini-review'
  | 'pov'
  | 'three-reasons'
  | 'satisfying'
  | 'challenge'
  | 'comparison'
  | 'daily-frustration'

export interface HookCandidate {
  id: string
  text: string
  type: 'observation' | 'confession' | 'problem' | 'curiosity' | 'test' | 'pov'
  scores: {
    curiosity: number // 0-100
    relatability: number // 0-100
    specificity: number // 0-100
    visualPotential: number // 0-100
    clarity: number // 0-100
    total: number // 0-100 weighted
  }
  reasoning: string
}

export type EmotionalTone =
  | 'recognition'
  | 'annoyance'
  | 'relatable_frustration'
  | 'curiosity'
  | 'interest'
  | 'relief'
  | 'confidence'
  | 'satisfaction'
  | 'desire'
  | 'friendly_urgency'

export interface CreativeScore {
  hookScore: number // 0-100
  relatabilityScore: number // 0-100
  visualVarietyScore: number // 0-100
  productClarityScore: number // 0-100
  storyScore: number // 0-100
  offerScore: number // 0-100
  overallQuality: number // 0-100
  needsRevision: boolean
  revisionNotes?: string[]
}

export interface SpokenScene {
  beat: string
  headline: string
  voice: string
  sticker?: string
  keywords?: string[]
}

export interface CreativePlan {
  concept: string
  viewerInsight: string
  sellingMechanism: string
  emotionalArc: EmotionalTone[]
  storyType: StoryApproach
  hookCandidates: HookCandidate[]
  selectedHook: HookCandidate
  story: string
  payoff: string
  offerAngle: string
  cta: string
  duration: 15 | 30 | 45
  creativeScore: CreativeScore
  openLoop?: {
    setup: string
    payoff: string
  }
  spokenScenes?: SpokenScene[]
}

export interface CreativeDirector {
  createCreativePlan(
    product: ProductInput,
    analysis: ProductAnalysis,
    options?: {
      targetDuration?: 15 | 30 | 45
      approach?: StoryApproach
      geminiApiKey?: string
    }
  ): Promise<CreativePlan>
}
