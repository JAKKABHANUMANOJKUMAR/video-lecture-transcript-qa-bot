from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
EVAL_ROOT = ROOT / "evaluation"
DATASETS_DIR = EVAL_ROOT / "datasets"
REPORTS_DIR = EVAL_ROOT / "reports"
RESULTS_DIR = EVAL_ROOT / "results"
COMBINED_DIR = EVAL_ROOT / "combined"

for folder in [REPORTS_DIR, RESULTS_DIR, COMBINED_DIR]:
    folder.mkdir(parents=True, exist_ok=True)

files = sorted(DATASETS_DIR.glob("*.json"))
if not files:
    raise SystemExit("No evaluation datasets found in rag/evaluation/datasets")

combined_rows = []
for dataset_path in files:
    dataset_name = dataset_path.stem
    report_path = REPORTS_DIR / f"{dataset_name}.txt"
    result_path = RESULTS_DIR / f"{dataset_name}.json"
    env = os.environ.copy()
    env["PYTHONPATH"] = str(ROOT) + os.pathsep + env.get("PYTHONPATH", "")
    cmd = [
        sys.executable,
        str(ROOT / "eval_rag.py"),
        str(dataset_path),
        "--video-path",
        json.loads(dataset_path.read_text(encoding="utf-8"))["video_path"],
        "--output",
        str(result_path),
        "--report",
        str(report_path),
    ]
    print(f"Running evaluation for {dataset_name}...")
    success = False
    for attempt in range(1, 4):
        try:
            completed = subprocess.run(cmd, cwd=ROOT, check=False, env=env, capture_output=True, text=True)
            if completed.returncode == 0:
                success = True
                break
            output = (completed.stdout or "") + (completed.stderr or "")
            is_rate_limit = "ratelimit" in output.lower() or "rate limit" in output.lower() or "429" in output
            if is_rate_limit and attempt < 3:
                wait_seconds = 90 * attempt
                print(f"Rate-limited for {dataset_name}; retrying in {wait_seconds}s (attempt {attempt}/3)")
                time.sleep(wait_seconds)
                continue
            raise RuntimeError(output or f"Evaluation failed with exit code {completed.returncode}")
        except Exception as exc:
            if attempt < 3:
                wait_seconds = 90 * attempt
                print(f"Retrying {dataset_name} after error: {exc}\nWaiting {wait_seconds}s...")
                time.sleep(wait_seconds)
                continue
            report_path.write_text(
                f"Evaluation failed for {dataset_name}: {exc}\n",
                encoding="utf-8",
            )
            if not result_path.exists():
                result_path.write_text("[]", encoding="utf-8")
            success = False
            break

    if not success:
        continue

    if result_path.exists():
        with result_path.open(encoding="utf-8") as fh:
            rows = json.load(fh)
        if rows:
            metrics = {
                "dataset": dataset_name,
                "questions": len(rows),
                "faithfulness_score": round(sum(r.get("faithfulness_score", 0.0) for r in rows) / len(rows), 3),
                "retrieval_score": round(sum(r.get("retrieval_score", 0.0) for r in rows) / len(rows), 3),
                "context_precision": round(sum(r.get("context_precision", 0.0) for r in rows) / len(rows), 3),
                "context_recall": round(sum(r.get("context_recall", 0.0) for r in rows) / len(rows), 3),
                "recall_at_k": round(sum(r.get("recall_at_k", 0.0) for r in rows) / len(rows), 3),
                "hit_rate_at_k": round(sum(r.get("hit_rate_at_k", 0.0) for r in rows) / len(rows), 3),
                "answer_relevancy": round(sum(r.get("answer_relevancy_score", 0.0) for r in rows) / len(rows), 3),
                "mrr": round(sum(r.get("mrr", 0.0) for r in rows) / len(rows), 3),
            }
            combined_rows.append(metrics)

combined_path = COMBINED_DIR / "combined_report.json"
combined_path.write_text(json.dumps(combined_rows, indent=2, ensure_ascii=False), encoding="utf-8")
combined_txt_path = COMBINED_DIR / "combined_report.txt"
combined_txt_lines = ["=== Combined Evaluation Summary ==="]
for row in combined_rows:
    combined_txt_lines.append(
        f"{row['dataset']}: faithfulness={row['faithfulness_score']}, retrieval={row['retrieval_score']}, "
        f"precision={row['context_precision']}, recall={row['context_recall']}, recall@k={row['recall_at_k']}, "
        f"hit@k={row['hit_rate_at_k']}, answer_relevancy={row['answer_relevancy']}, mrr={row['mrr']}"
    )
combined_txt_path.write_text("\n".join(combined_txt_lines), encoding="utf-8")
print(f"Saved combined results to {combined_path}")
print(f"Saved combined text summary to {combined_txt_path}")
