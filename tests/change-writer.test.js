import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { applyChangeDrafts } from "../src/change-writer.js";

function createDraftedWorkOrder(
  repositoryPath,
  drafts,
) {
  return Object.freeze({
    id: "work-order-001",
    repositoryPath,
    status: "drafted",
    drafts: Object.freeze(
      drafts.map((draft) =>
        Object.freeze(draft),
      ),
    ),
  });
}

const cleanGitStatusReader = async () => ({
  clean: true,
});

test("schreibt freigegebene Entwürfe in eine reguläre Datei", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-write-"),
  );

  const filePath = path.join(
    temporaryDirectory,
    "example.txt",
  );

  try {
    await writeFile(
      filePath,
      "original",
      "utf8",
    );

    const result = await applyChangeDrafts(
      createDraftedWorkOrder(
        temporaryDirectory,
        [
          {
            file: "example.txt",
            originalContent: "original",
            proposedContent: "changed",
          },
        ],
      ),
      {
        gitStatusReader:
          cleanGitStatusReader,
      },
    );

    assert.equal(result.status, "applied");
    assert.deepEqual(
      result.appliedFiles,
      ["example.txt"],
    );

    assert.equal(
      await readFile(filePath, "utf8"),
      "changed",
    );
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
});

test("lehnt ein bereits verändertes Repository ab", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-dirty-"),
  );

  const filePath = path.join(
    temporaryDirectory,
    "example.txt",
  );

  try {
    await writeFile(
      filePath,
      "original",
      "utf8",
    );

    await assert.rejects(
      applyChangeDrafts(
        createDraftedWorkOrder(
          temporaryDirectory,
          [
            {
              file: "example.txt",
              originalContent: "original",
              proposedContent: "changed",
            },
          ],
        ),
        {
          gitStatusReader: async () => ({
            clean: false,
          }),
        },
      ),
      /bereits Änderungen/,
    );

    assert.equal(
      await readFile(filePath, "utf8"),
      "original",
    );
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
});

test("erkennt Änderungen seit der Analyse", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-stale-"),
  );

  const filePath = path.join(
    temporaryDirectory,
    "example.txt",
  );

  try {
    await writeFile(
      filePath,
      "changed-by-someone-else",
      "utf8",
    );

    await assert.rejects(
      applyChangeDrafts(
        createDraftedWorkOrder(
          temporaryDirectory,
          [
            {
              file: "example.txt",
              originalContent: "original",
              proposedContent: "proposed",
            },
          ],
        ),
        {
          gitStatusReader:
            cleanGitStatusReader,
        },
      ),
      /seit der Analyse verändert/,
    );

    assert.equal(
      await readFile(filePath, "utf8"),
      "changed-by-someone-else",
    );
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
});

test("setzt bereits geschriebene Dateien bei einem Fehler zurück", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-rollback-"),
  );

  const firstPath = path.join(
    temporaryDirectory,
    "first.txt",
  );

  const secondPath = path.join(
    temporaryDirectory,
    "second.txt",
  );

  try {
    await writeFile(firstPath, "first-original");
    await writeFile(secondPath, "second-original");

    let replacementCall = 0;

    const controlledReplacer = async (
      filePath,
      content,
    ) => {
      replacementCall += 1;

      if (replacementCall === 2) {
        throw new Error(
          "Simulierter Schreibfehler",
        );
      }

      await writeFile(
        filePath,
        content,
        "utf8",
      );
    };

    await assert.rejects(
      applyChangeDrafts(
        createDraftedWorkOrder(
          temporaryDirectory,
          [
            {
              file: "first.txt",
              originalContent: "first-original",
              proposedContent: "first-changed",
            },
            {
              file: "second.txt",
              originalContent: "second-original",
              proposedContent: "second-changed",
            },
          ],
        ),
        {
          gitStatusReader:
            cleanGitStatusReader,
          fileReplacer:
            controlledReplacer,
        },
      ),
      /zurückgesetzt/,
    );

    assert.equal(
      await readFile(firstPath, "utf8"),
      "first-original",
    );

    assert.equal(
      await readFile(secondPath, "utf8"),
      "second-original",
    );
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
});

test("verhindert Schreibpfade außerhalb des Repositorys", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-outside-"),
  );

  try {
    await assert.rejects(
      applyChangeDrafts(
        createDraftedWorkOrder(
          temporaryDirectory,
          [
            {
              file: "../outside.txt",
              originalContent: "original",
              proposedContent: "changed",
            },
          ],
        ),
        {
          gitStatusReader:
            cleanGitStatusReader,
        },
      ),
      /außerhalb des Repositorys/,
    );
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
});
