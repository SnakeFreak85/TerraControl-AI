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

export async function getGitChangedFiles(
  repositoryPath,
) {
  const statusOutput = await runGit(
    repositoryPath,
    [
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
    ],
  );

  if (statusOutput.length === 0) {
    return Object.freeze([]);
  }

  const records = statusOutput.split("\0");
  const changedFiles = [];

  for (
    let index = 0;
    index < records.length;
    index += 1
  ) {
    const record = records[index];

    if (!record) {
      continue;
    }

    if (record.length < 4) {
      throw new Error(
        "Git lieferte einen unerwarteten Statusdatensatz.",
      );
    }

    const status = record.slice(0, 2);
    const file = record
      .slice(3)
      .replaceAll("\\", "/");

    let originalFile = null;

    if (
      status.includes("R") ||
      status.includes("C")
    ) {
      index += 1;

      originalFile =
        records[index]?.replaceAll(
          "\\",
          "/",
        ) || null;
    }

    changedFiles.push(
      Object.freeze({
        status,
        file,
        originalFile,
      }),
    );
  }

  changedFiles.sort((left, right) =>
    left.file.localeCompare(right.file),
  );

  return Object.freeze(changedFiles);
}

function normalizeGitFileList(
  relativePaths,
  operationName,
) {
  if (
    !Array.isArray(relativePaths) ||
    relativePaths.length === 0
  ) {
    throw new TypeError(
      `${operationName} benötigt mindestens einen Dateipfad.`,
    );
  }

  return [
    ...new Set(
      relativePaths.map(normalizeGitPath),
    ),
  ];
}

export async function stageGitFiles(
  repositoryPath,
  relativePaths,
) {
  const normalizedPaths =
    normalizeGitFileList(
      relativePaths,
      "Git-Vormerkung",
    );

  await runGit(
    repositoryPath,
    [
      "add",
      "--",
      ...normalizedPaths,
    ],
  );

  return Object.freeze(normalizedPaths);
}

export async function getStagedGitFiles(
  repositoryPath,
) {
  const output = await runGit(
    repositoryPath,
    [
      "diff",
      "--cached",
      "--name-only",
      "-z",
      "--",
    ],
  );

  const files = output
    .split("\0")
    .filter(Boolean)
    .map((file) =>
      file.replaceAll("\\", "/"),
    )
    .sort((left, right) =>
      left.localeCompare(right),
    );

  return Object.freeze(files);
}

export async function unstageGitFiles(
  repositoryPath,
  relativePaths,
) {
  const normalizedPaths =
    normalizeGitFileList(
      relativePaths,
      "Aufheben der Git-Vormerkung",
    );

  await runGit(
    repositoryPath,
    [
      "restore",
      "--staged",
      "--",
      ...normalizedPaths,
    ],
  );

  return Object.freeze(normalizedPaths);
}

export async function createGitCommit(
  repositoryPath,
  message,
) {
  if (
    typeof message !== "string" ||
    message.trim().length === 0 ||
    message.includes("\n") ||
    message.includes("\r")
  ) {
    throw new Error(
      "Für den Git-Commit wird eine einzeilige Nachricht benötigt.",
    );
  }

  await runGit(
    repositoryPath,
    [
      "commit",
      "-m",
      message.trim(),
    ],
  );

  const commitSha = await runGit(
    repositoryPath,
    [
      "rev-parse",
      "HEAD",
    ],
  );

  const commitSubject = await runGit(
    repositoryPath,
    [
      "log",
      "-1",
      "--pretty=%s",
    ],
  );

  return Object.freeze({
    commitSha,
    commitSubject,
  });
}

function validateGitRefName(
  value,
  fieldName,
) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    !/^[a-zA-Z0-9._/-]+$/.test(value) ||
    value.includes("..") ||
    value.startsWith("/") ||
    value.endsWith("/")
  ) {
    throw new Error(
      `Ungültiger ${fieldName}: ${value}`,
    );
  }

  return value;
}

export async function getHeadCommitSha(
  repositoryPath,
) {
  const commitSha = await runGit(
    repositoryPath,
    [
      "rev-parse",
      "HEAD",
    ],
  );

  if (!/^[0-9a-f]{40}$/.test(commitSha)) {
    throw new Error(
      "Git lieferte keine gültige HEAD-Commit-ID.",
    );
  }

  return commitSha;
}

export async function pushGitBranch(
  repositoryPath,
  remoteName,
  branch,
) {
  const validatedRemote =
    validateGitRefName(
      remoteName,
      "Remote-Name",
    );

  const validatedBranch =
    validateGitRefName(
      branch,
      "Branchname",
    );

  const output = await runGit(
    repositoryPath,
    [
      "push",
      "--porcelain",
      validatedRemote,
      `HEAD:refs/heads/${validatedBranch}`,
    ],
  );

  return Object.freeze({
    remoteName: validatedRemote,
    branch: validatedBranch,
    output,
    force: false,
  });
}

export async function getRemoteBranchSha(
  repositoryPath,
  remoteName,
  branch,
) {
  const validatedRemote =
    validateGitRefName(
      remoteName,
      "Remote-Name",
    );

  const validatedBranch =
    validateGitRefName(
      branch,
      "Branchname",
    );

  const output = await runGit(
    repositoryPath,
    [
      "ls-remote",
      "--exit-code",
      validatedRemote,
      `refs/heads/${validatedBranch}`,
    ],
  );

  const [
    commitSha,
  ] = output.split(/\s+/);

  if (!/^[0-9a-f]{40}$/.test(commitSha)) {
    throw new Error(
      "Remote lieferte keine gültige Commit-ID.",
    );
  }

  return commitSha;
}
