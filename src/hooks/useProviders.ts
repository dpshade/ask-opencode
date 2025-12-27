import { useState, useEffect } from "react";
import { getServerUrl } from "../lib/opencode";

export interface Model {
  id: string;
  providerID: string;
  name: string;
}

export interface Provider {
  id: string;
  name: string;
  models: Record<string, Model>;
}

export interface FavoriteModel {
  providerID: string;
  providerName: string;
  modelID: string;
  modelName: string;
}

export interface ProviderResponse {
  all: Provider[];
  default: Record<string, string>;
}

export function useProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [favorites, setFavorites] = useState<FavoriteModel[]>([]);
  const [defaultModel, setDefaultModel] = useState<{ providerID: string; modelID: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchProviders() {
      const baseUrl = getServerUrl() || "http://localhost:4096";
      try {
        const response = await fetch(`${baseUrl}/provider`);
        if (!response.ok) {
          throw new Error(`Failed to fetch providers: ${response.statusText}`);
        }
        const data = (await response.json()) as ProviderResponse;
        setProviders(data.all);
        
        const favs: FavoriteModel[] = [];
        const defaultMap = data.default || {};
        
        for (const [providerID, modelID] of Object.entries(defaultMap)) {
          const provider = data.all.find(p => p.id === providerID);
          if (provider && provider.models[modelID]) {
            favs.push({
              providerID,
              providerName: provider.name,
              modelID,
              modelName: provider.models[modelID].name,
            });
          }
        }
        setFavorites(favs);
        
        if (favs.length > 0) {
          setDefaultModel({ providerID: favs[0].providerID, modelID: favs[0].modelID });
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    }

    fetchProviders();
  }, []);

  return {
    providers,
    favorites,
    defaultModel,
    isLoading,
    error,
  };
}
