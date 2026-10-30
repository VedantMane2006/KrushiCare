"""
KrushiCare ML Evaluation -- Chart Generator (v2, patched)
==========================================================
Uses real per-image prediction records from the handoff ZIP.
Outputs written to ml/evaluation/:
  confusion_matrix.png       -- full 13x13 real matrix (replaces diagonal-only v1)
  per_class_metrics.png      -- precision/recall/F1 (unchanged logic, same source CSV)
  model_comparison.png       -- controlled vs field accuracy (unchanged)
  confidence_bucket_table.png -- verdict breakdown (unchanged)
  reliability_diagram.png    -- NEW: post-calibration reliability from field_validation.csv

Run from repo root:
  python ml/evaluation/generate_charts.py
"""

import csv
import json
from pathlib import Path
from collections import defaultdict

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from matplotlib.colors import LinearSegmentedColormap
import numpy as np

# ---------------------------------------------------------------------------
REPO = Path(__file__).resolve().parents[2]
EVAL = REPO / "ml" / "evaluation"

PREDICTIONS_CSV   = EVAL / "final_plantdoc_test_predictions.csv"
FIELD_VAL_CSV     = EVAL / "final_v1_field_validation.csv"
PER_CLASS_CSV     = EVAL / "final_plantdoc_test_per_class.csv"
METRICS_JSON      = EVAL / "final_plantdoc_test_metrics.json"
THRESHOLD_JSON    = EVAL / "threshold_validation_report.json"
CALIB_JSON        = REPO / "ml" / "models" / "calibration_report.json"
LABELS_JSON       = REPO / "ml" / "models" / "labels.json"

# ---------------------------------------------------------------------------
C_TEAL   = "#1abc9c"
C_ORANGE = "#e67e22"
C_RED    = "#e74c3c"
C_BLUE   = "#2980b9"
C_GRAY   = "#95a5a6"
C_DARK   = "#2c3e50"
C_ABSENT = "#dfe6e9"   # cells for classes absent from the test set

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 10,
    "axes.spines.top":   False,
    "axes.spines.right": False,
    "figure.dpi": 150,
    "savefig.bbox": "tight",
    "savefig.pad_inches": 0.15,
})

# ---------------------------------------------------------------------------
# Load labels (fixed 13-class order from labels.json)
ALL_LABELS = json.loads(LABELS_JSON.read_text())          # 13 labels, model order

# Load per-class CSV for summary stats
per_class = {}
with open(PER_CLASS_CSV, newline="") as f:
    reader = csv.DictReader(f)
    for row in reader:
        name = row[""].strip()
        if name in ("accuracy", "macro avg", "weighted avg", "") or not name:
            continue
        per_class[name] = {
            "precision": float(row["precision"]),
            "recall":    float(row["recall"]),
            "f1":        float(row["f1-score"]),
            "support":   int(float(row["support"])),
        }

# Load prediction records
pred_rows = []
with open(PREDICTIONS_CSV, newline="") as f:
    pred_rows = list(csv.DictReader(f))

assert len(pred_rows) == 85, f"Expected 85 rows, got {len(pred_rows)}"
n_correct = sum(1 for r in pred_rows if r["correct"].strip() == "True")
assert n_correct == 37, f"Expected 37 correct, got {n_correct}"

# Load field validation records
val_rows = []
with open(FIELD_VAL_CSV, newline="") as f:
    val_rows = list(csv.DictReader(f))

assert len(val_rows) == 165, f"Expected 165 rows, got {len(val_rows)}"

metrics   = json.loads(METRICS_JSON.read_text())
threshold = json.loads(THRESHOLD_JSON.read_text())
calib     = json.loads(CALIB_JSON.read_text())


def short(label: str) -> str:
    """Two-line compact label: Crop\nDisease."""
    parts = label.split("__")
    crop    = parts[0].capitalize()
    disease = parts[1].replace("_", " ").title() if len(parts) > 1 else ""
    return f"{crop}\n{disease}"


