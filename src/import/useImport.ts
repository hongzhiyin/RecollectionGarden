import { useRef, useState } from 'react';
import { describeError } from '../library/errors';
import { DuplicateConflict, library } from '../library/repository';
import type { Book, ImportCandidate, ImportChoice, ImportStage } from '../library/model';
import { prepareImport } from './service';

interface ImportState {
  file?: File;
  stage?: ImportStage;
  candidate?: ImportCandidate;
  error?: string;
  message?: string;
}

export function useImport(onSaved: (book: Book, open: boolean) => Promise<void>) {
  const [state, setState] = useState<ImportState>({});
  const controller = useRef<AbortController | null>(null);
  const committing = useRef(false);
  const setStage = (stage: ImportStage) => {
    committing.current = stage === 'saving';
    setState(previous => ({ ...previous, stage }));
  };

  async function save(candidate: ImportCandidate, choice: ImportChoice, confirmed: boolean, file?: File) {
    const job = controller.current!;
    setState({ file, stage: 'saving' });
    committing.current = true;
    let book: Book;
    try {
      book = await library.commit(candidate.asset, candidate.fileName, choice, confirmed, job.signal);
      committing.current = false;
      setState({ message: choice.type === 'open' ? '已打开已有书籍。' : `“${book.title}”已保存。` });
    } catch (error) {
      committing.current = false;
      if (error instanceof DuplicateConflict) {
        setState({ file, candidate: { ...candidate, duplicates: error.books } });
      } else if (error instanceof Error && error.name === 'AbortError') {
        setState({ message: '导入已取消。' });
      } else setState({ file, error: describeError(error) });
      return;
    }
    try { await onSaved(book, choice.type === 'open'); }
    catch { setState({ message: '文件已保存，但书架显示更新失败。请重新加载页面。' }); }
  }

  async function start(file: File) {
    if (controller.current && committing.current) return;
    controller.current?.abort();
    const job = new AbortController();
    controller.current = job;
    setState({ file, stage: 'checking' });
    try {
      const candidate = await prepareImport(file, job.signal, setStage);
      if (controller.current !== job) return;
      if (candidate.duplicates.length) setState({ file, candidate });
      else await save(candidate, { type: 'create' }, false, file);
    } catch (error) {
      if (controller.current !== job) return;
      if (job.signal.aborted) setState({ message: '导入已取消。' });
      else setState({ file, error: describeError(error) });
    }
  }

  function cancel() {
    if (committing.current) return;
    controller.current?.abort();
    controller.current = null;
    setState({ message: '导入已取消。' });
  }

  return { state, start, cancel, dismiss: () => setState({}),
    choose: (choice: ImportChoice) => {
      if (state.candidate) void save(state.candidate, choice, true, state.file);
    },
  };
}
