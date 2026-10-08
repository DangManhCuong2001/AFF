import { ProductPresentation } from '@/engines/core/contracts'

export interface ResolvedPresentationStyles {
  containerStyle: React.CSSProperties
  imageStyle: React.CSSProperties
  overlayStyle?: React.CSSProperties
  isCard: boolean
  isMacro: boolean
  isFloating: boolean
}

export class ProductPresentationResolver {
  /**
   * Resolve presentation instruction into dynamic Remotion CSS transforms
   */
  static resolve(
    presentation: ProductPresentation,
    options?: {
      focusActive?: boolean
      focusZoomBonus?: number
    }
  ): ResolvedPresentationStyles {
    const { type, zoom = 1.0, position, crop } = presentation
    const extraZoom = options?.focusActive ? (options?.focusZoomBonus ?? 0.1) : 0
    const effectiveZoom = zoom + extraZoom

    // Base position offsets (-50% to +50% range or pixels)
    const posX = position?.x ?? 0
    const posY = position?.y ?? 0

    let isCard = false
    let isMacro = false
    let isFloating = false

    const containerStyle: React.CSSProperties = {
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
    }

    const imageStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      transform: `scale(${effectiveZoom}) translate(${posX}%, ${posY}%)`,
    }

    switch (type) {
      case 'hero-card': {
        isCard = true
        containerStyle.borderRadius = 32
        containerStyle.border = '1px solid rgba(255, 255, 255, 0.16)'
        containerStyle.background = 'rgba(255, 255, 255, 0.05)'
        containerStyle.boxShadow =
          '0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 8px 24px -4px rgba(0, 0, 0, 0.4)'
        imageStyle.objectFit = 'contain'
        break
      }

      case 'detail-focus': {
        isCard = true
        containerStyle.borderRadius = 28
        containerStyle.border = '1.5px solid rgba(56, 189, 248, 0.3)'
        containerStyle.boxShadow = '0 20px 50px -10px rgba(0, 0, 0, 0.6)'
        imageStyle.objectFit = 'cover'
        imageStyle.transform = `scale(${Math.max(1.25, effectiveZoom)}) translate(${posX}%, ${posY}%)`
        break
      }

      case 'macro-detail': {
        isMacro = true
        isCard = true
        containerStyle.borderRadius = 36
        containerStyle.border = '2px solid rgba(255, 255, 255, 0.22)'
        containerStyle.boxShadow = '0 30px 70px -15px rgba(0, 0, 0, 0.8)'
        imageStyle.objectFit = 'cover'
        imageStyle.transform = `scale(${Math.max(1.5, effectiveZoom * 1.4)}) translate(${posX}%, ${posY}%)`
        break
      }

      case 'floating-product': {
        isFloating = true
        containerStyle.overflow = 'visible'
        imageStyle.objectFit = 'contain'
        imageStyle.filter = 'drop-shadow(0 25px 40px rgba(0, 0, 0, 0.65))'
        break
      }

      case 'smart-crop': {
        if (crop) {
          // If custom crop rectangle provided, apply clipPath or objectPosition
          imageStyle.objectFit = 'cover'
          imageStyle.objectPosition = `${crop.x + crop.width / 2}% ${crop.y + crop.height / 2}%`
        } else {
          imageStyle.objectFit = 'cover'
          imageStyle.objectPosition = 'center center'
        }
        break
      }

      case 'split-view': {
        isCard = true
        containerStyle.borderRadius = 24
        containerStyle.border = '1px solid rgba(255, 255, 255, 0.12)'
        imageStyle.objectFit = 'cover'
        break
      }
    }

    return {
      containerStyle,
      imageStyle,
      isCard,
      isMacro,
      isFloating,
    }
  }
}
