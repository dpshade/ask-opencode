import { showToast, Toast, Clipboard, getPreferenceValues } from "@raycast/api";
import {
  ensureServer,
  ServerNotRunningError,
  OpenCodeNotInstalledError,
} from "./server-manager";

// Simple HTTP client that matches the SDK's API structure
// We use fetch directly instead of the SDK to avoid bundling issues with Raycast

interface Preferences {
  defaultProject?: string;
  handoffMethod: "terminal" | "desktop";
  autoStartServer: boolean;
}

export interface Session {
  id: string;
  projectID: string;
  directory: string;
  title: string;
  version: string;
  time: {
    created: number;
    updated: number;
  };
  share?: {
    url: string;
  };
}

export interface Agent {
  name: string;
  mode: "primary" | "subagent" | "all";
}

export interface MessagePart {
  type: string;
  id?: string;
  text?: string;
  [key: string]: unknown;
}

export interface Message {
  info: {
    id: string;
    sessionID: string;
    role: "user" | "assistant";
  };
  parts: MessagePart[];
}

export interface HealthResponse {
  healthy: boolean;
  version: string;
}

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

export interface ProviderResponse {
  all: Provider[];
  default: {
    providerID: string;
    modelID: string;
  };
}

class OpenCodeClient {
  private baseUrl: string;
  private directory?: string;

  constructor(baseUrl: string, directory?: string) {
    this.baseUrl = baseUrl;
    this.directory = directory;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    queryParams?: Record<string, string | undefined>,
  ): Promise<T> {
    const url = new URL(path, this.baseUrl);

    // Add directory to query params if set
    if (this.directory) {
      url.searchParams.set("directory", this.directory);
    }

    // Add additional query params
    if (queryParams) {
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined) {
          url.searchParams.set(key, value);
        }
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(this.directory ? { "x-opencode-directory": this.directory } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text}`);
    }

    return response.json() as Promise<T>;
  }

  // Global endpoints
  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("GET", "/global/health");
  }

  // Session endpoints
  async listSessions(): Promise<Session[]> {
    return this.request<Session[]>("GET", "/session");
  }

  async createSession(title?: string): Promise<Session> {
    return this.request<Session>("POST", "/session", { title });
  }

  async getSession(sessionId: string): Promise<Session> {
    return this.request<Session>("GET", `/session/${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.request<boolean>("DELETE", `/session/${sessionId}`);
  }

  async getSessionMessages(
    sessionId: string,
    limit?: number,
  ): Promise<Message[]> {
    return this.request<Message[]>(
      "GET",
      `/session/${sessionId}/message`,
      undefined,
      {
        limit: limit?.toString(),
      },
    );
  }

  async sendPrompt(
    sessionId: string,
    text: string,
    options: {
      agent?: string;
      model: { providerID: string; modelID: string };
    },
  ): Promise<Message> {
    return this.request<Message>("POST", `/session/${sessionId}/message`, {
      parts: [{ type: "text", text }],
      agent: options.agent,
      model: options.model,
    });
  }

  async abortSession(sessionId: string): Promise<boolean> {
    return this.request<boolean>("POST", `/session/${sessionId}/abort`);
  }

  // Agent endpoints
  async listAgents(): Promise<Agent[]> {
    return this.request<Agent[]>("GET", "/agent");
  }

  async listProviders(): Promise<ProviderResponse> {
    return this.request<ProviderResponse>("GET", "/provider");
  }

  // Set working directory
  setDirectory(directory: string): void {
    this.directory = directory;
  }
}

// Singleton client instance
let clientInstance: OpenCodeClient | null = null;
let serverUrl: string | null = null;

/**
 * Get or create the OpenCode client
 */
export async function getClient(directory?: string): Promise<OpenCodeClient> {
  const preferences = getPreferenceValues<Preferences>();

  try {
    const server = await ensureServer(preferences.autoStartServer);
    serverUrl = server.url;

    if (!clientInstance || directory) {
      const effectiveDir = directory || preferences.defaultProject;
      clientInstance = new OpenCodeClient(server.url, effectiveDir);
    }

    return clientInstance;
  } catch (error) {
    if (error instanceof ServerNotRunningError) {
      await showToast({
        style: Toast.Style.Failure,
        title: "OpenCode server not running",
        message: "Run 'opencode serve' to start",
        primaryAction: {
          title: "Copy Command",
          onAction: () => Clipboard.copy("opencode serve"),
        },
      });
    } else if (error instanceof OpenCodeNotInstalledError) {
      await showToast({
        style: Toast.Style.Failure,
        title: "OpenCode not installed",
        message: "Install from opencode.ai",
        primaryAction: {
          title: "Copy Install Command",
          onAction: () =>
            Clipboard.copy("curl -fsSL https://opencode.ai/install | bash"),
        },
      });
    }
    throw error;
  }
}

/**
 * Get the current server URL (or null if not connected)
 */
export function getServerUrl(): string | null {
  return serverUrl;
}

/**
 * Reset the client (useful when changing directories)
 */
export function resetClient(): void {
  clientInstance = null;
}

export { OpenCodeClient };