# ===========================================================================
# 1. FULL 13x13 CONFUSION MATRIX  (real off-diagonal errors from CSV)
# ===========================================================================
# Classes present in test: 10  |  Absent: 3 (spider_mites, target_spot, potato_healthy)
ABSENT = {"tomato__spider_mites", "tomato__target_spot", "potato__healthy"}
PRESENT_LABELS = [l for l in ALL_LABELS if l not in ABSENT]   # 10, in model order

# Build 13x13 matrix
label_to_idx = {l: i for i, l in enumerate(ALL_LABELS)}
mat13 = np.zeros((13, 13), dtype=int)
for r in pred_rows:
    true_lbl = r["label"].strip()
    pred_lbl = r["predicted_label"].strip()
    i = label_to_idx[true_lbl]
    j = label_to_idx[pred_lbl]
    mat13[i, j] += 1

assert mat13.sum() == 85
assert np.diag(mat13).sum() == 37

short_ax = [short(l) for l in ALL_LABELS]
absent_idx = {label_to_idx[l] for l in ABSENT}

# Normalise per row (recall) for colour; raw counts as annotations
row_sums = mat13.sum(axis=1, keepdims=True).astype(float)
row_sums[row_sums == 0] = 1  # avoid /0 for absent classes
mat_norm = mat13 / row_sums

cmap = LinearSegmentedColormap.from_list("wt", ["#ffffff", C_TEAL])

fig, ax = plt.subplots(figsize=(12, 10))
n = 13

for i in range(n):
    for j in range(n):
        val      = mat13[i, j]
        is_absent_row = i in absent_idx
        is_absent_col = j in absent_idx

        if is_absent_row or is_absent_col:
            # Grey out absent-class cells; annotate with 'N/A'
            ax.add_patch(plt.Rectangle((j-0.5, i-0.5), 1, 1,
                                       color=C_ABSENT, zorder=0))
            if is_absent_row and is_absent_col:
                ax.text(j, i, "N/A", ha="center", va="center",
                        fontsize=6.5, color="#b2bec3")
        else:
            intensity = mat_norm[i, j]
            colour    = cmap(intensity)
            ax.add_patch(plt.Rectangle((j-0.5, i-0.5), 1, 1,
                                       color=colour, zorder=0))
            if val > 0:
                text_col = "white" if intensity > 0.6 else C_DARK
                ax.text(j, i, str(val), ha="center", va="center",
                        fontsize=8, fontweight="bold", color=text_col)
            # diagonal border
            if i == j:
                rect = plt.Rectangle((j-0.5, i-0.5), 1, 1,
                                     fill=False, edgecolor=C_ORANGE,
                                     linewidth=1.5, zorder=1)
                ax.add_patch(rect)

ax.set_xlim(-0.5, n-0.5)
ax.set_ylim(n-0.5, -0.5)
ax.set_xticks(range(n))
ax.set_yticks(range(n))
ax.set_xticklabels(short_ax, rotation=45, ha="right", fontsize=7)
ax.set_yticklabels(short_ax, fontsize=7)
ax.set_xlabel("Predicted class", labelpad=8)
ax.set_ylabel("True class", labelpad=8)
ax.set_title(
    "PlantDoc Final Test — Full 13\u00d713 Confusion Matrix\n"
    "MobileNetV3-Large v1 | 85 images | 10 classes present | "
    "3 absent classes shaded grey\n"
    "Colour = row-normalised recall; numbers = raw counts",
    fontsize=8.5, pad=10
)

# Legend patches
from matplotlib.patches import Patch
legend_els = [
    Patch(facecolor=cmap(1.0), edgecolor="none", label="All correct (recall=1)"),
    Patch(facecolor=cmap(0.0), edgecolor="none", label="All incorrect (recall=0)"),
    Patch(facecolor=C_ABSENT,  edgecolor="none", label="Class absent from test set"),
]
ax.legend(handles=legend_els, loc="lower right", fontsize=7.5,
          framealpha=0.85, bbox_to_anchor=(1.0, -0.28))

# Total / accuracy annotation
fig.text(0.5, -0.02,
         f"Total predictions: 85 | Correct: 37 | Incorrect: 48 | "
         f"Accuracy: 43.53% | Macro-F1: 0.420\n"
         f"Source: ml/evaluation/final_plantdoc_test_predictions.csv",
         ha="center", fontsize=7, color=C_GRAY)

