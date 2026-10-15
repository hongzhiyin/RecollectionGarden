export const MAX_FILE_BYTES = 32 * 1024 * 1024;
export const MAX_PAGES = 2_000;

export interface Asset {
  hash: string;
  file: Blob;
  size: number;
  pages: number;
  thumbnail: string;
  createdAt: number;
}

export interface Book {
  id: string;
  assetHash: string;
  title: string;
  fileName: string;
  createdAt: number;
  updatedAt: number;
}

export interface Progress {
  bookId: string;
  page: number;
  status: 'reading' | 'finished';
  lastReadAt: number;
  offsetX?: number;
  offsetY?: number;
  zoom?: ReaderZoom;
}

export type ReaderZoom = { mode: 'fit-width' } | { mode: 'percent'; percent: number };
export interface ReaderLocation {
  page: number;
  zoom: ReaderZoom;
  offsetX: number;
  offsetY: number;
}

export interface BookView extends Book {
  available: boolean;
  pages: number;
  size: number;
  thumbnail: string;
  progress?: Progress;
}

export interface ImportCandidate {
  asset: Asset;
  fileName: string;
  duplicates: Book[];
}

export type ImportChoice = { type: 'create' } | { type: 'open'; bookId: string };
export type ImportStage = 'checking' | 'hashing' | 'inspecting' | 'saving';

export function assertActive(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('操作已取消', 'AbortError');
}
