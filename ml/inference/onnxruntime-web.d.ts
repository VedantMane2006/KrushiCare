declare module 'onnxruntime-web' {
  export interface InferenceSession {
    run(feeds: Record<string, any>): Promise<Record<string, { data: Float32Array | number[] }>>;
  }

  export namespace InferenceSession {
    export function create(
      uriOrBuffer: string | ArrayBuffer | Uint8Array,
      options?: { executionProviders?: string[] }
    ): Promise<InferenceSession>;
  }

  export class Tensor {
    constructor(type: string, data: Float32Array, dims: number[]);
    data: Float32Array | number[];
    dims: number[];
    type: string;
  }
}

