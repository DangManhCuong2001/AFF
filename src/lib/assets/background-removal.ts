import { ProcessedProductAsset, ProductAsset } from '@/engines/core/types'

export interface BackgroundRemovalProvider {
  name: string
  removeBackground(asset: ProductAsset): Promise<ProcessedProductAsset>
}

/**
 * Fallback provider when dedicated external AI background removal is not configured.
 * Preserves high fidelity original product asset with clean styling boundaries.
 */
export class FallbackBackgroundRemovalProvider implements BackgroundRemovalProvider {
  readonly name = 'Fallback (Direct High-Fidelity Asset)'

  async removeBackground(asset: ProductAsset): Promise<ProcessedProductAsset> {
    return {
      originalId: asset.id,
      url: asset.url,
    }
  }
}

export const defaultBackgroundRemovalProvider = new FallbackBackgroundRemovalProvider()
