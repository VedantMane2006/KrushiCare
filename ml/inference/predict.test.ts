import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatPredictions,
  loadModel,
  ModelMetadata,
  ModelUnavailableError,
  OrtInferenceSession,
  OrtModule,
  predict,
  preprocessImageData,
  resetModel,
  setLoadedSession,
  setOrtModule,
} from './predict';

describe('ml/inference/predict.ts: browser-side inference runtime', () => {
  beforeEach(() => {
    resetModel();
    vi.restoreAllMocks();
  });

  describe('Error handling before model is loaded', () => {
    it('throws ModelUnavailableError if predict() is called before loadModel()', async () => {
      const dummyBlob = new Blob(['fake image bytes'], { type: 'image/jpeg' });
      await expect(predict(dummyBlob)).rejects.toThrow(ModelUnavailableError);
    });
  });

  describe('formatPredictions()', () => {
    const labels = [
      'tomato__bacterial_spot',
      'tomato__early_blight',
      'tomato__late_blight',
      'tomato__leaf_mold',
      'tomato__septoria_leaf_spot',
      'tomato__spider_mites',
      'tomato__target_spot',
      'tomato__yellow_leaf_curl_virus',
      'tomato__mosaic_virus',
      'tomato__healthy',
      'potato__early_blight',
      'potato__late_blight',
      'potato__healthy',
    ];

    it('sorts top-3 probabilities descending and rounds to 4 decimals', () => {
      const probs = new Float32Array(13);
      probs[2] = 0.812345; // tomato__late_blight
      probs[1] = 0.123456; // tomato__early_blight
      probs[10] = 0.054321; // potato__early_blight

      const result = formatPredictions(probs, labels, 'v1');

      expect(result.model_version).toBe('v1');
      expect(result.top3).toHaveLength(3);
      expect(result.top3[0]).toEqual({ label: 'tomato__late_blight', prob: 0.8123 });
      expect(result.top3[1]).toEqual({ label: 'tomato__early_blight', prob: 0.1235 });
      expect(result.top3[2]).toEqual({ label: 'potato__early_blight', prob: 0.0543 });

      // margin = top1.prob - top2.prob = 0.8123 - 0.1235 = 0.6888
      expect(result.margin).toBe(0.6888);
    });

    it('does not reapply softmax (preserves raw calibrated probabilities)', () => {
      // Temperature-calibrated probabilities summing to 1.0
      const probs = [0.01, 0.02, 0.70, 0.05, 0.02, 0.01, 0.01, 0.01, 0.01, 0.01, 0.10, 0.03, 0.02];
      const result = formatPredictions(probs, labels, 'v1');

      expect(result.top3[0].label).toBe('tomato__late_blight');
      expect(result.top3[0].prob).toBe(0.7);
      expect(result.top3[1].label).toBe('potato__early_blight');
      expect(result.top3[1].prob).toBe(0.1);
      expect(result.margin).toBe(0.6);
    });

    it('handles empty label list gracefully', () => {
      const result = formatPredictions([], [], 'v1');
      expect(result.model_version).toBe('v1');
      expect(result.top3).toEqual([]);
      expect(result.margin).toBe(0.0);
    });

    it('handles single-label output', () => {
      const result = formatPredictions([0.95], ['single_label'], 'v1');
      expect(result.top3).toEqual([{ label: 'single_label', prob: 0.95 }]);
      expect(result.margin).toBe(0.95);
    });
  });

  describe('preprocessImageData()', () => {
    it('produces CHW Float32Array of length 3 * 224 * 224 with ImageNet normalization', () => {
      const totalPixels = 224 * 224;
      const data = new Uint8ClampedArray(totalPixels * 4);

      // Fill with known RGBA values: R=255, G=128, B=0, A=255
      for (let i = 0; i < totalPixels * 4; i += 4) {
        data[i] = 255;
        data[i + 1] = 128;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }

      const mockImageData = {
        data,
        width: 224,
        height: 224,
        colorSpace: 'srgb',
      } as ImageData;

      const meta: ModelMetadata = {
        model_version: 'v1',
        labels: ['dummy'],
        input: {
          mean: [0.485, 0.456, 0.406],
          std: [0.229, 0.224, 0.225],
        },
      };

      const tensorData = preprocessImageData(mockImageData, meta);

      expect(tensorData).toBeInstanceOf(Float32Array);
      expect(tensorData.length).toBe(3 * 224 * 224);

      // Check Red channel (index 0): (255 / 255 - 0.485) / 0.229 = (1 - 0.485) / 0.229 = 2.2489
      const expectedR = (1.0 - 0.485) / 0.229;
      expect(tensorData[0]).toBeCloseTo(expectedR, 4);

      // Check Green channel (index totalPixels): (128 / 255 - 0.456) / 0.224
      const expectedG = (128 / 255.0 - 0.456) / 0.224;
      expect(tensorData[totalPixels]).toBeCloseTo(expectedG, 4);

      // Check Blue channel (index 2 * totalPixels): (0 / 255 - 0.406) / 0.225
      const expectedB = (0.0 - 0.406) / 0.225;
      expect(tensorData[2 * totalPixels]).toBeCloseTo(expectedB, 4);
    });

    it('throws error when ImageData is not 224x224', () => {
      const invalidData = {
        data: new Uint8ClampedArray(100 * 100 * 4),
        width: 100,
        height: 100,
      } as ImageData;

      expect(() => preprocessImageData(invalidData)).toThrow('Expected 224x224');
    });
  });

  describe('loadModel() and metadata loading', () => {
    it('dynamically reads labels, model_version, and passes wasm provider to ORT', async () => {
      const mockMeta: ModelMetadata = {
        model_version: 'v1-test',
        labels: ['label_a', 'label_b', 'label_c'],
        input: { name: 'in_node', shape: [1, 3, 224, 224] },
        output: { name: 'out_node', shape: [1, 3] },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockMeta,
      } as Response);

      const mockSession: OrtInferenceSession = {
        run: vi.fn(),
      };

      const createSessionSpy = vi.fn().mockResolvedValue(mockSession);
      const mockOrt: OrtModule = {
        InferenceSession: {
          create: createSessionSpy,
        },
        Tensor: class {
          constructor(public type: string, public data: Float32Array, public dims: number[]) {}
        } as any,
      };

      setOrtModule(mockOrt);

      await loadModel('/models/model.onnx', '/models/model_meta.json');

      expect(globalThis.fetch).toHaveBeenCalledWith('/models/model_meta.json');
      expect(createSessionSpy).toHaveBeenCalledWith('/models/model.onnx', {
        executionProviders: ['wasm'],
      });
    });

    it('throws ModelUnavailableError if metadata fetch fails', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await expect(loadModel('/bad.onnx', '/bad_meta.json')).rejects.toThrow(ModelUnavailableError);
    });

    it('throws ModelUnavailableError if metadata has invalid labels', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ model_version: 'v1', labels: [] }),
      } as Response);

      await expect(loadModel('/model.onnx', '/meta.json')).rejects.toThrow(
        /labels array is missing or empty/
      );
    });
  });

  describe('predict() validation & inference flow', () => {
    it('throws error for invalid image inputs', async () => {
      const mockSession: OrtInferenceSession = { run: vi.fn() };
      const mockMeta: ModelMetadata = {
        model_version: 'v1',
        labels: ['tomato__healthy', 'tomato__early_blight'],
      };
      setLoadedSession(mockSession, mockMeta);

      await expect(predict(null as any)).rejects.toThrow('Invalid image input');
      await expect(predict(new Blob([], { type: 'image/jpeg' }))).rejects.toThrow('Invalid image input');
    });

    it('runs session inference with prepared tensor feeds and returns top3', async () => {
      const mockProbs = new Float32Array([0.92, 0.08]);
      const mockSession: OrtInferenceSession = {
        run: vi.fn().mockResolvedValue({
          probs: { data: mockProbs },
        }),
      };
      const mockMeta: ModelMetadata = {
        model_version: 'v1-onnx',
        labels: ['tomato__healthy', 'tomato__early_blight'],
        input: { name: 'input' },
        output: { name: 'probs' },
      };
      setLoadedSession(mockSession, mockMeta);

      const mockOrt: OrtModule = {
        InferenceSession: { create: vi.fn() },
        Tensor: class {
          constructor(public type: string, public data: Float32Array, public dims: number[]) {}
        } as any,
      };
      setOrtModule(mockOrt);

      // Mock createImageBitmap and OffscreenCanvas in Node environment for end-to-end test
      const dummyImageData = {
        width: 224,
        height: 224,
        data: new Uint8ClampedArray(224 * 224 * 4),
      };

      (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue({
        width: 500,
        height: 500,
        close: vi.fn(),
      });

      (globalThis as any).OffscreenCanvas = class {
        constructor(public width: number, public height: number) {}
        getContext() {
          return {
            imageSmoothingEnabled: false,
            imageSmoothingQuality: 'high',
            drawImage: vi.fn(),
            getImageData: () => dummyImageData,
          };
        }
      };

      const testBlob = new Blob(['mock-leaf-data'], { type: 'image/jpeg' });
      const result = await predict(testBlob);

      expect(mockSession.run).toHaveBeenCalledTimes(1);
      expect(result.model_version).toBe('v1-onnx');
      expect(result.top3[0]).toEqual({ label: 'tomato__healthy', prob: 0.92 });
      expect(result.top3[1]).toEqual({ label: 'tomato__early_blight', prob: 0.08 });
      expect(result.margin).toBe(0.84);
    });
  });
});

