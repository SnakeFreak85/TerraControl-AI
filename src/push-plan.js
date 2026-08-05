export function createPushPlan(
  committedWorkOrder,
  gitStatus,
) {
  if (
    !committedWorkOrder ||
    committedWorkOrder.status !== "committed"
  ) {
    throw new Error(
      "Ein Push-Plan benötigt einen erfolgreich erstellten Commit.",
    );
  }

  if (
    typeof committedWorkOrder.commitSha !==
      "string" ||
    !/^[0-9a-f]{40}$/.test(
      committedWorkOrder.commitSha,
    )
  ) {
    throw new Error(
      "Der Arbeitsauftrag enthält keine gültige Commit-ID.",
    );
  }

  if (
    !gitStatus ||
    !gitStatus.clean
  ) {
    throw new Error(
      "Ein Push ist nur aus einem sauberen Repository erlaubt.",
    );
  }

  if (
    gitStatus.branch !==
    committedWorkOrder.branch
  ) {
    throw new Error(
      "Der aktuelle Branch stimmt nicht mit dem Commit-Plan überein.",
    );
  }

  if (
    typeof gitStatus.remoteUrl !== "string" ||
    gitStatus.remoteUrl.length === 0
  ) {
    throw new Error(
      "Für den Push ist kein origin-Remote eingerichtet.",
    );
  }

  if (
    !/^[a-zA-Z0-9._/-]+$/.test(
      committedWorkOrder.branch,
    ) ||
    committedWorkOrder.branch.includes("..") ||
    committedWorkOrder.branch.startsWith("/") ||
    committedWorkOrder.branch.endsWith("/")
  ) {
    throw new Error(
      "Der Branchname ist für einen automatischen Push nicht zulässig.",
    );
  }

  return Object.freeze({
    status: "ready-to-push",
    workOrderId:
      committedWorkOrder.workOrderId,
    repositoryPath:
      committedWorkOrder.repositoryPath,
    remoteName: "origin",
    remoteUrl: gitStatus.remoteUrl,
    branch: committedWorkOrder.branch,
    commitSha:
      committedWorkOrder.commitSha,
    force: false,
  });
}
