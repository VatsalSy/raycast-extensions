import { Application, Clipboard, getApplications, open, showToast, Toast } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { spawnSync } from "node:child_process";
import path from "node:path";

export async function runAppleScript(script: string) {
  if (process.platform !== "darwin") {
    throw new Error("macOS only");
  }

  const locale = process.env.LC_ALL;
  delete process.env.LC_ALL;
  const { stdout, stderr } = spawnSync("osascript", ["-e", script]);
  process.env.LC_ALL = locale;
  if (stderr?.length) throw new Error(stderr.toString());
  return stdout.toString();
}

export type Terminal = Exclude<Arguments.Index["to"], "Clipboard">;
export const isTerminal = (val: string): val is Terminal => val !== "Clipboard" && val !== "Finder";

export async function getApplication(name: Terminal): Promise<Application> {
  const applications = await getApplications();
  const app = applications.find((app) => app.name === name);
  if (!app) throw new Error(`${name} not found`);
  return app;
}

export async function checkApplication(name: Terminal) {
  await getApplication(name);
}

function formatCmuxError(message: string) {
  if (message.includes("Access denied")) {
    return "cmux denied external control. In cmux, open Settings -> Automation and set Socket Mode to Allow all local processes or Password.";
  }

  return message || "cmux command failed";
}

export async function runCmuxCommand(args: string[]) {
  const app = await getApplication("cmux");
  const cliPath = path.join(app.path, "Contents", "Resources", "bin", "cmux");
  const result = spawnSync(cliPath, args, { encoding: "utf8" });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(formatCmuxError(output));
  }

  return result.stdout.trim();
}

function findFirstString(value: unknown, keys: string[]): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findFirstString(item, keys);
      if (match) return match;
    }
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  for (const nested of Object.values(record)) {
    const match = findFirstString(nested, keys);
    if (match) return match;
  }

  return undefined;
}

export async function getCmuxWorkingDirectory() {
  const stdout = await runCmuxCommand(["--json", "sidebar-state"]);
  const parsed = JSON.parse(stdout) as unknown;
  const cwd = findFirstString(parsed, ["cwd", "workingDirectory", "working_directory"]);

  if (!cwd) {
    throw new Error("cmux did not return a working directory for the focused workspace");
  }

  return cwd;
}
export async function clipboardToApplication(name: Terminal) {
  try {
    const directory = (await Clipboard.readText()) || "";
    await checkApplication(name);
    await open(directory, name);
    await showToast(Toast.Style.Success, "Done");
  } catch (err) {
    await showFailureToast(err);
  }
}
export async function applicationToFinder(name: Terminal) {
  const script = `
    if application "${name}" is not running then
      error "${name} is not running"
    end if

    tell application "Finder" to activate
    tell application "${name}" to activate
    tell application "System Events"
      keystroke "open -a Finder ./"
      key code 76
    end tell
  `;
  try {
    const result = await runAppleScript(script);
    await showToast(Toast.Style.Success, "Done", result);
  } catch (err) {
    await showFailureToast(err);
  }
}
export async function finderToApplication(name: Terminal) {
  const script = `
    if application "Finder" is not running then
        return "Finder is not running"
    end if

    tell application "Finder"
      if (count of Finder windows) = 0 then error "No Finder window open"
      try
        set pathList to POSIX path of (folder of the front window as alias)
        return pathList
      on error
        error "Could not access Finder window path"
      end try
    end tell
  `;
  try {
    const directory = await runAppleScript(script);
    await checkApplication(name);
    await open(directory.trim(), name);
    await showToast(Toast.Style.Success, "Done");
  } catch (err) {
    await showFailureToast(err);
  }
}
