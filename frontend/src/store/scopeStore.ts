import { create } from 'zustand';
import { scopeApi } from '@/services/api/scope';

export type ServiceStatus = "not_tested" | "testing" | "clean" | "vulnerable" | "exploitable";

export interface Tag {
  id: string;
  name: string;
  color: string;
  is_predefined: boolean;
}

export interface Asset {
  id: string;
  
  // Service core (what actually gets tested)
  ip: string;            // 10.1.1.100 - REQUIRED: the actual service IP
  port: number;          // 80, 443, 22 - REQUIRED: the actual service port
  protocol: "tcp" | "udp"; // REQUIRED: service protocol
  
  // Access methods (how you reach this service)
  hostnames?: string[];  // ["www.example.com", "api.example.com"] - DNS names pointing to this IP
  vhosts?: string[];     // ["blog.example.com", "news.example.com"] - virtual hosts served by this service
  
  // Testing metadata  
  status: ServiceStatus; // Coverage is measured per service
  tags: Tag[];
  discovered_via: "nmap" | "ssl-cert" | "http-vhosts" | "manual";
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ScopeStats {
  total: number;
  clean: number;
  vulnerable: number;
  exploitable: number;
  testing: number;
  not_tested: number;
  completedCount: number;
  completionPercentage: number;
}

export interface AssetCreate {
  ip: string;
  port: number;
  protocol: "tcp" | "udp";
  hostnames?: string[];
  vhosts?: string[];
  status?: ServiceStatus;
  discovered_via?: "nmap" | "ssl-cert" | "http-vhosts" | "manual";
  notes?: string;
}

export interface AssetUpdate {
  protocol?: "tcp" | "udp";
  hostnames?: string[];
  vhosts?: string[];
  status?: ServiceStatus;
  discovered_via?: "nmap" | "ssl-cert" | "http-vhosts" | "manual";
  notes?: string;
  tags?: Tag[];
}

export interface ImportStats {
  hosts_processed: number;
  services_created: number;
  services_updated: number;
  hostnames_linked: number;
  vhosts_detected: number;
  errors: string[];
}

interface ScopeState {
  assets: Asset[];
  loading: boolean;
  error: string | null;
  predefinedTags: Tag[];
  
  // API Actions
  fetchAssets: (projectId: string) => Promise<void>;
  createAsset: (projectId: string, asset: AssetCreate) => Promise<Asset | null>;
  updateAsset: (projectId: string, assetId: string, updatedAsset: AssetUpdate) => Promise<Asset | null>;
  deleteAsset: (projectId: string, assetId: string) => Promise<boolean>;
  
  // Tag Actions
  addTagToAsset: (projectId: string, assetId: string, tag: Tag) => Promise<boolean>;
  removeTagFromAsset: (projectId: string, assetId: string, tagId: string) => Promise<boolean>;
  createCustomTag: (name: string, color: string) => Tag;
  
  // Import Actions  
  importNmapXml: (projectId: string, xmlContent: string, settings?: any) => Promise<ImportStats | null>;
  
  // Legacy Actions (for backwards compatibility)
  updateAssetStatus: (assetId: string, status: ServiceStatus) => void;
  updateAllAssetsForHost: (host: string, status: ServiceStatus) => void;
  
