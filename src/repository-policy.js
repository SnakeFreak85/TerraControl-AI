import path from "node:path";

export const repositoryLimits = Object.freeze({
  maximumFiles: 5000,
  maximumFileSizeBytes: 256 * 1024,
  maximumTotalContentBytes: 2 * 1024 * 1024,
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

const readableFileNames = new Set([
  ".editorconfig",
  ".env.example",
  ".gitattributes",
  ".gitignore",
  "dockerfile",
  "license",
  "makefile",
]);

const readableExtensions = new Set([
  ".c",
  ".cpp",
  ".cs",
  ".css",
  ".go",
  ".graphql",
  ".h",
  ".html",
  ".java",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".php",
  ".properties",
  ".ps1",
  ".py",
  ".rb",
  ".rs",
  ".scss",
  ".sh",
  ".sql",
  ".svelte",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".vue",
  ".xml",
  ".yaml",
  ".yml",
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

export function isReadableTextFile(fileName) {
  const normalizedName = fileName.toLowerCase();

  if (isSensitiveFile(normalizedName)) {
    return false;
  }

  if (readableFileNames.has(normalizedName)) {
    return true;
  }

  return readableExtensions.has(
    path.extname(normalizedName),
  );
}
