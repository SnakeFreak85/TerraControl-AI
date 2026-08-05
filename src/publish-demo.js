import { execFile } from "node:child_process";
import {
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  executeCommitPlan,
} from "./commit-executor.js";
import {
  createCommitPlan,
} from "./commit-plan.js";
import {
  formatCommitPlanPreview,
} from "./commit-preview.js";
import {
  getGitChangedFiles,
  getGitStatus,
} from "./git.js";
import {
  formatPublishFailureReport,
  formatPublishSuccessReport,
} from "./publish-report.js";
import {
  executePushPlan,
} from "./push-executor.js";
import {
  createPushPlan,
} from "./push-plan.js";

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

async function main() {
  const rootPath = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-publish-demo-"),
  );

  const remotePath = path.join(
    rootPath,
    "remote.git",
  );

  const repositoryPath = path.join(
    rootPath,
    "repository",
  );

  try {
    await runGit(rootPath, [
      "init",
      "--bare",
      remotePath,
    ]);

    await runGit(rootPath, [
      "init",
      repositoryPath,
    ]);

    await runGit(
      repositoryPath,
      [
        "config",
        "user.name",
        "TerraControl Demo",
      ],
    );

    await runGit(
      repositoryPath,
      [
        "config",
        "user.email",
        "demo@example.invalid",
      ],
    );

    await runGit(
      repositoryPath,
      [
        "remote",
        "add",
        "origin",
        remotePath,
      ],
    );

    await writeFile(
      path.join(
        repositoryPath,
        "example.txt",
      ),
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

    await runGit(
      repositoryPath,
      ["branch", "-M", "main"],
    );

    await runGit(
      repositoryPath,
      ["push", "-u", "origin", "main"],
    );

    await writeFile(
      path.join(
        repositoryPath,
        "example.txt",
      ),
      "changed\n",
    );

    const validatedWorkOrder =
      Object.freeze({
        id: "publish-demo-001",
        repositoryPath,
        status: "validated",
        appliedFiles:
          Object.freeze([
            "example.txt",
          ]),
      });

    const gitStatusBeforeCommit =
      await getGitStatus(
        repositoryPath,
      );

    const changedFiles =
      await getGitChangedFiles(
        repositoryPath,
      );

    const commitPlan = createCommitPlan(
      validatedWorkOrder,
      {
        message:
          "fix: update demo content",
        gitStatus:
          gitStatusBeforeCommit,
        changedFiles,
      },
    );

    console.log(
      formatCommitPlanPreview(
        commitPlan,
      ),
    );

    console.log("");

    const committedWorkOrder =
      await executeCommitPlan(
        commitPlan,
      );

    const gitStatusBeforePush =
      await getGitStatus(
        repositoryPath,
      );

    const pushPlan = createPushPlan(
      committedWorkOrder,
      gitStatusBeforePush,
    );

    const pushedWorkOrder =
      await executePushPlan(
        pushPlan,
      );

    console.log(
      formatPublishSuccessReport(
        pushedWorkOrder,
      ),
    );
  } catch (error) {
    console.error(
      formatPublishFailureReport(
        error,
      ),
    );

    process.exitCode = 1;
  } finally {
    await rm(rootPath, {
      recursive: true,
      force: true,
    });
  }
}

main();
