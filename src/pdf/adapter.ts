import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist';
import { assertActive, MAX_PAGES } from '../library/model';
import { LibraryError } from '../library/errors';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;

function classify(error: unknown): Error {
  if (error instanceof LibraryError) return error;
  const name = error instanceof Error ? error.name : '';
  if (name === 'PasswordException') return new LibraryError('PASSWORD_REQUIRED', '此 PDF 需要密码，请提供可直接读取的版本。');
  if (name === 'InvalidPDFException') return new LibraryError('INVALID_PDF', '文件不是可读取的 PDF，或已经损坏。');
  if (error instanceof Error && /worker|fetch|network/i.test(error.message)) {
    return new LibraryError('PDF_RUNTIME', 'PDF 运行资源加载失败，请刷新页面后重试。');
  }
  return new LibraryError('PDF_UNREADABLE', 'PDF 页面无法解析，请提供可读取的版本。');
}

export async function openPdf(file: Blob, signal: AbortSignal): Promise<PDFDocumentProxy> {
  assertActive(signal);
  const bytes = await file.arrayBuffer();
  assertActive(signal);
  const task = getDocument({ data: new Uint8Array(bytes), cMapUrl: '/pdf/cmaps/', cMapPacked: true,
    standardFontDataUrl: '/pdf/standard_fonts/', wasmUrl: '/pdf/wasm/', stopAtErrors: true,
    // A pixel-count cutoff drops entire scanned pages; resize decoded images instead.
    maxImageSize: -1, canvasMaxAreaInBytes: 32_000_000 });
  const abort = () => { void task.destroy().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const document = await task.promise;
    assertActive(signal);
    return document;
  } catch (error) {
    await task.destroy().catch(() => {});
    assertActive(signal);
    throw classify(error);
  } finally {
    signal.removeEventListener('abort', abort);
  }
}

export async function inspectPdf(file: Blob, signal: AbortSignal) {
  const document = await openPdf(file, signal);
  const abort = () => { void document.loadingTask.destroy().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    if (!document.numPages || document.numPages > MAX_PAGES) {
      throw new LibraryError('PAGE_LIMIT', `此版本支持 1～${MAX_PAGES} 页的 PDF。`);
    }
    const page = await document.getPage(1);
    const natural = page.getViewport({ scale: 1 });
    const scale = Math.min(280 / natural.width, 400 / natural.height);
    const viewport = page.getViewport({ scale });
    const canvas = window.document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    await page.render({ canvas, viewport }).promise;
    assertActive(signal);
    return { pages: document.numPages, thumbnail: canvas.toDataURL('image/jpeg', 0.78) };
  } catch (error) {
    assertActive(signal);
    throw classify(error);
  } finally {
    signal.removeEventListener('abort', abort);
    await document.loadingTask.destroy().catch(() => {});
  }
}
