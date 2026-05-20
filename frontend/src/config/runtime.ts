import Constants from "expo-constants";

function normalizeUrl(value: string | undefined, fallback: string): string {
  const resolved = (value ?? "").trim();
  if (!resolved) {
    return fallback;
  }
  return resolved.replace(/\/$/, "");
}

const expoVersion = Constants.expoConfig?.version?.trim() || "dev";

const releaseChannel = (process.env.EXPO_PUBLIC_RELEASE_CHANNEL ?? "local").trim();
const configuredVersionLabel = (process.env.EXPO_PUBLIC_APP_VERSION_LABEL ?? "").trim();

export const runtimeConfig = {
  defaultApiUrl: normalizeUrl(
    process.env.EXPO_PUBLIC_DEFAULT_API_URL,
    "http://localhost:3000",
  ),
  appVersionLabel:
    configuredVersionLabel || `v${expoVersion}-${releaseChannel || "local"}`,
  commitSha: (process.env.EXPO_PUBLIC_COMMIT_SHA ?? "local").trim() || "local",
};
