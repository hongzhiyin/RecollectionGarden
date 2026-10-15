import { assertActive, MAX_FILE_BYTES, type ImportCandidate, type ImportStage } from '../library/model';
import { LibraryError } from '../library/errors';
import { library } from '../library/repository';
import { hashFile } from './hash';

export async function prepareImport(file: File, signal: AbortSignal,
  onStage: (stage: ImportStage) => void): Promise<ImportCandidate> {
  onStage('checking');
  assertActive(signal);
  if (!file.size) throw new LibraryError('EMPTY_FILE', '文件为空，请选择 PDF 文件。');
  if (file.size > MAX_FILE_BYTES) throw new LibraryError('SIZE_LIMIT', '此版本支持不超过 32 MiB 的 PDF。');
  onStage('hashing');
  const hash = await hashFile(file, signal);
  const existing = await library.lookup(hash);
  assertActive(signal);
  if (existing.asset) return { asset: existing.asset, fileName: file.name, duplicates: existing.books };
  onStage('inspecting');
  const { inspectPdf } = await import('../pdf/adapter');
  assertActive(signal);
  const inspected = await inspectPdf(file, signal);
  assertActive(signal);
  return { asset: { hash, file, size: file.size, ...inspected, createdAt: Date.now() },
    fileName: file.name, duplicates: existing.books };
}
