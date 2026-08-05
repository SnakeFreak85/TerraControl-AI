import { spawn } from "node:child_process";

function runGit(repositoryPath, argumentsList) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(
      "git",
      ["-C", repositoryPath, ...argumentsList],
      {
        windowsHide: true,
        shell: false,
      },
    );

    let standardOutput = "";
    let errorOutput = "";

    childProcess.stdout.setEncoding("utf8");
    childProcess.stderr.setEncoding("utf8");

    childProcess.stdout.on("data", (data) => {
      standardOutput += data;
    });

    childProcess.stderr.on("data", (data) => {
      errorOutput += data;
    });

    childProcess.on("error", (error) => {
      reject(
        new Error(`Git konnte nicht gestartet werden: ${error.message}`),
      );
    });

    childProcess.on("close", (exitCode) => {
      if (exitCode !== 0) {
        reject(
          new Error(
            errorOutput.trim() ||
              `Git wurde mit Code ${exitCode} beendet.`,
          ),
        );
        return;
      }

      resolve(standardOutput.trimEnd());
    });
  });
}

export async function getGitStatus(repositoryPath) {
  const isRepository = await runGit(repositoryPath, [
    "rev-parse",
    "--is-inside-work-tree",
  ]);

  if (isRepository !== "true") {
    throw new Error(
      `Der Pfad ist kein Git-Repository: ${repositoryPath}`,
    );
  }

  const branch = await runGit(repositoryPath, [
    "branch",
    "--show-current",
  ]);

  const statusOutput = await runGit(repositoryPath, [
    "status",
    "--short",
  ]);

  const remoteNames = await runGit(repositoryPath, [
    "remote",
  ]);

  let remoteUrl = null;

  if (remoteNames.split(/\r?\n/).includes("origin")) {
    remoteUrl = await runGit(repositoryPath, [
      "remote",
      "get-url",
      "origin",
    ]);
  }

  const changes = statusOutput
    ? statusOutput.split(/\r?\n/)
    : [];

  return Object.freeze({
    branch: branch || "(kein Branch)",
    remoteUrl,
    clean: changes.length === 0,
    changes,
  });
}


export const gitDiffLimits = Object.freeze({
  maximumDiffBytes: 512 * 1024,
});

function normalizeGitPath(filePath) {
  if (
    typeof filePath !== "string" ||
    filePath.trim().length === 0
  ) {
    throw new TypeError(
      "Jeder Git-Diff-Pfad muss eine Zeichenkette sein.",
    );
  }

  const normalizedPath = filePath
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "");

  if (
    normalizedPath.startsWith("/") ||
    /^[a-zA-Z]:\//.test(normalizedPath) ||
    normalizedPath === ".." ||
    normalizedPath.startsWith("../") ||
    normalizedPath.includes("/../") ||
    normalizedPath.includes("\0")
  ) {
    throw new Error(
      `Ungültiger Git-Diff-Pfad: ${filePath}`,
    );
  }

  return normalizedPath;
}

export async function getGitDiff(
  repositoryPath,
  relativePaths,
) {
  if (
    !Array.isArray(relativePaths) ||
    relativePaths.length === 0
  ) {
    throw new TypeError(
      "Für den Git-Diff wird mindestens ein Dateipfad benötigt.",
    );
  }

  const normalizedPaths = [
    ...new Set(
      relativePaths.map(normalizeGitPath),
    ),
  ];

  const diffText = await runGit(
    repositoryPath,
    [
      "diff",
      "--no-ext-diff",
      "--unified=3",
      "--",
      ...normalizedPaths,
    ],
  );

  const sizeBytes = Buffer.byteLength(
    diffText,
    "utf8",
  );

  if (
    sizeBytes >
    gitDiffLimits.maximumDiffBytes
  ) {
    throw new RangeError(
      "Der Git-Diff überschreitet das sichere Ausgabelimit.",
    );
  }

  return Object.freeze({
    files: Object.freeze(normalizedPaths),
    text: diffText,
    sizeBytes,
    empty: diffText.length === 0,
  });
}
