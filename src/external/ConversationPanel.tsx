import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { useBridge } from './BridgeProvider';
import { listMessages } from './storage';
import type { ExternalMessage } from './models';
import '../styles/external.css';

export function BridgeConnection() {
  const bridge = useBridge();
  return <div className="bridge-connection"><span aria-live="polite">{bridge.status}</span>
    <button className="button secondary" onClick={bridge.enabled ? bridge.disconnect : bridge.connect}>
      {bridge.connected ? '断开外部连接' : bridge.enabled ? '停止连接' : '连接本地服务'}</button>
    {bridge.sessionId && <span className="bridge-session" data-testid="bridge-session" data-session-id={bridge.sessionId}>窗口 {bridge.sessionId.slice(0, 8)}</span>}
  </div>;
}
export function ConversationPanel({ bookId, locate, createNote }: { bookId: string; locate: (citationId: string) => void;
  createNote: (message: ExternalMessage) => void }) {
  const [messages, setMessages] = useState<ExternalMessage[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    setMessages([]); setError('');
    const subscription = liveQuery(() => listMessages(bookId)).subscribe({ next: setMessages,
      error: () => setError('消息读取失败，已保存内容将在重开后重新读取。') });
    return () => subscription.unsubscribe();
  }, [bookId]);
  const labels = { streaming: '生成中 · 外部上报', complete: '已完成', cancelled: '已停止 · 外部上报', error: '失败 · 外部上报' };
  return <section className="conversation-panel" aria-label="外部对话展示窗口">
    <BridgeConnection />
    {error && <p role="alert">{error}</p>}
    {!messages.length && <p className="conversation-empty">在外部 AI 工具中发起对话，通过 CLI 或 MCP 回传回答和引用。此窗口展示已收到的消息。</p>}
    {messages.map(message => <article key={message.id} data-testid="external-message">
      <div className="conversation-meta"><strong>{message.sourceLabel}</strong><span>{labels[message.status]}</span>
        <span>{message.role === 'assistant' ? 'AI 回答' : '问题'} · 会话 {message.conversationId.slice(0, 12)}</span></div>
      <p className="conversation-text">{message.text || '等待外部内容'}</p>
      <div className="conversation-citations">{message.citationIds.map((id, index) =>
        <button className="button secondary" key={id} onClick={() => locate(id)}>查看引用 {index + 1}</button>)}</div>
      {message.role === 'assistant' && <button className="button secondary" disabled={message.status !== 'complete' || !message.text.trim()}
        onClick={() => createNote(message)}>保存回答为笔记</button>}
      {message.status !== 'complete' && <p className="conversation-incomplete">此消息尚未完成，已接收内容保存在此浏览器。</p>}
    </article>)}
  </section>;
}
