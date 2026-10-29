// STUB predict.ts (owner: Vedant). Right signature, no model yet.
//
// Real version: load ml/models/model_int8.onnx with onnxruntime-web, preprocess
// exactly as model_meta.json says (RGB, bilinear resize to 224, mean/std, CHW),
// and return the same object as predict.py. Must pass the parity test.
//
// While this stub throws, the app simply keeps offline photos in the queue.

export interface Prediction {
  model_version: string;
  top3: { label: string; prob: number }[];
  margin: number;
}

export class ModelUnavailableError extends Error {}

export async function predict(_file: Blob): Promise<Prediction> {
  throw new ModelUnavailableError('on-device model not added yet');
}
