import {
  List,
  ActionPanel,
  Action,
  Detail,
  Icon,
  showToast,
  Toast,
  getPreferenceValues,
  LaunchProps,
  Keyboard,
  showHUD,
  popToRoot,
  Clipboard,
} from "@raycast/api";
import { useState, useEffect } from "react";
import React from "react";
import { useOpenCode } from "./hooks/useOpenCode";
import { useProviders } from "./hooks/useProviders";
import {
  usePathAutocomplete,
  extractPathFromQuery,
} from "./hooks/usePathAutocomplete";
import { handoffToOpenCode, copySessionCommand } from "./lib/handoff";
import { getClient, Session } from "./lib/opencode";
import { homedir } from "os";

interface Preferences {
  defaultProject?: string;
  handoffMethod: "terminal" | "desktop";
}

interface Arguments {
  question?: string;
}

export default function Command(props: LaunchProps<{ arguments: Arguments }>) {
  const preferences = getPreferenceValues<Preferences>();
  const initialQuestion = props.arguments?.question || "";

  const [searchText, setSearchText] = useState(initialQuestion);
  const [response, setResponse] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<{
    providerID: string;
    modelID: string;
  } | null>(null);
  const [activeDirectory, setActiveDirectory] = useState<string | undefined>(
    preferences.defaultProject,
  );

  const {
    providers,
    favorites,
    defaultModel,
    isLoading: modelsLoading,
  } = useProviders();
  const activeModel = selectedModel || defaultModel;

  const {
    isConnected,
    isLoading,
    agents,
    currentSession,
    sendPrompt,
    setWorkingDirectory,
  } = useOpenCode(activeDirectory);

  const slashCommands = [
    { name: "compact", description: "Clear context, keep conversation" },
    { name: "clear", description: "Start fresh conversation" },
    { name: "share", description: "Share this session" },
  ];
  const [sessions, setSessions] = useState<Session[]>([]);
  const { suggestions: pathSuggestions, isActive: showingPathSuggestions } =
    usePathAutocomplete(searchText);

  useEffect(() => {
    async function loadSessions() {
      try {
        const client = await getClient();
        const sessionList = await client.listSessions();
        setSessions(
          sessionList.sort((a, b) => b.time.updated - a.time.updated),
        );
      } catch {}
    }
    loadSessions();
  }, []);

  const recentProjects = React.useMemo(() => {
    const uniqueDirs = new Map<string, { path: string; lastUsed: number }>();
    sessions.forEach((session) => {
      if (session.directory) {
        if (!uniqueDirs.has(session.directory)) {
          uniqueDirs.set(session.directory, {
            path: session.directory,
            lastUsed: session.time.updated,
          });
        }
      }
    });
    return Array.from(uniqueDirs.values())
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, 5);
  }, [sessions]);

  const showingAgentPicker =
    searchText.startsWith("@") &&
    !searchText.startsWith("@/") &&
    !searchText.startsWith("@~/") &&
    !searchText.startsWith("@./") &&
    !searchText.includes(" ");

  const agentFilter = showingAgentPicker
    ? searchText.slice(1).toLowerCase()
    : "";
  const filteredAgents = showingAgentPicker
    ? agents.filter(
        (a) =>
          a.name.toLowerCase().includes(agentFilter) ||
          a.name.toLowerCase().startsWith(agentFilter),
      )
    : [];

  const showingSlashCommands =
    searchText.startsWith("/") && !searchText.includes(" ");
  const slashFilter = showingSlashCommands
    ? searchText.slice(1).toLowerCase()
    : "";
  const filteredSlashCommands = showingSlashCommands
    ? slashCommands.filter(
        (c) =>
          c.name.toLowerCase().includes(slashFilter) ||
          c.name.toLowerCase().startsWith(slashFilter),
      )
    : [];

  async function handleSubmit() {
    const { cleanQuery, directory } = extractPathFromQuery(searchText);
    if (!cleanQuery.trim()) return;

    if (directory && directory !== activeDirectory) {
      setActiveDirectory(directory);
      setWorkingDirectory(directory);
    }

    if (!activeModel) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Model not selected",
        message:
          "Please wait for models to load or check if OpenCode server is running",
      });
      return;
    }

    setIsProcessing(true);

    const toast = await showToast({
      style: Toast.Style.Animated,
      title: `Asking ${activeModel.modelID}...`,
      message: "You can close Raycast - response will be ready when you return",
    });

    try {
      const result = await sendPrompt(cleanQuery, {
        agent: selectedAgent || undefined,
        model: activeModel!,
      });
      setResponse(result);
      toast.style = Toast.Style.Success;
      toast.title = "Response ready";
      toast.message = undefined;
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to get response";
      toast.message = error instanceof Error ? error.message : "Unknown error";
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleSlashCommand(command: string) {
    if (command === "clear") {
      setResponse(null);
      setSearchText("");
      setSelectedAgent(null);
      await showToast({ title: "Conversation cleared" });
    } else if (command === "compact") {
      setResponse(null);
      setSearchText("");
      await showToast({ title: "Context compacted" });
    } else if (command === "share") {
      if (currentSession?.share?.url) {
        await Clipboard.copy(currentSession.share.url);
        await showToast({ title: "Share URL copied to clipboard" });
      } else {
        await showToast({
          title: "No share URL available",
          style: Toast.Style.Failure,
        });
      }
    }
  }

  function handleSelectAgent(agentName: string) {
    setSelectedAgent(agentName);
    setSearchText("");
    showToast({
      style: Toast.Style.Success,
      title: `Using ${agentName}`,
    });
  }

  function handleSelectPath(path: string) {
    const expandedPath = path.replace(/^~/, homedir());
    const currentQuery = searchText.replace(/@[\w/~.-]*$/, "");
    setSearchText(`${currentQuery}@${path} `);
    setActiveDirectory(expandedPath);
    setWorkingDirectory(expandedPath);
  }

  async function handleHandoff() {
    if (!currentSession) return;
    await handoffToOpenCode(
      currentSession.id,
      preferences.handoffMethod,
      activeDirectory,
    );
  }

  async function handleCopyCommand() {
    if (!currentSession) return;
    await copySessionCommand(currentSession.id, activeDirectory);
  }

  function handleNewQuestion() {
    setResponse(null);
    setSearchText("");
    setSelectedAgent(null);
  }

  if (response) {
    return (
      <Detail
        markdown={response}
        navigationTitle={currentSession?.title || "OpenCode Response"}
        metadata={
          <Detail.Metadata>
            {activeDirectory && (
              <Detail.Metadata.Label
                title="Directory"
                text={activeDirectory.replace(homedir(), "~")}
              />
            )}
            {selectedAgent && (
              <Detail.Metadata.Label title="Agent" text={selectedAgent} />
            )}
            {activeModel && (
              <Detail.Metadata.Label title="Model" text={activeModel.modelID} />
            )}
            {currentSession && (
              <Detail.Metadata.Label
                title="Session"
                text={currentSession.id.slice(0, 8)}
              />
            )}
          </Detail.Metadata>
        }
        actions={
          <ActionPanel>
            <ActionPanel.Section title="Actions">
              <Action
                title="Continue in Opencode"
                icon={Icon.Terminal}
                shortcut={Keyboard.Shortcut.Common.Open}
                onAction={handleHandoff}
              />
              <Action.CopyToClipboard
                title="Copy Response"
                content={response}
                shortcut={Keyboard.Shortcut.Common.Copy}
              />
              <Action
                title="Copy Session Command"
                icon={Icon.Clipboard}
                shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                onAction={handleCopyCommand}
              />
            </ActionPanel.Section>
            <ActionPanel.Section title="Navigation">
              <Action
                title="New Question"
                icon={Icon.Plus}
                shortcut={Keyboard.Shortcut.Common.New}
                onAction={handleNewQuestion}
              />
            </ActionPanel.Section>
          </ActionPanel>
        }
      />
    );
  }

  return (
    <List
      isLoading={isLoading || isProcessing || modelsLoading}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder={
        selectedAgent
          ? `Ask ${selectedAgent}... (use @path for context)`
          : "Ask anything... (@ for agents, / for commands, @path for context)"
      }
      searchBarAccessory={
        <List.Dropdown
          tooltip="Select Model"
          value={
            activeModel
              ? `${activeModel.providerID}/${activeModel.modelID}`
              : ""
          }
          onChange={(value) => {
            const [providerID, ...modelParts] = value.split("/");
            const modelID = modelParts.join("/");
            setSelectedModel({ providerID, modelID });
          }}
        >
          {favorites.length > 0 && (
            <List.Dropdown.Section title="Favorites">
              {favorites.map((fav) => (
                <List.Dropdown.Item
                  key={`fav-${fav.providerID}-${fav.modelID}`}
                  title={`${fav.modelName} (${fav.providerID})`}
                  value={`${fav.providerID}/${fav.modelID}`}
                  icon={Icon.Star}
                />
              ))}
            </List.Dropdown.Section>
          )}
          {providers.map((provider) => (
            <List.Dropdown.Section key={provider.id} title={provider.name}>
              {Object.values(provider.models).map((model) => (
                <List.Dropdown.Item
                  key={model.id}
                  title={model.name}
                  value={`${provider.id}/${model.id}`}
                />
              ))}
            </List.Dropdown.Section>
          ))}
        </List.Dropdown>
      }
      filtering={false}
      throttle
    >
      {!isConnected && !isLoading ? (
        <List.EmptyView
          title="Not connected to OpenCode"
          description="Make sure OpenCode server is running"
          icon={Icon.ExclamationMark}
        />
      ) : showingAgentPicker ? (
        <List.Section title="Select Agent" subtitle="Type to filter">
          {filteredAgents.map((agent) => (
            <List.Item
              key={agent.name}
              title={agent.name}
              subtitle={`Mode: ${agent.mode}`}
              icon={Icon.Person}
              actions={
                <ActionPanel>
                  <Action
                    title="Select Agent"
                    onAction={() => handleSelectAgent(agent.name)}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ) : showingSlashCommands ? (
        <List.Section title="Commands" subtitle="Type to filter">
          {filteredSlashCommands.map((command) => (
            <List.Item
              key={command.name}
              title={command.name}
              subtitle={command.description}
              icon={Icon.Terminal}
              actions={
                <ActionPanel>
                  <Action
                    title="Execute Command"
                    onAction={() => handleSlashCommand(command.name)}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ) : showingPathSuggestions ? (
        <List.Section title="Select Directory" subtitle="Type to filter">
          {pathSuggestions.map((path) => (
            <List.Item
              key={path}
              title={path}
              icon={Icon.Folder}
              actions={
                <ActionPanel>
                  <Action
                    title="Select Directory"
                    onAction={() => handleSelectPath(path)}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      ) : (
        <>
          {searchText.trim() && (
            <List.Section title="Ask OpenCode">
              <List.Item
                title={searchText}
                subtitle={
                  activeDirectory
                    ? `in ${activeDirectory.replace(homedir(), "~")}`
                    : undefined
                }
                icon={selectedAgent ? Icon.Person : Icon.Star}
                accessories={
                  selectedAgent
                    ? [{ text: selectedAgent, icon: Icon.Person }]
                    : undefined
                }
                actions={
                  <ActionPanel>
                    <Action
                      title="Submit"
                      icon={Icon.ArrowRight}
                      onAction={handleSubmit}
                    />
                    <Action
                      title="Submit and Close"
                      icon={Icon.Clock}
                      shortcut={{ modifiers: ["cmd", "shift"], key: "return" }}
                      onAction={async () => {
                        handleSubmit();
                        await showHUD(
                          "Processing... Open Raycast again to see response",
                        );
                        await popToRoot();
                      }}
                    />
                    {selectedAgent && (
                      <Action
                        title="Clear Agent"
                        icon={Icon.XMarkCircle}
                        onAction={() => setSelectedAgent(null)}
                      />
                    )}
                  </ActionPanel>
                }
              />
            </List.Section>
          )}

          {recentProjects.length > 0 && (
            <List.Section
              title={
                activeDirectory
                  ? `Recent Projects - ${activeDirectory.split("/").pop()}`
                  : "Recent Projects"
              }
              subtitle={
                activeDirectory ? "Active project" : "Use @path to switch"
              }
            >
              {recentProjects.map((project) => {
                const projectName =
                  project.path.split("/").pop() || project.path;
                return (
                  <List.Item
                    key={project.path}
                    title={projectName}
                    subtitle={project.path.replace(homedir(), "~")}
                    icon={Icon.Folder}
                    accessories={[
                      {
                        text: new Date(project.lastUsed).toLocaleDateString(),
                        tooltip: "Last used",
                      },
                    ]}
                    actions={
                      <ActionPanel>
                        <Action
                          title="Use This Project"
                          onAction={() => {
                            setActiveDirectory(project.path);
                            setWorkingDirectory(project.path);
                            showToast({
                              style: Toast.Style.Success,
                              title: `Switched to ${projectName}`,
                            });
                          }}
                        />
                      </ActionPanel>
                    }
                  />
                );
              })}
            </List.Section>
          )}
        </>
      )}
    </List>
  );
}
