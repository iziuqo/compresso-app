export type Format = 'auto' | 'webp' | 'avif' | 'jpeg' | 'png';

export type Params = {
  quality: number;
  format: Format;
  maxWidth: number | null;
  maxHeight: number | null;
  maxSizeMB: number | null;
};

export const DEFAULT_PARAMS: Params = {
  quality: 0.8,
  format: 'auto',
  maxWidth: null,
  maxHeight: null,
  maxSizeMB: null,
};

export type Caps = { avif: boolean; webp: boolean };

export type CompressOutput = {
  blob: Blob;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  originalSize: number;
  compressedSize: number;
  savings: number;
  format: string;
  mimeType: string;
};

export type WorkerRequest =
  | { type: 'run'; id: string; file: File; params: Params; caps: Caps }
  | { type: 'abort'; id: string };

export type WorkerResponse =
  | { type: 'progress'; id: string; progress: number }
  | { type: 'done'; id: string; result: CompressOutput }
  | { type: 'error'; id: string; message: string; kind: 'decode' | 'generic' };
