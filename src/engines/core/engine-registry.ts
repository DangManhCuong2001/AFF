import { ProductVideoEngine } from './ProductVideoEngine'
import { ProductCategory } from './types'

export class EngineRegistry {
  private engines: Map<ProductCategory, ProductVideoEngine> = new Map()

  register(engine: ProductVideoEngine): void {
    this.engines.set(engine.category, engine)
  }

  getEngine(category: ProductCategory): ProductVideoEngine | undefined {
    return this.engines.get(category)
  }

  getAllEngines(): ProductVideoEngine[] {
    return Array.from(this.engines.values())
  }

  hasEngine(category: ProductCategory): boolean {
    return this.engines.has(category)
  }
}

// Global registry singleton
export const engineRegistry = new EngineRegistry()
