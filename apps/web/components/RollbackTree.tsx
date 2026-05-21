"use client";

/**
 * RollbackTree — visualises branch splits in an eval run.
 *
 * Props: an array of {branchId, parentId, rolledBack} objects derived from
 * EvalState.branches.  The component renders a simple indented tree; no
 * heavy graph library required.
 */

interface BranchNode {
  id: number;
  parentId: number | null;
  rolledBack: boolean;
  depth: number;
  score: number;
}

interface Props {
  branches: BranchNode[];
  currentBranchId: number;
}

export function RollbackTree({ branches, currentBranchId }: Props) {
  if (branches.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 text-xs font-mono">
      <p className="text-zinc-500 uppercase tracking-widest text-[10px] mb-1">Branch tree</p>
      {branches.map((b) => (
        <BranchRow key={b.id} branch={b} isCurrent={b.id === currentBranchId} />
      ))}
    </div>
  );
}

function BranchRow({ branch, isCurrent }: { branch: BranchNode; isCurrent: boolean }) {
  const indent = branch.parentId !== null ? "ml-4 pl-2 border-l border-zinc-800" : "";
  const label  = branch.rolledBack ? "text-orange-400 line-through" : isCurrent ? "text-blue-300" : "text-zinc-400";

  return (
    <div className={`flex items-center gap-2 ${indent}`}>
      <span className={label}>
        {isCurrent ? "▶ " : "  "}B{branch.id}
      </span>
      <span className="text-zinc-600">
        depth {branch.depth} · score {(branch.score * 100).toFixed(0)}%
        {branch.rolledBack ? " · rolled back" : ""}
      </span>
    </div>
  );
}
