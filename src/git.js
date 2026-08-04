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

