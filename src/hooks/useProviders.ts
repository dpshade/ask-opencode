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
        const defaultInfo = data.default;

        if (
          defaultInfo &&
          "providerID" in defaultInfo &&
          "modelID" in defaultInfo
        ) {
          const provider = data.all.find(
            (p) => p.id === defaultInfo.providerID,
          );
          if (provider && provider.models[defaultInfo.modelID]) {
            favs.push({
              providerID: defaultInfo.providerID,
              providerName: provider.name,
              modelID: defaultInfo.modelID,
              modelName: provider.models[defaultInfo.modelID].name,
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
