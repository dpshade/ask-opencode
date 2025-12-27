import { useState, useEffect } from "react";
import { getClient, Provider, ProviderResponse } from "../lib/opencode";

export type { Provider } from "../lib/opencode";

export interface FavoriteModel {
  providerID: string;
  providerName: string;
  modelID: string;
  modelName: string;
}

export function useProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [favorites, setFavorites] = useState<FavoriteModel[]>([]);
  const [defaultModel, setDefaultModel] = useState<{
    providerID: string;
    modelID: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchProviders() {
      try {
        const client = await getClient();
        const data: ProviderResponse = await client.listProviders();
        setProviders(data.all);

        const favs: FavoriteModel[] = [];
        const defaultMap = data.default || {};
        const connectedSet = new Set(data.connected || []);

        for (const [providerID, modelID] of Object.entries(defaultMap)) {
          if (!connectedSet.has(providerID)) continue;
          const provider = data.all.find((p) => p.id === providerID);
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
          setDefaultModel({
            providerID: favs[0].providerID,
            modelID: favs[0].modelID,
          });
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
