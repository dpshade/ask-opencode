import { useState, useEffect, useCallback } from "react";
import { showToast, Toast } from "@raycast/api";
import { getClient, Session, Agent, resetClient } from "../lib/opencode";

interface UseOpenCodeResult {
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
  agents: Agent[];
  currentSession: Session | null;
  sendPrompt: (
    text: string,
    options: {
      agent?: string;
      model: { providerID: string; modelID: string };
    },
  ) => Promise<string>;
  createSession: (title?: string) => Promise<Session>;
  setWorkingDirectory: (dir: string) => void;
  reconnect: () => Promise<void>;
}

export function useOpenCode(initialDirectory?: string): UseOpenCodeResult {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [workingDirectory, setWorkingDirectory] = useState<string | undefined>(
    initialDirectory,
  );

  const connect = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const client = await getClient(workingDirectory);
      const health = await client.health();

      if (health.healthy) {
        setIsConnected(true);

        const agentList = await client.listAgents();
        setAgents(
          agentList.filter((a) => a.mode === "primary" || a.mode === "all"),
        );

        await showToast({
          style: Toast.Style.Success,
          title: "Connected to OpenCode",
          message: `Version ${health.version}`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [workingDirectory]);

  useEffect(() => {
    connect();
  }, [connect]);

  const createSession = useCallback(
    async (title?: string): Promise<Session> => {
      const client = await getClient(workingDirectory);
      const session = await client.createSession(title);
      setCurrentSession(session);
      return session;
    },
    [workingDirectory],
  );

  const sendPrompt = useCallback(
    async (
      text: string,
      options: {
        agent?: string;
        model: { providerID: string; modelID: string };
      },
    ): Promise<string> => {
      const client = await getClient(workingDirectory);

      let session = currentSession;
      if (!session) {
        const titlePreview =
          text.slice(0, 50) + (text.length > 50 ? "..." : "");
        session = await client.createSession(`Raycast: ${titlePreview}`);
        setCurrentSession(session);
      }

      const response = await client.sendPrompt(session.id, text, options);

      const textParts = response.parts
        .filter(
          (p): p is typeof p & { text: string } =>
            p.type === "text" && typeof p.text === "string",
        )
        .map((p) => p.text);

      return textParts.join("\n");
    },
    [workingDirectory, currentSession],
  );

  const handleSetWorkingDirectory = useCallback((dir: string) => {
    setWorkingDirectory(dir);
    resetClient();
    setCurrentSession(null);
  }, []);

  const reconnect = useCallback(async () => {
    resetClient();
    setCurrentSession(null);
    await connect();
  }, [connect]);

  return {
    isConnected,
    isLoading,
    error,
    agents,
    currentSession,
    sendPrompt,
    createSession,
    setWorkingDirectory: handleSetWorkingDirectory,
    reconnect,
  };
}