  // Computed stats
  getAssetsStats: () => ScopeStats;
  getAssetsByType: () => Array<{
    type: string;
    assets: Asset[];
    stats: ScopeStats;
  }>;
}

// Helper function to calculate stats
const calculateStats = (items: Array<{ status: ServiceStatus }>): ScopeStats => {
  const total = items.length;
  const clean = items.filter(item => item.status === 'clean').length;
  const vulnerable = items.filter(item => item.status === 'vulnerable').length;
  const exploitable = items.filter(item => item.status === 'exploitable').length;
  const testing = items.filter(item => item.status === 'testing').length;
  const not_tested = items.filter(item => item.status === 'not_tested').length;
  
  const completedCount = clean + vulnerable + exploitable;
  const completionPercentage = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  
  return {
    total,
    clean,
    vulnerable,
    exploitable,
    testing,
    not_tested,
    completedCount,
    completionPercentage
  };
};


const handleApiError = (error: any) => {
  console.error('API Error:', error);
  return null;
};

// Predefined tags
const predefinedTags: Tag[] = [
  { id: 'tag-1', name: 'critical', color: 'bg-red-600', is_predefined: true },
  { id: 'tag-2', name: 'high', color: 'bg-orange-500', is_predefined: true },
  { id: 'tag-3', name: 'medium', color: 'bg-yellow-500', is_predefined: true },
  { id: 'tag-4', name: 'low', color: 'bg-blue-500', is_predefined: true },
  { id: 'tag-5', name: 'info', color: 'bg-gray-500', is_predefined: true },
];

export const useScopeStore = create<ScopeState>((set, get) => ({
  assets: [],
  loading: false,
  error: null,
  predefinedTags: predefinedTags,
  
  // Fetch all assets for a project
  fetchAssets: async (projectId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await scopeApi.getAssets(projectId);
      set({ assets: response.data, loading: false });
    } catch (error: any) {
      set({ error: error.message, loading: false });
      console.error('Failed to fetch assets:', error);
    }
  },

  // Create a new asset
  createAsset: async (projectId: string, asset: AssetCreate) => {
    set({ loading: true, error: null });
    try {
      const response = await scopeApi.createAsset(projectId, asset);
      const newAsset = response.data;
      
      // Add to local state
      set(state => ({
        assets: [...state.assets, newAsset],
        loading: false
      }));
      
      return newAsset;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return handleApiError(error);
    }
  },

  // Update an existing asset
  updateAsset: async (projectId: string, assetId: string, updatedAsset: AssetUpdate) => {
    set({ loading: true, error: null });
    try {
      const response = await scopeApi.updateAsset(projectId, assetId, updatedAsset);
      const updated = response.data;
      
      // Update local state
      set(state => ({
        assets: state.assets.map(asset => 
          asset.id === assetId ? updated : asset
        ),
        loading: false
      }));
      
      return updated;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return handleApiError(error);
    }
  },

  // Delete an asset
  deleteAsset: async (projectId: string, assetId: string) => {
    set({ loading: true, error: null });
    try {
      await scopeApi.deleteAsset(projectId, assetId);
      
      // Remove from local state
      set(state => ({
        assets: state.assets.filter(asset => asset.id !== assetId),
        loading: false
      }));
      
      return true;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return false;
    }
  },

  // Add tag to asset
  addTagToAsset: async (projectId: string, assetId: string, tag: Tag) => {
    try {
      const response = await scopeApi.addTag(projectId, assetId, { name: tag.name, color: tag.color });
      const newTag = response.data;
      
      // Update local state
      set(state => ({
        assets: state.assets.map(asset => 
          asset.id === assetId 
            ? { ...asset, tags: [...asset.tags, newTag] }
            : asset
        )
      }));
      
      return true;
    } catch (error: any) {
      console.error('Failed to add tag:', error);
      return false;
    }
  },

  // Remove tag from asset
  removeTagFromAsset: async (projectId: string, assetId: string, tagId: string) => {
    try {
      await scopeApi.removeTag(projectId, assetId, tagId);
      
      // Update local state
      set(state => ({
        assets: state.assets.map(asset => 
          asset.id === assetId 
            ? { ...asset, tags: asset.tags.filter(tag => tag.id !== tagId) }
            : asset
        )
      }));
      
      return true;
    } catch (error: any) {
      console.error('Failed to remove tag:', error);
      return false;
    }
  },

  // Create custom tag
  createCustomTag: (name: string, color: string) => {
    return {
      id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name.toLowerCase(),
      color,
      is_predefined: false
    };
  },

  // Import Nmap XML
  importNmapXml: async (projectId: string, xmlContent: string, settings: any = {}) => {
    set({ loading: true, error: null });
    try {
      const response = await scopeApi.importNmap(projectId, {
        xml_content: xmlContent,
        open_ports_only: settings.open_ports_only ?? true,
        default_status: settings.default_status ?? "not_tested"
      });
      const stats = response.data;
      
      // Refresh assets after import
      await get().fetchAssets(projectId);
      
      set({ loading: false });
      return stats;
    } catch (error: any) {
      set({ error: error.message, loading: false });
      return handleApiError(error);
    }
  },

  // Legacy methods for backwards compatibility
  updateAssetStatus: (assetId: string, status: ServiceStatus) => {
    set(state => ({
      assets: state.assets.map(asset =>
        asset.id === assetId ? { ...asset, status } : asset
      )
    }));
  },

  updateAllAssetsForHost: (host: string, status: ServiceStatus) => {
    set(state => ({
      assets: state.assets.map(asset => {
        const matches = asset.ip === host || asset.hostnames?.includes(host);
        return matches ? { ...asset, status } : asset;
      })
    }));
  },
  
  getAssetsStats: () => {
    const { assets } = get();
    return calculateStats(assets);
  },
  
  getAssetsByType: () => {
    const { assets } = get();
    
    // Service-centric model: All assets are services grouped by IP
    const servicesByIp = assets.reduce((acc, asset) => {
      const ipKey = asset.ip;
      if (!acc[ipKey]) {
        acc[ipKey] = [];
      }
      acc[ipKey].push(asset);
      return acc;
    }, {} as Record<string, Asset[]>);
    
    return Object.entries(servicesByIp).map(([ip, ipAssets]) => ({
      type: `Services on ${ip}`,
      assets: ipAssets,
      stats: calculateStats(ipAssets)
    }));
  },
}));