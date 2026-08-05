import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { getGitDiff } from "../src/git.js";

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

async function createTemporaryGitRepository() {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-git-diff-"),
  );

  await runGit(
    temporaryDirectory,
    ["init"],
  );

  await runGit(
    temporaryDirectory,
    [
      "config",
      "user.name",
      "TerraControl Test",
    ],
  );

  await runGit(
    temporaryDirectory,
    [
      "config",
      "user.email",
      "test@example.invalid",
    ],
  );

  return temporaryDirectory;
}

test("liest nur den Diff der freigegebenen Datei", async () => {
  const temporaryDirectory =
    await createTemporaryGitRepository();

  try {
    const firstFile = path.join(
      temporaryDirectory,
      "first.txt",
    );

    const secondFile = path.join(
      temporaryDirectory,
      "second.txt",
    );

    await writeFile(firstFile, "old-first\n");
    await writeFile(secondFile, "old-second\n");

    await runGit(
      temporaryDirectory,
      ["add", "first.txt", "second.txt"],
    );

    await runGit(
      temporaryDirectory,
      ["commit", "-m", "Initial"],
    );

    await writeFile(firstFile, "new-first\n");
    await writeFile(secondFile, "new-second\n");

    const diff = await getGitDiff(
      temporaryDirectory,
      ["first.txt"],
    );

    assert.equal(diff.empty, false);
    assert.deepEqual(diff.files, ["first.txt"]);
    assert.match(diff.text, /-old-first/);
    assert.match(diff.text, /\+new-first/);
    assert.doesNotMatch(diff.text, /second\.txt/);
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
});

test("lehnt Pfade außerhalb des Repositorys ab", async () => {
  await assert.rejects(
    getGitDiff(
      ".",
      ["../outside.txt"],
    ),
    /Ungültiger Git-Diff-Pfad/,
  );
});
