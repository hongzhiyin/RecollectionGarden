export function prepareContext(socket: WebSocket, resource: string): Promise<{ window: string; resource: string; revision: string; title: string }> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();
    const finish = (error?: string, data?: { window: string; resource: string; revision: string; title: string }) => {
      clearTimeout(timer); socket.removeEventListener('message', receive); socket.removeEventListener('close', closed);
      if (error) reject(new Error(error)); else resolve(data!);
    };
    const closed = () => finish('阅读窗口连接已中断，请重试。');
    const receive = (event: MessageEvent) => {
      const value = JSON.parse(event.data);
      if (value.type !== 'external-context' || value.requestId !== requestId) return;
      if (value.error) finish(value.error); else finish(undefined, value.context);
    };
    const timer = setTimeout(() => finish('阅读上下文准备超时，请重试。'), 8000);
    socket.addEventListener('message', receive); socket.addEventListener('close', closed);
    socket.send(JSON.stringify({ type: 'prepare-external', requestId, resource }));
  });
}
