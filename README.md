# OpenCode for Raycast

AI coding assistant with project context - quick questions, session handoff to CLI/Desktop.

## Features

### Ask OpenCode

Quick coding questions directly from Raycast with AI-powered responses.

- **Agent Selection**: Type `@` to select from available agents (build, plan, etc.)
- **Model Picker**: Choose your preferred AI model from configured providers
- **@path Context**: Use `@~/path/to/project` for project-specific context
- **Path Autocomplete**: Smart directory suggestions when typing paths

### Session Management

- **Session Handoff**: Continue conversations in OpenCode CLI or Desktop app
- **Recent Sessions**: Browse and resume past conversations
- **Project Picker**: Quick access to recently used projects

### Terminal Integration

Seamlessly hand off sessions to your preferred terminal:

- Ghostty
- iTerm
- Warp
- Alacritty
- Kitty
- Terminal.app
- Hyper

## Requirements

- macOS
- [OpenCode CLI](https://opencode.ai) installed

## Installation

### From Raycast Store

Search for "OpenCode" in Raycast Store and install.

### Manual Installation

1. Install OpenCode CLI:

   ```bash
   curl -fsSL https://opencode.ai/install | bash
   ```

2. Clone this repository and install:
   ```bash
   git clone https://github.com/dpshade/ask-opencode.git
   cd ask-opencode
   npm install
   npm run dev
   ```

## Usage

### Ask OpenCode Command

1. Open Raycast and search for "Ask OpenCode"
2. Type your question
3. Optionally add `@~/path/to/project` for project context
4. Press Enter to get a response
5. Press `Cmd+O` to continue in OpenCode CLI or Desktop

### Keyboard Shortcuts

| Action               | Shortcut           |
| -------------------- | ------------------ |
| Submit question      | `Enter`            |
| Submit and close     | `Cmd+Shift+Return` |
| Continue in OpenCode | `Cmd+O`            |
| Copy response        | `Cmd+C`            |
| Copy session command | `Cmd+Shift+C`      |
| New question         | `Cmd+N`            |

### Agent Selection

Type `@` followed by agent name to filter:

- `@build` - Default agent for development work
- `@plan` - Read-only agent for analysis

### Directory Context

Use `@path` syntax to specify project context:

- `@~/Developer/myproject` - Use specific directory
- Type `@~/Dev` and see autocomplete suggestions

## Configuration

Open Raycast Preferences > Extensions > OpenCode:

| Preference           | Description                                        |
| -------------------- | -------------------------------------------------- |
| Default Project      | Set a default working directory                    |
| Handoff Method       | Choose between Terminal or Desktop app             |
| Terminal Application | Select your preferred terminal                     |
| Auto-start Server    | Automatically start OpenCode server if not running |

## Troubleshooting

### Server Not Running

The extension auto-starts the OpenCode server. If it fails:

```bash
opencode serve
```

### OpenCode Not Found

Ensure OpenCode is installed and in your PATH:

```bash
which opencode
```

If not found, reinstall:

```bash
curl -fsSL https://opencode.ai/install | bash
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Make your changes
4. Run `npm run lint` to check for issues
5. Submit a pull request

## Links

- [OpenCode Website](https://opencode.ai)
- [OpenCode Documentation](https://opencode.ai/docs)
- [GitHub Repository](https://github.com/dpshade/ask-opencode)
- [Discord Community](https://opencode.ai/discord)

## License

MIT - see [LICENSE](LICENSE)
