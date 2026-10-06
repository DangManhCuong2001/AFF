export type HomeVideoFormat =
  | 'auto'
  | 'problem-solution'
  | 'before-after'
  | 'product-test'
  | 'satisfying-demo'
  | 'three-benefits'
  | 'how-to'
  | 'product-showcase'

export interface HomeFormatDefinition {
  id: HomeVideoFormat
  name: string
  description: string
  bestFor: string
  requiresDemoFootage: boolean
  defaultDurationSec: number
  typicalScenes: string[]
}
