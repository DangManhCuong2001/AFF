export interface GenerativeVideoClip {
  id: string
  purpose: 'problem_context' | 'lifestyle_context' | 'camera_motion' | 'result_payoff'
  videoUrl?: string
  fallbackImageUrl: string
  motionPrompt: string
  durationSec: number
  fidelityGuaranteed: boolean
}

export interface GenerativeVideoProvider {
  generateContextShot(params: {
    productName: string
    sceneType: 'problem' | 'lifestyle' | 'demo'
    durationSec: number
    apiKey?: string
  }): Promise<GenerativeVideoClip>
}

export class VipeeGenerativeVideoProvider implements GenerativeVideoProvider {
  async generateContextShot(params: {
    productName: string
    sceneType: 'problem' | 'lifestyle' | 'demo'
    durationSec: number
    apiKey?: string
  }): Promise<GenerativeVideoClip> {
    const { productName, sceneType, durationSec } = params

    // Never re-generate the actual product if fidelity cannot be guaranteed.
    // Instead, generate authentic lifestyle/context environment b-roll.
    let motionPrompt = ''
    let fallbackImageUrl = '/backgrounds/minimal_lifestyle.png'

    if (sceneType === 'problem') {
      motionPrompt = `Cinematic slow motion POV searching under a desk with messy tangled cords, moody lighting, camera push`
      fallbackImageUrl = '/backgrounds/desk_workspace.png'
    } else if (sceneType === 'lifestyle') {
      motionPrompt = `Clean aesthetic minimalist desk setup, soft natural sunlight streaming through window, camera slow pan right`
      fallbackImageUrl = '/backgrounds/desk_workspace.png'
    } else {
      motionPrompt = `Modern bright workspace, hands working seamlessly at clean desk, camera gentle floating parallax`
      fallbackImageUrl = '/backgrounds/minimal_lifestyle.png'
    }

    return {
      id: `gen-shot-${Date.now()}`,
      purpose: sceneType === 'problem' ? 'problem_context' : 'lifestyle_context',
      fallbackImageUrl,
      motionPrompt,
      durationSec,
      fidelityGuaranteed: true,
    }
  }
}
