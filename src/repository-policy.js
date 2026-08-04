export const repositoryLimits = Object.freeze({
  maximumFiles: 5000,
  maximumFileSizeBytes: 256 * 1024,
});

const ignoredDirectoryNames = new Set([
  ".git",
  ".next",
  ".nuxt",
  ".svelte-kit",
  "build",
  "coverage",
  "dist",
  "logs",
  "node_modules",
  "out",
  "target",
  "vendor",
]);

const sensitiveFileNames = new Set([
  ".env",
  ".npmrc",
  ".pypirc",
  "credentials.json",
  "id_dsa",
  "id_ed25519",
  "id_rsa",
  "secrets.json",
]);

const sensitiveExtensions = new Set([
  ".key",
  ".p12",
  ".pem",
  ".pfx",
]);

export function shouldIgnoreDirectory(directoryName) {
  return ignoredDirectoryNames.has(
    directoryName.toLowerCase(),
  );
}

export function isSensitiveFile(fileName) {
  const normalizedName = fileName.toLowerCase();

  if (normalizedName === ".env.example") {
    return false;
  }

  if (
    normalizedName.startsWith(".env.") ||
    sensitiveFileNames.has(normalizedName)
  ) {
    return true;
  }

  return [...sensitiveExtensions].some((extension) =>
    normalizedName.endsWith(extension),
  );
}
