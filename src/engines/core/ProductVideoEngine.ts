import {
  ProductCategory,
  ProductInput,
  ProductAnalysis,
  VideoStrategy,
  VideoStoryboard,
  GeneratedAssets,
  RenderedVideo,
  VideoProject,
} from './types'

export interface ProductVideoEngine {
  id: string
  name: string
  category: ProductCategory

  analyzeProduct(
    product: ProductInput
  ): Promise<ProductAnalysis>

  generateStrategy(
    product: ProductInput,
    analysis: ProductAnalysis
  ): Promise<VideoStrategy>

  generateStoryboard(
    product: ProductInput,
    strategy: VideoStrategy
  ): Promise<VideoStoryboard>

  generateAssets(
    project: VideoProject
  ): Promise<GeneratedAssets>

  composeVideo(
    project: VideoProject
  ): Promise<RenderedVideo>
}
