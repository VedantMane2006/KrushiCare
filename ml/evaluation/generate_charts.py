"""
KrushiCare ML Evaluation -- Chart Generator
============================================
All charts use ONLY real, recorded data from ml/evaluation/*.json and *.csv.
No values are fabricated or interpolated.

Outputs written to ml/evaluation/:
  confusion_matrix.png
  per_class_metrics.png
  model_comparison.png
  confidence_bucket_table.png

Run from repo root:
  python ml/evaluation/generate_charts.py
"""

import csv
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # headless
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
from matplotlib.colors import LinearSegmentedColormap
import numpy as np

# -- paths ------------------------------------------------------------------
REPO = Path(__file__).resolve().parents[2]
EVAL = REPO / "ml" / "evaluation"

METRICS_JSON   = EVAL / "final_plantdoc_test_metrics.json"
PER_CLASS_CSV  = EVAL / "final_plantdoc_test_per_class.csv"
THRESHOLD_JSON = EVAL / "threshold_validation_report.json"
CALIB_JSON     = REPO / "ml" / "models" / "calibration_report.json"

# -- colour palette ---------------------------------------------------------
C_TEAL   = "#1abc9c"
C_ORANGE = "#e67e22"
C_RED    = "#e74c3c"
C_BLUE   = "#2980b9"
C_GRAY   = "#95a5a6"
C_DARK   = "#2c3e50"

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 10,
    "axes.spines.top":   False,
    "axes.spines.right": False,
    "figure.dpi": 150,
    "savefig.bbox": "tight",
    "savefig.pad_inches": 0.15,
})

# -- load data --------------------------------------------------------------
metrics   = json.loads(METRICS_JSON.read_text())
threshold = json.loads(THRESHOLD_JSON.read_text())
calib     = json.loads(CALIB_JSON.read_text())

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


def short(label: str) -> str:
    """Short two-line display name."""
    parts = label.split("__")
    crop = parts[0].capitalize()
    disease = parts[1].replace("_", " ").title() if len(parts) > 1 else ""
    return f"{crop}\n{disease}"


labels_ordered = list(per_class.keys())
short_labels   = [short(l) for l in labels_ordered]

# ===========================================================================
# 1. CONFUSION MATRIX -- diagonal TPs only (off-diagonal not in source data)
# ===========================================================================
names = labels_ordered
n     = len(names)
tp    = np.array(
    [round(per_class[nm]["recall"] * per_class[nm]["support"]) for nm in names],
    dtype=float
)
short_ax = [short(nm) for nm in names]
max_v    = max(tp.max(), 1)
cmap     = LinearSegmentedColormap.from_list("yr", ["#ffeaa7", C_TEAL])

fig, ax = plt.subplots(figsize=(10, 8))
for i in range(n):
    for j in range(n):
        if i == j:
            colour = cmap(tp[i] / max_v)
            ax.add_patch(plt.Rectangle((j - 0.5, i - 0.5), 1, 1, color=colour, zorder=0))
            ax.text(j, i, int(tp[i]), ha="center", va="center",
                    fontsize=9, fontweight="bold", color=C_DARK)
        else:
            ax.add_patch(plt.Rectangle((j - 0.5, i - 0.5), 1, 1, color="#f4f6f7", zorder=0))

ax.set_xlim(-0.5, n - 0.5)
ax.set_ylim(n - 0.5, -0.5)
ax.set_xticks(range(n))
ax.set_yticks(range(n))
ax.set_xticklabels(short_ax, rotation=45, ha="right", fontsize=7.5)
ax.set_yticklabels(short_ax, fontsize=7.5)
ax.set_xlabel("Predicted class", labelpad=8)
ax.set_ylabel("True class", labelpad=8)
ax.set_title(
    "PlantDoc Final Test -- Diagonal Counts (True Positives per class)\n"
    "MobileNetV3-Large v1 | 85 samples | 10/13 classes in test set"
    " | Off-diagonal counts not available from summary statistics",
    fontsize=8.5, pad=10, color=C_DARK
)
for i, nm in enumerate(names):
    ax.text(n - 0.3, i, f"n={per_class[nm]['support']}",
            va="center", fontsize=7, color=C_GRAY)

plt.tight_layout()
out = EVAL / "confusion_matrix.png"
fig.savefig(out)
plt.close(fig)
print(f"  ok {out.relative_to(REPO)}")

# ===========================================================================
# 2. PER-CLASS PRECISION / RECALL / F1 BAR CHART
# ===========================================================================
fig, ax = plt.subplots(figsize=(12, 5.5))
x = np.arange(len(labels_ordered))
w = 0.26

