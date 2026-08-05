import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  getGitChangedFiles,
  getStagedGitFiles,
  stageGitFiles,
  unstageGitFiles,
} from "../src/git.js";

const execFileAsync = promisify(execFile);

async function runGit(
  repositoryPath,
  argumentsList,
) {
  await execFileAsync(
    "git",
    [
      "-C",
      repositoryPath,
      ...argumentsList,
    ],
    {
      windowsHide: true,
    },
  );
}

async function createRepository() {
  const repositoryPath = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-stage-"),
  );

  await runGit(repositoryPath, ["init"]);

  await runGit(
    repositoryPath,
    [
      "config",
      "user.name",
      "TerraControl Test",
    ],
  );

  await runGit(
    repositoryPath,
    [
      "config",
      "user.email",
      "test@example.invalid",
    ],
  );

  await writeFile(
    path.join(repositoryPath, "example.txt"),
    "original\n",
  );

  await runGit(
    repositoryPath,
    ["add", "example.txt"],
  );

  await runGit(
    repositoryPath,
    ["commit", "-m", "Initial"],
  );

  await writeFile(
    path.join(repositoryPath, "example.txt"),
    "changed\n",
  );

  return repositoryPath;
}

test("merkt nur freigegebene Dateien vor und hebt die Vormerkung auf", async () => {
  const repositoryPath =
    await createRepository();

  try {
    await stageGitFiles(
      repositoryPath,
      ["example.txt"],
    );

    assert.deepEqual(
      await getStagedGitFiles(
        repositoryPath,
      ),
      ["example.txt"],
    );

    await unstageGitFiles(
      repositoryPath,
      ["example.txt"],
    );

    assert.deepEqual(
      await getStagedGitFiles(
        repositoryPath,
      ),
      [],
    );

    assert.equal(
      await readFile(
        path.join(
          repositoryPath,
          "example.txt",
        ),
        "utf8",
      ),
      "changed\n",
    );

    const changedFiles =
      await getGitChangedFiles(
        repositoryPath,
      );

    assert.deepEqual(
      changedFiles.map(
        ({ status, file }) => ({
          status,
          file,
        }),
      ),
      [
        {
          status: " M",
          file: "example.txt",
        },
      ],
    );
  } finally {
    await rm(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});

test("lehnt Vormerkung außerhalb des Repositorys ab", async () => {
  await assert.rejects(
    stageGitFiles(
      ".",
      ["../outside.txt"],
    ),
    /Ungültiger Git-Diff-Pfad/,
  );
});
