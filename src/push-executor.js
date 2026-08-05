import {
  getGitStatus,
  getHeadCommitSha,
  getRemoteBranchSha,
  pushGitBranch,
} from "./git.js";

export async function executePushPlan(
  pushPlan,
  {
    gitStatusReader = getGitStatus,
    headReader = getHeadCommitSha,
    branchPusher = pushGitBranch,
    remoteBranchReader =
      getRemoteBranchSha,
  } = {},
) {
  if (
    !pushPlan ||
    pushPlan.status !== "ready-to-push" ||
    pushPlan.force !== false
  ) {
    throw new Error(
      "Ein geprüfter Push-Plan ohne Force wird benötigt.",
    );
  }

  const statusBeforePush =
    await gitStatusReader(
      pushPlan.repositoryPath,
    );

  if (!statusBeforePush.clean) {
    throw new Error(
      "Das Repository ist vor dem Push nicht sauber.",
    );
  }

  if (
    statusBeforePush.branch !==
    pushPlan.branch
  ) {
    throw new Error(
      "Der aktuelle Branch stimmt vor dem Push nicht mit dem Push-Plan überein.",
    );
  }

  if (
    statusBeforePush.remoteUrl !==
    pushPlan.remoteUrl
  ) {
    throw new Error(
      "Das konfigurierte Remote wurde seit der Planung verändert.",
    );
  }

  const localCommitSha =
    await headReader(
      pushPlan.repositoryPath,
    );

  if (
    localCommitSha !==
    pushPlan.commitSha
  ) {
    throw new Error(
      "HEAD stimmt nicht mit dem freigegebenen Commit überein.",
    );
  }

  const pushResult =
    await branchPusher(
      pushPlan.repositoryPath,
      pushPlan.remoteName,
      pushPlan.branch,
    );

  const remoteCommitSha =
    await remoteBranchReader(
      pushPlan.repositoryPath,
      pushPlan.remoteName,
      pushPlan.branch,
    );

  if (
    remoteCommitSha !==
    pushPlan.commitSha
  ) {
    throw new Error(
      "Der Push konnte nicht eindeutig auf dem Remote verifiziert werden.",
    );
  }

  const statusAfterPush =
    await gitStatusReader(
      pushPlan.repositoryPath,
    );

  if (
    !statusAfterPush.clean ||
    statusAfterPush.branch !==
      pushPlan.branch
  ) {
    throw new Error(
      "Der lokale Repository-Status hat sich während des Pushs unerwartet verändert.",
    );
  }

  return Object.freeze({
    ...pushPlan,
    status: "pushed",
    localCommitSha,
    remoteCommitSha,
    pushOutput: pushResult.output,
  });
}