plt.tight_layout()
out = EVAL / "confusion_matrix.png"
fig.savefig(out)
plt.close(fig)
print(f"  ok {out.relative_to(REPO)}")


# ===========================================================================
# 2. PER-CLASS PRECISION / RECALL / F1  (same source, unchanged logic)
# ===========================================================================
labels_ordered = list(per_class.keys())
short_labels   = [short(l) for l in labels_ordered]
x = np.arange(len(labels_ordered))
w = 0.26

fig, ax = plt.subplots(figsize=(12, 5.5))
ax.bar(x-w, [per_class[l]["precision"] for l in labels_ordered],
       width=w, label="Precision", color=C_BLUE,   alpha=0.88)
ax.bar(x,   [per_class[l]["recall"]    for l in labels_ordered],
       width=w, label="Recall",    color=C_TEAL,   alpha=0.88)
ax.bar(x+w, [per_class[l]["f1"]        for l in labels_ordered],
       width=w, label="F1-score",  color=C_ORANGE, alpha=0.88)

for i, lbl in enumerate(labels_ordered):
    ax.text(x[i]+w, per_class[lbl]["f1"]+0.025,
            f"n={per_class[lbl]['support']}", ha="center", fontsize=7, color=C_GRAY)

ax.axhline(0.4204, color=C_RED, linewidth=1.2, linestyle="--", label="Macro-F1 = 0.420")
ax.set_xticks(x)
ax.set_xticklabels(short_labels, fontsize=7.5)
ax.set_ylim(0, 1.15)
ax.yaxis.set_major_formatter(mticker.PercentFormatter(xmax=1, decimals=0))
ax.set_ylabel("Score")
ax.set_xlabel("Class")
ax.set_title(
    "Per-Class Precision / Recall / F1  --  PlantDoc Official Test Set\n"
    "MobileNetV3-Large v1  |  85 samples  |  3 model classes not in this test set",
    fontsize=10, pad=8
)
ax.legend(fontsize=8, framealpha=0.7)
plt.tight_layout()
out = EVAL / "per_class_metrics.png"
fig.savefig(out)
plt.close(fig)
print(f"  ok {out.relative_to(REPO)}")


# ===========================================================================
# 3. MODEL COMPARISON CHART  (unchanged)
# ===========================================================================
comparison = [
    ("v0  PlantVillage\nControlled test\n(99.46%)", 0.9946),
    ("v1  PlantVillage\nValidation\n(98.93%)",      0.9893),
    ("v1  PlantDoc\nDev-validation\n(45.45%)",      0.4545),
    ("v1  PlantDoc\nFinal test\n(43.53%)",           0.4353),
]
xs    = np.arange(len(comparison))
accs  = [c[1] for c in comparison]
colrs = [C_BLUE, C_TEAL, C_ORANGE, C_RED]

fig, ax = plt.subplots(figsize=(9, 5))
bars = ax.bar(xs, accs, color=colrs, width=0.55, alpha=0.9, edgecolor="white")
for bar, acc in zip(bars, accs):
    ax.text(bar.get_x()+bar.get_width()/2, bar.get_height()+0.016,
            f"{acc*100:.2f}%", ha="center", fontsize=10.5,
            fontweight="bold", color=C_DARK)

ax.set_xticks(xs)
ax.set_xticklabels([c[0] for c in comparison], fontsize=8.5)
ax.set_ylim(0, 1.15)
ax.yaxis.set_major_formatter(mticker.PercentFormatter(xmax=1, decimals=0))
ax.set_ylabel("Top-1 Accuracy")
ax.set_title(
    "Controlled vs Field Performance  --  KrushiCare MobileNetV3-Large\n"
    "Large domain gap between lab (PlantVillage) and real web/field images (PlantDoc) is expected",
    fontsize=10, pad=8
)
ax.axvline(1.5, color=C_GRAY, linewidth=1.3, linestyle="--", alpha=0.7)
ax.text(0.75, 1.065, "Controlled images", ha="center", fontsize=8.5,
        color=C_BLUE, transform=ax.get_xaxis_transform())
