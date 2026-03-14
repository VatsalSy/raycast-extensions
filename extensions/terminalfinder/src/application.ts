import type { Application } from "@raycast/api";

type TerminalApplication = Pick<Application, "name" | "localizedName" | "bundleId">;

const KNOWN_BUNDLE_IDS = {
  cmux: "com.cmuxterm.app",
} as const;

function normalize(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : undefined;
}

export function findApplication<T extends TerminalApplication>(applications: T[], name: string): T | undefined {
  const knownBundleId = KNOWN_BUNDLE_IDS[name as keyof typeof KNOWN_BUNDLE_IDS];
  const normalizedName = normalize(name);

  return applications.find((app) => {
    if (app.name === name || app.localizedName === name) {
      return true;
    }

    if (knownBundleId && app.bundleId === knownBundleId) {
      return true;
    }

    if (!normalizedName) {
      return false;
    }

    return [app.name, app.localizedName, app.bundleId].some((value) => normalize(value) === normalizedName);
  });
}
