import {
  List,
  ActionPanel,
  Action,
  Icon,
  showToast,
  Toast,
  getPreferenceValues,
  confirmAlert,
  Keyboard,
  Detail,
} from "@raycast/api";
import { useState, useEffect } from "react";
import { getClient, Session, Message } from "./lib/opencode";
import { handoffToOpenCode, copySessionCommand } from "./lib/handoff";
import { homedir } from "os";

interface Preferences {
  handoffMethod: "terminal" | "desktop";
}

export default function Command() {
  const preferences = getPreferenceValues<Preferences>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionMessages, setSessionMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  async function loadSessions() {
    setIsLoading(true);
    try {
      const client = await getClient();
      const sessionList = await client.listSessions();
      setSessions(sessionList.sort((a, b) => b.time.updated - a.time.updated));
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to load sessions",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadSessions();
  }, []);

  async function handleDelete(session: Session) {
    const confirmed = await confirmAlert({
      title: "Delete Session?",
      message: `This will permanently delete "${session.title}"`,
      primaryAction: {
        title: "Delete",
        style: confirmAlert.ActionStyle.Destructive,
      },
    });

    if (!confirmed) return;

    try {
      const client = await getClient();
      await client.deleteSession(session.id);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      await showToast({
        style: Toast.Style.Success,
        title: "Session deleted",
      });
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to delete session",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async function handleHandoff(session: Session) {
    await handoffToOpenCode(
      session.id,
      preferences.handoffMethod,
      session.directory,
    );
  }

  async function handleCopyCommand(session: Session) {
    await copySessionCommand(session.id, session.directory);
  }

  async function handleSelectSession(session: Session) {
    setLoadingMessages(true);
    setSelectedSession(session);
    try {
      const client = await getClient();
      const messages = await client.getSessionMessages(session.id);
      setSessionMessages(messages);
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to load messages",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoadingMessages(false);
    }
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  function getLastQA(): { question: string; answer: string } | null {
    const userMessages = sessionMessages.filter((m) => m.info.role === "user");
    const assistantMessages = sessionMessages.filter(
      (m) => m.info.role === "assistant",
    );

    if (userMessages.length === 0 || assistantMessages.length === 0) {
      return null;
    }

    const lastUserMessage = userMessages[userMessages.length - 1];
    const lastAssistantMessage =
      assistantMessages[assistantMessages.length - 1];

    const question = lastUserMessage.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n");

    const answer = lastAssistantMessage.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("\n");

    return { question, answer };
  }

  if (selectedSession) {
    const lastQA = getLastQA();

    return (
      <Detail
        isLoading={loadingMessages}
        markdown={
          lastQA
            ? `# ${lastQA.question}\n\n${lastQA.answer}`
            : "# " + selectedSession.title
        }
        navigationTitle={selectedSession.title || "Session"}
        metadata={
          <Detail.Metadata>
            <Detail.Metadata.Label
              title="Directory"
              text={selectedSession.directory?.replace(homedir(), "~") || "N/A"}
            />
            <Detail.Metadata.Label
              title="Updated"
              text={formatDate(selectedSession.time.updated)}
            />
          </Detail.Metadata>
        }
        actions={
          <ActionPanel>
            <ActionPanel.Section title="Open">
              <Action
                title="Continue in Opencode"
                icon={Icon.Terminal}
                shortcut={Keyboard.Shortcut.Common.Open}
                onAction={() => handleHandoff(selectedSession)}
              />
              <Action
                title="Copy Session Command"
                icon={Icon.Clipboard}
                shortcut={Keyboard.Shortcut.Common.Copy}
                onAction={() => handleCopyCommand(selectedSession)}
              />
            </ActionPanel.Section>
            <ActionPanel.Section title="Navigation">
              <Action
                title="Back to Sessions"
                icon={Icon.ArrowLeft}
                shortcut={{ modifiers: ["cmd"], key: "[" }}
                onAction={() => setSelectedSession(null)}
              />
            </ActionPanel.Section>
          </ActionPanel>
        }
      />
    );
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search sessions...">
      {sessions.length === 0 && !isLoading ? (
        <List.EmptyView
          title="No sessions yet"
          description="Start a conversation with Ask OpenCode"
          icon={Icon.Message}
        />
      ) : (
        sessions.map((session) => (
          <List.Item
            key={session.id}
            title={session.title || "Untitled Session"}
            subtitle={session.directory?.replace(homedir(), "~")}
            icon={Icon.Message}
            accessories={[
              {
                text: formatDate(session.time.updated),
                tooltip: "Last updated",
              },
              ...(session.share
                ? [{ icon: Icon.Link, tooltip: "Shared" }]
                : []),
            ]}
            actions={
              <ActionPanel>
                <ActionPanel.Section title="Open">
                  <Action
                    title="View Session"
                    icon={Icon.Eye}
                    shortcut={Keyboard.Shortcut.Common.Open}
                    onAction={() => handleSelectSession(session)}
                  />
                </ActionPanel.Section>
                <ActionPanel.Section title="Manage">
                  <Action
                    title="Refresh"
                    icon={Icon.ArrowClockwise}
                    shortcut={Keyboard.Shortcut.Common.Refresh}
                    onAction={loadSessions}
                  />
                  <Action
                    title="Delete Session"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    shortcut={Keyboard.Shortcut.Common.Remove}
                    onAction={() => handleDelete(session)}
                  />
                </ActionPanel.Section>
              </ActionPanel>
            }
          />
        ))
      )}
    </List>
  );
}