ax.text(2.5,  1.065, "Field / web images (PlantDoc)", ha="center", fontsize=8.5,
        color=C_RED, transform=ax.get_xaxis_transform())
fig.text(0.5, -0.03,
         "Sources: v0 controlled test (v0_clean_test_metrics.json) | "
         "v1 PlantVillage val (training log) | "
         "PlantDoc dev-val (threshold_validation_report.json) | "
         "PlantDoc test (final_plantdoc_test_metrics.json)",
         ha="center", fontsize=6.5, color=C_GRAY)
plt.tight_layout()
out = EVAL / "model_comparison.png"
fig.savefig(out)
plt.close(fig)
print(f"  ok {out.relative_to(REPO)}")


# ===========================================================================
# 4. CONFIDENCE-BUCKET TABLE  (unchanged)
# ===========================================================================
rows_tbl = [
    ("likely\n(prob >= 0.9999)",         6,  6/85*100, "5/6 = 83.3%",    "Only verdict with measured precision"),
    ("uncertain\n(0.45 <= p < 0.9999)", 70, 70/85*100, "--",              "App shows top-3 + KCC helpline"),
    ("unsupported\n(prob < 0.45)",        9,  9/85*100, "not evaluated",  "Non-leaf rejection not validated"),
]
col_labels = ["Verdict\n(threshold band)", "Count\n(n=85)", "Coverage",
              "Precision", "Action / note"]
cell_data  = [[r[0], str(r[1]), f"{r[2]:.1f}%", r[3], r[4]] for r in rows_tbl]
totals     = ["TOTAL", "85", "100.0%", "--", ""]

fig, ax = plt.subplots(figsize=(10, 3))
ax.axis("off")
tbl = ax.table(cellText=cell_data+[totals], colLabels=col_labels,
               cellLoc="center", loc="center")
tbl.auto_set_font_size(False)
tbl.set_fontsize(9)
tbl.scale(1, 2.1)
for j in range(len(col_labels)):
    tbl[0, j].set_facecolor(C_DARK)
    tbl[0, j].set_text_props(color="white", fontweight="bold")
for i, bg in enumerate(["#eafaf1", "#fef9e7", "#fdf2f8"]):
    for j in range(len(col_labels)):
        tbl[i+1, j].set_facecolor(bg)
for j in range(len(col_labels)):
    tbl[len(rows_tbl)+1, j].set_facecolor("#d5dbdb")
    tbl[len(rows_tbl)+1, j].set_text_props(fontweight="bold")
ax.set_title(
    "Confidence-Bucket Breakdown  --  PlantDoc Final Test (85 samples)\n"
    "MobileNetV3-Large v1  |  likely_medium = 0.9999  |  unknown_photo = 0.45",
    fontsize=9, pad=10
)
plt.tight_layout()
out = EVAL / "confidence_bucket_table.png"
fig.savefig(out)
plt.close(fig)
print(f"  ok {out.relative_to(REPO)}")


# ===========================================================================
# 5. RELIABILITY DIAGRAM  (post-calibration, PlantDoc dev-validation, 165 rows)
# ===========================================================================
# Source: final_v1_field_validation.csv
# Columns used: confidence (float), correct (True/False)
# Bins: 10 equal-width bins [0,0.1) ... [0.9,1.0]
# ECE formula: sum_b (|bin_b| / N) * |acc_b - conf_b|

confs   = np.array([float(r["confidence"]) for r in val_rows])
correct = np.array([r["correct"].strip() == "True" for r in val_rows], dtype=float)

N_BINS = 10
bin_edges = np.linspace(0.0, 1.0, N_BINS + 1)

bin_acc  = []   # mean accuracy in bin
bin_conf = []   # mean confidence in bin
bin_n    = []   # count in bin
bin_lo   = []   # left edge (for bar width)
bin_hi   = []   # right edge

for lo, hi in zip(bin_edges[:-1], bin_edges[1:]):
    mask = (confs >= lo) & (confs < hi)
    # last bin includes right edge
    if hi == 1.0:
        mask = (confs >= lo) & (confs <= hi)
    n = mask.sum()
    bin_n.append(n)
    bin_lo.append(lo)
    bin_hi.append(hi)
    if n > 0:
        bin_acc.append(correct[mask].mean())
        bin_conf.append(confs[mask].mean())
    else:
        bin_acc.append(np.nan)
        bin_conf.append(np.nan)

