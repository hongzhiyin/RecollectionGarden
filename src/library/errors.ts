export class LibraryError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'LibraryError';
  }
}

export function describeError(error: unknown): string {
  if (error instanceof LibraryError) return error.message;
  if (error instanceof Error) {
    const details = `${error.name} ${error.message}`;
    if (/quota/i.test(details)) return '存储空间不足，文件未保存。请释放此浏览器的空间后重试。';
    if (/AbortError/.test(details)) return '操作已取消，尚未提交的文件未加入书架。';
    if (/worker|fetch|network/i.test(details)) return 'PDF 运行资源加载失败，请刷新页面后重试。';
    if (/database|indexeddb|storage|transaction/i.test(details)) return '本地保存失败，文件未加入书架。请重试。';
  }
  return '操作未完成，请重试。';
}
