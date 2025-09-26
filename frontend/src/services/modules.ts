import { apiClient } from './api/client'

export interface Module {
  name: string
  version: string
  enabled: boolean
  path: string
}

export interface ModulesResponse {
  modules: Module[]
}

class ModuleService {
  private modules: Map<string, Module> = new Map()
  private initialized = false

  async initialize() {
    if (this.initialized) return

    try {
      const response = await apiClient.get<ModulesResponse>('/api/v1/modules')
      response.data.modules.forEach(module => {
        this.modules.set(module.name, module)
      })
      this.initialized = true
    } catch (error) {
      console.error('Failed to load modules:', error)
    }
  }

  isEnabled(moduleName: string): boolean {
    const module = this.modules.get(moduleName)
    return module?.enabled ?? false
  }

  getModule(moduleName: string): Module | undefined {
    return this.modules.get(moduleName)
  }

  listModules(): Module[] {
    return Array.from(this.modules.values())
  }

  // Check if external service is available
  async checkExternalService(url: string): Promise<boolean> {
    try {
      const response = await fetch(`${url}/health`)
      return response.ok
    } catch {
      return false
    }
  }
}

export const moduleService = new ModuleService()