export type MusicMood =
  | 'quirky_problem'
  | 'satisfying_clean'
  | 'upbeat_gadget'
  | 'warm_conversational'

export interface SoundDesignPlan {
  bgmTrack: {
    name: string
    url: string
    mood: MusicMood
    baseVolume: number // e.g. 0.18
    duckedVolume: number // e.g. 0.08
  }
  sfxCues: Array<{
    id: string
    name: string
    url: string
    timestampSec: number
    volume: number
  }>
}

export class VipeeSoundDirector {
  static planSoundDesign(params: {
    concept: string
    category: string
    visualBeats: Array<{
      startTimeSec: number
      durationSec: number
      sfxCue: string
      sfxDelaySec: number
    }>
  }): SoundDesignPlan {
    const { concept, category, visualBeats } = params
    const text = `${concept} ${category}`.toLowerCase()

    let mood: MusicMood = 'upbeat_gadget'
    if (text.includes('khó chịu') || text.includes('bực') || text.includes('frustration')) {
      mood = 'quirky_problem'
    } else if (text.includes('sạch') || text.includes('gọn') || text.includes('satisfying')) {
      mood = 'satisfying_clean'
    } else if (text.includes('chuyện') || text.includes('tâm sự') || text.includes('review')) {
      mood = 'warm_conversational'
    }

    const sfxCues: SoundDesignPlan['sfxCues'] = []

    visualBeats.forEach((beat, idx) => {
      if (beat.sfxCue && beat.sfxCue !== 'none') {
        const time = Number((beat.startTimeSec + (beat.sfxDelaySec || 0)).toFixed(2))
        const sfxUrl =
          beat.sfxCue === 'whoosh'
            ? '/sfx/whoosh.mp3'
            : beat.sfxCue === 'pop'
            ? '/sfx/pop.mp3'
            : '/sfx/snap.mp3'

        sfxCues.push({
          id: `sfx-${idx + 1}`,
          name: beat.sfxCue,
          url: sfxUrl,
          timestampSec: time,
          volume: 0.7,
        })
      }
    })

    return {
      bgmTrack: {
        name: 'Vipee Royalty-Cleared Ambient Lofi Beat',
        url: '/music/lofi-beat.aac',
        mood,
        baseVolume: 0.18,
        duckedVolume: 0.08,
      },
      sfxCues,
    }
  }
}