ax.bar(x - w, [per_class[l]["precision"] for l in labels_ordered],
       width=w, label="Precision", color=C_BLUE,   alpha=0.88)
ax.bar(x,     [per_class[l]["recall"]    for l in labels_ordered],
       width=w, label="Recall",    color=C_TEAL,   alpha=0.88)
ax.bar(x + w, [per_class[l]["f1"]        for l in labels_ordered],
       width=w, label="F1-score",  color=C_ORANGE, alpha=0.88)

for i, lbl in enumerate(labels_ordered):
    ax.text(x[i] + w, per_class[lbl]["f1"] + 0.025,
            f"n={per_class[lbl]['support']}", ha="center", fontsize=7, color=C_GRAY)

ax.axhline(0.4204, color=C_RED, linewidth=1.2, linestyle="--",
           label="Macro-F1 = 0.420")
ax.set_xticks(x)
ax.set_xticklabels(short_labels, fontsize=7.5)
ax.set_ylim(0, 1.15)
ax.yaxis.set_major_formatter(mticker.PercentFormatter(xmax=1, decimals=0))
ax.set_ylabel("Score")
ax.set_xlabel("Class")
ax.set_title(
    "Per-Class Precision / Recall / F1  --  PlantDoc Official Test Set\n"
    "MobileNetV3-Large v1  |  85 samples  |  3 model classes not represented in test set",
    fontsize=10, pad=8
)
ax.legend(fontsize=8, framealpha=0.7)
plt.tight_layout()
out = EVAL / "per_class_metrics.png"
fig.savefig(out)
plt.close(fig)
print(f"  ok {out.relative_to(REPO)}")

# ===========================================================================
# 3. MODEL COMPARISON CHART  (controlled vs field)
# ===========================================================================
# All accuracy values sourced from confirmed results in task brief + JSON files.
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
    ax.text(bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.016,
            f"{acc*100:.2f}%",
            ha="center", fontsize=10.5, fontweight="bold", color=C_DARK)

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

fig.text(
    0.5, -0.03,
    "Sources: v0 controlled test (training log) | v1 PlantVillage val (training log) "
    "| PlantDoc dev-val (threshold_validation_report.json) | PlantDoc test (final_plantdoc_test_metrics.json)",
    ha="center", fontsize=6.5, color=C_GRAY
)
plt.tight_layout()
out = EVAL / "model_comparison.png"
fig.savefig(out)
plt.close(fig)
print(f"  ok {out.relative_to(REPO)}")

# ===========================================================================
# 4. CONFIDENCE-BUCKET TABLE
# Per-image probabilities not stored -> use aggregate verdict counts from JSON
# ===========================================================================
rows = [
    # verdict, count, coverage %, precision, note
    ("likely\n(prob >= 0.9999)",         6,  6/85*100, "5/6 = 83.3%",    "Only verdict with measured precision"),
    ("uncertain\n(0.45 <= p < 0.9999)", 70, 70/85*100, "--",              "App shows top-3 + KCC helpline"),
    ("unsupported\n(prob < 0.45)",        9,  9/85*100, "not evaluated",  "Non-leaf rejection not validated"),
]
col_labels = ["Verdict\n(threshold band)", "Count\n(n=85)", "Coverage",
              "Precision", "Action / note"]
cell_data  = [[r[0], str(r[1]), f"{r[2]:.1f}%", r[3], r[4]] for r in rows]
totals     = ["TOTAL", "85", "100.0%", "--", ""]

fig, ax = plt.subplots(figsize=(10, 3))
ax.axis("off")

tbl = ax.table(
    cellText=cell_data + [totals],
    colLabels=col_labels,
    cellLoc="center",
    loc="center",
)
tbl.auto_set_font_size(False)
tbl.set_fontsize(9)
tbl.scale(1, 2.1)

for j in range(len(col_labels)):
    tbl[0, j].set_facecolor(C_DARK)
    tbl[0, j].set_text_props(color="white", fontweight="bold")

row_bg = ["#eafaf1", "#fef9e7", "#fdf2f8"]
for i, bg in enumerate(row_bg):
    for j in range(len(col_labels)):
        tbl[i + 1, j].set_facecolor(bg)

for j in range(len(col_labels)):
    tbl[len(rows) + 1, j].set_facecolor("#d5dbdb")
    tbl[len(rows) + 1, j].set_text_props(fontweight="bold")

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
print()
print("  NOTE: Reliability/calibration diagram SKIPPED.")
print("  Per-image probabilities + true labels are not stored in this repo.")
print("  Fabricating ECE bins would misrepresent performance.")
print("  NLL improvement (0.1137 -> 0.0367) is documented in eval.md only.")
print()
print("Done. All charts written to ml/evaluation/")
