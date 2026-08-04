import {
  access,
  readFile,
} from "node:fs/promises";
import path from "node:path";

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectPackageManager(repositoryPath) {
  const lockFiles = [
    {
      file: "pnpm-lock.yaml",
      packageManager: "pnpm",
    },
    {
      file: "yarn.lock",
      packageManager: "yarn",
    },
    {
      file: "package-lock.json",
      packageManager: "npm",
    },
  ];

  for (const candidate of lockFiles) {
    if (
      await fileExists(
        path.join(repositoryPath, candidate.file),
      )
    ) {
      return candidate.packageManager;
    }
  }

  return "npm";
}

export async function detectProject(repositoryPath) {
  const packageJsonPath = path.join(
    repositoryPath,
    "package.json",
  );

  if (!(await fileExists(packageJsonPath))) {
    return Object.freeze({
      type: "unknown",
      manifest: null,
      packageManager: null,
      scripts: Object.freeze({}),
    });
  }

  let packageData;

  try {
    const packageContent = await readFile(
      packageJsonPath,
      "utf8",
    );

    packageData = JSON.parse(
      packageContent.replace(/^\uFEFF/, ""),
    );
  } catch (error) {
    throw new Error(
      `package.json konnte nicht gelesen werden: ${error.message}`,
    );
  }

  const scripts =
    packageData.scripts &&
    typeof packageData.scripts === "object"
      ? Object.fromEntries(
          Object.entries(packageData.scripts)
            .filter(
              ([name, command]) =>
                typeof name === "string" &&
                typeof command === "string",
            )
            .sort(([left], [right]) =>
              left.localeCompare(right),
            ),
        )
      : {};

  return Object.freeze({
    type: "node",
    manifest: "package.json",
    packageManager:
      await detectPackageManager(repositoryPath),
    scripts: Object.freeze(scripts),
  });
}
