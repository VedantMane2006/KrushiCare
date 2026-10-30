KRUSHICARE - KRISHA ML HANDOFF

MODEL
MobileNetV3-Large, 13 tomato/potato disease classes.
Version: v1 clean field-fine-tuned.
ONNX opset: 17.
Input: float32 [1,3,224,224].
Output: probabilities [1,13].

PREPROCESSING
RGB, bilinear resize to 224 x 224.
Scale to [0,1] and normalize with ImageNet mean/std.
Channel-first CHW input.

IMPORTANT
ONNX output is already softmax-normalized and contains
temperature scaling. Do not apply softmax again.

USE THE EXACT ORDER IN ml/models/labels.json.

PARITY
Use ml/parity/p1.png ... p5.png and expected.json.
Compare ONNX inference probabilities using the agreed
input preprocessing. Maximum checked PyTorch/ONNX
difference on export: 1.1920928955078125e-07.

THRESHOLDS
Read ml/models/thresholds.json.
Use the existing backend/services/verdict.py contract.
Threshold selection was exploratory on cleaned PlantDoc
development validation, not independently validated.

LIMITATIONS
The model was trained largely on PlantVillage-derived
images. Field validation showed a significant domain gap.
Temperature was fitted on laboratory validation images
and is not verified for field calibration.
The reserved PlantDoc test report is included.
Non-leaf/unknown-photo rejection has not been validated.
For uncertain cases, request human confirmation or
agronomist review. This is not a verified medical or
agronomic diagnostic device.

OWNERSHIP
Krisha: training, evaluation, ONNX, thresholds,
weather/soil context.
Vedant: Python/TypeScript inference and content.
Saad: backend/frontend integration.

IMPORTANT
The application implementation must still be tested
end to end with the exported model.
