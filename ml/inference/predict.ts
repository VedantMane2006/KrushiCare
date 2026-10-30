/// <reference path="./onnxruntime-web.d.ts" />
/**
 * AgriSense On-Device Inference Runtime (owner: Vedant, for Saad).
 * Usage:
 *   1. Call `await loadModel('/models/model.onnx', '/models/model_meta.json')` during app startup or PWA cache warmup.
 *   2. Call `const result = await predict(imageBlob)` on any captured leaf photo (Blob or File).
 *   3. Result shape: `{ model_version: string, top3: Array<{ label: string, prob: number }>, margin: number }`.
 *   4. Preprocessing matches Python Pillow pipeline: EXIF transpose, RGB, 224x224 resize, ImageNet normalization, NCHW.
 *   5. Seamlessly switches from `model.onnx` to `model_int8.onnx` when delivered at H9 without changing calling code.
 */

export interface PredictionItem {
  label: string;
  prob: number;
}

export interface Prediction {
  model_version: string;
  top3: PredictionItem[];
  margin: number;
}

export interface ModelInputMeta {
  name?: string;
  shape?: number[];
  resize?: string;
  color?: string;
  mean?: number[];
  std?: number[];
}

export interface ModelOutputMeta {
  name?: string;
  shape?: number[];
  calibrated?: boolean;
  temperature?: number;
}

export interface ModelMetadata {
  model_version: string;
  arch?: string;
  opset?: number;
  labels: string[];
  input?: ModelInputMeta;
  output?: ModelOutputMeta;
}

export interface OrtTensor {
  data: Float32Array | number[];
  dims: number[];
  type: string;
}

export interface OrtInferenceSession {
  run(feeds: Record<string, any>): Promise<Record<string, { data: Float32Array | number[] }>>;
}

export interface OrtModule {
  InferenceSession: {
    create(
      uriOrBuffer: string | ArrayBuffer | Uint8Array,
      options?: { executionProviders?: string[] }
    ): Promise<OrtInferenceSession>;
  };
  Tensor: new (type: string, data: Float32Array, dims: number[]) => any;
}

export class ModelUnavailableError extends Error {
  constructor(message: string = 'on-device model not added yet') {
    super(message);
    this.name = 'ModelUnavailableError';
  }
}

// Module-level inference state
let _session: OrtInferenceSession | null = null;
let _meta: ModelMetadata | null = null;
let _labels: string[] = [];
let _modelVersion: string = 'unknown';
let _inputName: string = 'input';
let _outputName: string = 'probs';
let _customOrt: OrtModule | null = null;

/**
 * Configure a custom or mocked ONNX runtime module (useful for testing or specific bundles).
 */
export function setOrtModule(ort: OrtModule | null): void {
  _customOrt = ort;
}

/**
 * Reset loaded model state (useful for test isolation).
 */
export function resetModel(): void {
  _session = null;
  _meta = null;
  _labels = [];
  _modelVersion = 'unknown';
  _inputName = 'input';
  _outputName = 'probs';
  _customOrt = null;
}

/**
 * Manually set session and metadata without network fetching (useful for testing or preloaded buffers).
 */
export function setLoadedSession(session: OrtInferenceSession, meta: ModelMetadata): void {
  if (!meta || !meta.labels || !Array.isArray(meta.labels) || meta.labels.length === 0) {
    throw new Error('Invalid metadata: labels array missing or empty');
  }
  _session = session;
  _meta = meta;
  _labels = [...meta.labels];
  _modelVersion = meta.model_version ?? 'unknown';
  _inputName = meta.input?.name ?? 'input';
  _outputName = meta.output?.name ?? 'probs';
}

/**
 * Resolve onnxruntime-web instance from injected module, window/global, or dynamic import.
 */
export async function getOrt(): Promise<OrtModule> {
  if (_customOrt) {
    return _customOrt;
  }
  const globalOrt = (globalThis as any).ort;
  if (globalOrt && globalOrt.InferenceSession && globalOrt.Tensor) {
    return globalOrt as OrtModule;
  }
  try {
    const pkgName = 'onnxruntime-web';
    const mod = await import(/* @vite-ignore */ pkgName);
    if (mod && (mod.InferenceSession || mod.default?.InferenceSession)) {
      return (mod.default ?? mod) as OrtModule;
    }
  } catch {
    // onnxruntime-web package not installed or cannot be dynamically imported
  }
  throw new ModelUnavailableError(
    'onnxruntime-web is not available. Please ensure onnxruntime-web is loaded or installed.'
  );
}

/**
 * Load ONNX model and metadata dynamically via URLs using WASM execution provider.
 * Label order and model version are read dynamically from metadata.
 */
export async function loadModel(url: string, metaUrl: string): Promise<void> {
  let meta: ModelMetadata;
  try {
    const metaRes = await fetch(metaUrl);
    if (!metaRes.ok) {
      throw new Error(`HTTP ${metaRes.status} ${metaRes.statusText}`);
    }
    meta = (await metaRes.json()) as ModelMetadata;
  } catch (err) {
    throw new ModelUnavailableError(`Failed to load model metadata from ${metaUrl}: ${(err as Error).message}`);
  }

  if (!meta || !meta.labels || !Array.isArray(meta.labels) || meta.labels.length === 0) {
    throw new ModelUnavailableError('Invalid model metadata: labels array is missing or empty');
  }

  const ort = await getOrt();
  let session: OrtInferenceSession;
  try {
    session = await ort.InferenceSession.create(url, {
      executionProviders: ['wasm'],
    });
  } catch (err) {
    throw new ModelUnavailableError(`Failed to create ONNX session for ${url}: ${(err as Error).message}`);
  }

  setLoadedSession(session, meta);
}

