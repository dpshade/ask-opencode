import { Application, open, showHUD, Clipboard, getPreferenceValues } from "@raycast/api"
import { runAppleScript } from "@raycast/utils"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

type HandoffMethod = "terminal" | "desktop"

interface Preferences {
  terminalApp?: Application
}

export async function handoffToOpenCode(sessionId: string, method: HandoffMethod, workingDir?: string): Promise<void> {
  if (method === "desktop") {
    await handoffToDesktop(sessionId)
  } else {
    await handoffToTerminal(sessionId, workingDir)
  }
}

async function handoffToTerminal(sessionId: string, workingDir?: string): Promise<void> {
  const preferences = getPreferenceValues<Preferences>()
  const cdCommand = workingDir ? `cd "${workingDir}" && ` : ""
  const command = `${cdCommand}opencode --session=${sessionId}`

  const app = preferences.terminalApp
  if (!app) {
    await openInTerminalApp(command)
    return
  }

  const appName = app.name.toLowerCase()

  try {
    if (appName === "iterm" || appName.includes("iterm")) {
      await openInITerm(command)
    } else if (appName === "terminal") {
      await openInTerminalApp(command)
    } else {
      await openInGenericTerminal(app, command)
    }
  } catch {
    await Clipboard.copy(command)
    await showHUD("Command copied - paste in terminal")
  }
}

async function openInITerm(command: string): Promise<void> {
  const script = `
    on is_running()
      application "iTerm" is running
    end is_running
    
    on has_windows()
      if not is_running() then return false
      if windows of application "iTerm" is {} then return false
      return true
    end has_windows
    
    on is_processing()
      tell application "iTerm" to tell the first window to tell current session to return is processing
    end is_processing
    
    on new_window()
      tell application "iTerm" to create window with default profile
    end new_window
    
    on new_tab()
      tell application "iTerm" to tell the first window to create tab with default profile
    end new_tab
    
    on send_text(custom_text)
      tell application "iTerm" to tell the first window to tell current session to write text custom_text
    end send_text
    
    on run argv
      set cmd to item 1 of argv
      
      if has_windows() then
        if is_processing() then
          new_tab()
        end if
      else
        if is_running() then
          new_window()
        else
          tell application "iTerm" to activate
        end if
      end if
      
      repeat until has_windows()
        delay 0.01
      end repeat
      
      send_text(cmd)
      tell application "iTerm" to activate
    end run
  `
  await runAppleScript(script, [command])
  await showHUD("Opened in iTerm")
}

async function openInTerminalApp(command: string): Promise<void> {
  const escapedCommand = command.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  const script = `
    tell application "Terminal"
      if not (exists window 1) then reopen
      activate
      
      if busy of window 1 then
        tell application "System Events" to keystroke "t" using command down
        delay 0.1
      end if
      
      do script "${escapedCommand}" in front window
    end tell
  `
  await runAppleScript(script)
  await showHUD("Opened in Terminal")
}

async function openInGenericTerminal(app: Application, command: string): Promise<void> {
  const appName = app.name
  const processName = appName.replace(".app", "")

  await execAsync(`open -a "${app.path}"`)

  await runAppleScript(`
    tell application "${appName}"
      activate
    end tell
    
    delay 0.5
    
    tell application "System Events"
      tell process "${processName}"
        set frontmost to true
        delay 0.2
        keystroke "t" using command down
        delay 0.3
      end tell
    end tell
  `)

  await Clipboard.copy(command)

  await runAppleScript(`
    tell application "System Events"
      tell process "${processName}"
        set frontmost to true
        delay 0.1
        keystroke "v" using command down
        delay 0.1
        keystroke return
      end tell
    end tell
  `)

  await showHUD(`Opened in ${appName}`)
}

async function handoffToDesktop(sessionId: string): Promise<void> {
  try {
    await open(`opencode://session/${sessionId}`)
    await showHUD("Opened in OpenCode Desktop")
  } catch {
    await handoffToTerminal(sessionId)
  }
}

export async function copySessionCommand(sessionId: string, workingDir?: string): Promise<void> {
  const cdCommand = workingDir ? `cd "${workingDir}" && ` : ""
  const command = `${cdCommand}opencode --session=${sessionId}`
  await Clipboard.copy(command)
  await showHUD("Command copied to clipboard")
}
