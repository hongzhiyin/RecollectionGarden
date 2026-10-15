type HashResult = { hash: string } | { error: string };
const scope = self as unknown as {
  onmessage: (event: MessageEvent<File>) => void;
  postMessage: (result: HashResult) => void;
};

scope.onmessage = async ({ data: file }) => {
  try {
    const bytes = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('');
    scope.postMessage({ hash });
  } catch {
    scope.postMessage({ error: '无法读取文件或计算摘要。' });
  }
};