/**
 * Preprocess ImageData into NCHW Float32Array matching Python preprocessing:
 * 1. Division by 255.0 to scale to [0, 1]
 * 2. ImageNet mean/std normalization: (channel - mean) / std
 * 3. HWC to CHW reordering: length 3 * 224 * 224 = 150528
 */
export function preprocessImageData(
  imageData: ImageData,
  meta?: ModelMetadata | null
): Float32Array {
  const width = imageData.width;
  const height = imageData.height;
  const totalPixels = width * height;
  if (totalPixels !== 224 * 224) {
    throw new Error(`Expected 224x224 ImageData, got ${width}x${height}`);
  }

  const data = imageData.data;
  const mean = meta?.input?.mean ?? [0.485, 0.456, 0.406];
  const std = meta?.input?.std ?? [0.229, 0.224, 0.225];

  const floatArray = new Float32Array(3 * totalPixels);
  const rOffset = 0;
  const gOffset = totalPixels;
  const bOffset = 2 * totalPixels;

  for (let i = 0, p = 0; p < totalPixels; i += 4, p++) {
    const r = data[i] / 255.0;
    const g = data[i + 1] / 255.0;
    const b = data[i + 2] / 255.0;

    floatArray[rOffset + p] = (r - mean[0]) / std[0];
    floatArray[gOffset + p] = (g - mean[1]) / std[1];
    floatArray[bOffset + p] = (b - mean[2]) / std[2];
  }

  return floatArray;
}

/**
 * Format raw output probabilities into agreed Prediction contract:
 * - Output probabilities are already temperature-calibrated (no softmax applied)
 * - Top-3 labels sorted in descending probability order
 * - Probabilities and margin rounded to 4 decimals
 */
export function formatPredictions(
  probs: Float32Array | number[],
  labels: string[],
  modelVersion: string
): Prediction {
  if (labels.length === 0) {
    return {
      model_version: modelVersion,
      top3: [],
      margin: 0.0,
    };
  }

  const indexed: Array<{ index: number; prob: number }> = [];
  for (let i = 0; i < labels.length; i++) {
    indexed.push({ index: i, prob: probs[i] ?? 0.0 });
  }

  indexed.sort((a, b) => b.prob - a.prob);

  const topK = indexed.slice(0, 3);
  const top3: PredictionItem[] = topK.map((item) => ({
    label: labels[item.index] ?? `label_${item.index}`,
    prob: Math.round(item.prob * 10000) / 10000,
  }));

  let margin = 0.0;
  if (top3.length >= 2) {
    margin = Math.round((top3[0].prob - top3[1].prob) * 10000) / 10000;
  } else if (top3.length === 1) {
    margin = top3[0].prob;
  }

  return {
    model_version: modelVersion,
    top3,
    margin,
  };
}

/**
 * Decode an image Blob with EXIF orientation and resize directly to 224x224.
 */
export async function decodeAndResize(file: Blob): Promise<ImageData> {
  if (!file || typeof file.size !== 'number' || file.size === 0) {
    throw new Error('Invalid image input: file must be a non-empty Blob or File');
  }

  // 1. Decode with EXIF orientation
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch (err) {
    throw new Error(`Failed to decode image: ${(err as Error).message}`);
  }

  try {
    // 2. Draw onto 224x224 canvas with high smoothing quality
    let canvas: OffscreenCanvas | HTMLCanvasElement;
    if (typeof OffscreenCanvas !== 'undefined') {
      canvas = new OffscreenCanvas(224, 224);
    } else if (typeof document !== 'undefined' && document.createElement) {
      canvas = document.createElement('canvas');
      canvas.width = 224;
      canvas.height = 224;
    } else {
      throw new Error('Canvas rendering context not available');
    }

    const ctx = canvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;

    if (!ctx) {
      throw new Error('Failed to get 2D canvas context');
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, 224, 224);

    return ctx.getImageData(0, 0, 224, 224);
  } finally {
    if (bmp && typeof (bmp as any).close === 'function') {
      (bmp as any).close();
    }
  }
}

/**
 * Execute on-device prediction on an image Blob:
 * - Throws ModelUnavailableError if loadModel() was not called or failed
 * - Decodes and normalizes image according to model metadata
 * - Runs ONNX WASM session
 * - Returns top3 predictions and margin rounded to 4 decimals
 */
export async function predict(file: Blob): Promise<Prediction> {
  if (!_session || !_meta) {
    throw new ModelUnavailableError('on-device model not added yet');
  }

  const imageData = await decodeAndResize(file);
  const float32 = preprocessImageData(imageData, _meta);

  const ort = await getOrt();
  const tensor = new ort.Tensor('float32', float32, [1, 3, 224, 224]);
  const feeds: Record<string, any> = { [_inputName]: tensor };

  let results: Record<string, { data: Float32Array | number[] }>;
  try {
    results = await _session.run(feeds);
  } catch (err) {
    throw new Error(`ONNX inference failed: ${(err as Error).message}`);
  }

  const outputTensor = results[_outputName] ?? Object.values(results)[0];
  if (!outputTensor || !outputTensor.data) {
    throw new Error(`Inference output missing or invalid for output "${_outputName}"`);
  }

  return formatPredictions(outputTensor.data, _labels, _modelVersion);
}