bin_acc  = np.array(bin_acc,  dtype=float)
bin_conf = np.array(bin_conf, dtype=float)
bin_n    = np.array(bin_n,    dtype=int)

# ECE (only non-empty bins)
mask_ne = bin_n > 0
N_total = len(val_rows)
ece     = float(np.sum(bin_n[mask_ne] / N_total * np.abs(bin_acc[mask_ne] - bin_conf[mask_ne])))

fig, ax = plt.subplots(figsize=(6, 6))

# Ideal line
ax.plot([0, 1], [0, 1], linestyle="--", color=C_GRAY, linewidth=1.3,
        label="Perfect calibration (y = x)", zorder=5)

# Reliability bars (gap from ideal)
bar_w = bin_edges[1] - bin_edges[0]
for lo, hi, acc, conf, n in zip(bin_lo, bin_hi, bin_acc, bin_conf, bin_n):
    if n == 0 or np.isnan(acc):
        continue
    mid = (lo + hi) / 2
    # bar to perfect
    ax.bar(mid, acc, width=bar_w*0.72, color=C_TEAL, alpha=0.75,
           edgecolor="white", linewidth=0.5, zorder=3)
    # gap shading
    ax.bar(mid, max(mid - acc, 0), width=bar_w*0.72, bottom=acc,
           color=C_RED, alpha=0.25, edgecolor="none", zorder=2,
           label="_nolegend_")
    ax.text(mid, acc + 0.025, f"n={n}", ha="center", fontsize=6.5, color=C_DARK)

# Empirical line connecting bin centres
valid = mask_ne & ~np.isnan(bin_acc)
mids  = (bin_edges[:-1] + bin_edges[1:]) / 2
ax.plot(bin_conf[valid], bin_acc[valid], "o-", color=C_BLUE, linewidth=1.8,
        markersize=5, zorder=6, label="Empirical (post-calibration)")

ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.set_xlabel("Mean confidence (top-1 softmax probability)", labelpad=6)
ax.set_ylabel("Fraction correct", labelpad=6)
ax.set_title(
    "Reliability Diagram — Calibrated v1 — PlantDoc Development Validation\n"
    f"165 samples | 10 confidence bins | ECE = {ece:.4f}",
    fontsize=9, pad=10
)
ax.legend(fontsize=8, loc="upper left", framealpha=0.85)
ax.set_aspect("equal")

# ECE annotation box
ax.text(0.97, 0.05,
        f"ECE = {ece:.4f}\n"
        f"ECE = \u03a3 (|bin|/N)\u00d7|acc\u2212conf|\n"
        f"N = 165 | bins = {N_BINS}",
        transform=ax.transAxes,
        ha="right", va="bottom", fontsize=7.5,
        bbox=dict(boxstyle="round,pad=0.4", facecolor="white", edgecolor=C_GRAY, alpha=0.9))

fig.text(0.5, -0.02,
         "Source: ml/evaluation/final_v1_field_validation.csv | "
         "POST-calibration only (T = 0.4026) | No uncalibrated curve — raw logits not stored",
         ha="center", fontsize=6.5, color=C_GRAY)
plt.tight_layout()
out = EVAL / "reliability_diagram.png"
fig.savefig(out)
plt.close(fig)
print(f"  ok {out.relative_to(REPO)}")

# Print ECE summary for documentation
print()
print(f"  ECE (post-calibration, PlantDoc dev-val, {N_BINS} bins): {ece:.4f}")
print(f"  Non-empty bins: {mask_ne.sum()} / {N_BINS}")
for lo, hi, acc, conf, n in zip(bin_lo, bin_hi, bin_acc, bin_conf, bin_n):
    if n == 0 or np.isnan(acc):
        continue
    print(f"    [{lo:.1f},{hi:.1f}) n={n:3d}  mean_conf={conf:.3f}  acc={acc:.3f}  gap={abs(acc-conf):.3f}")

print()
print("Done. All charts written to ml/evaluation/")
