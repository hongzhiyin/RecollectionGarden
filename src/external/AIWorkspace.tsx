import { useEffect, useRef, useState } from 'react';
import { useBridge } from './BridgeProvider';
import { sendDesktop } from './desktopTransport';
import type { DesktopPanel } from './useDesktopPanel';
import { useNativeSurface } from './useNativeSurface';
import { Icon } from '../ui/Icon';

export function AIWorkspace({ desktop, obscured }: { desktop: DesktopPanel; obscured: boolean }) {
  const [settings, setSettings] = useState(false);
  const [address, setAddress] = useState('');
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const bridge = useBridge();
  const surface = useNativeSurface(desktop.available && desktop.open && !settings && !obscured);
  const busy = desktop.state.status === 'connecting';
  useEffect(() => { if (!dirty) setAddress(desktop.state.address); }, [desktop.state.address, dirty]);
  useEffect(() => { if (settings) input.current?.focus(); }, [settings]);
  function close() { setSettings(false); trigger.current?.focus(); }
  function connect() {
    setError('');
    if (!address.trim() || (!dirty && desktop.state.canStartConversation)) { void desktop.connect(); return; }
    try {
      const url = new URL(address.trim());
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error();
      sendDesktop('external.navigate', { address: url.href }); setDirty(false);
    } catch { setError('请输入完整的 http:// 或 https:// 地址'); }
  }
  const label = { disconnected: '未连接', connecting: '连接中…', loaded: '网页已打开', error: '连接失败' }[desktop.state.status];
  return <section className="ai-workspace" aria-label="AI 软件窗口">
    <header className="ai-toolbar"><span>AI 对话</span><button ref={trigger} className="button text" aria-expanded={settings}
      aria-controls="ai-settings" onClick={() => setSettings(value => !value)}><Icon name="settings" size={16} />设置</button></header>
    <div ref={surface} className="ai-surface"><div className="ai-placeholder"><span>AI 软件界面显示区域</span>
      <small>{desktop.available ? '由 AI 软件提供完整界面' : '在桌面版中展示 AI 软件的完整界面'}</small></div></div>
    <section id="ai-settings" className="ai-settings" aria-label="连接设置" hidden={!settings}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }}>
      <header><strong>连接设置</strong><button className="icon-button" aria-label="关闭连接设置" onClick={close}><Icon name="close" size={16} /></button></header>
      <div className="ai-status" data-status={desktop.state.status}><small>AI 窗口</small><strong role="status">{label}</strong><small>{desktop.state.message}</small></div>
      <label className="field-label" htmlFor="ai-address">AI 入口地址</label>
      <input ref={input} id="ai-address" className="text-input" placeholder="https://…" value={address} disabled={busy || !desktop.available}
        onChange={event => { setAddress(event.target.value); setDirty(true); setError(''); }} />
      <p className={error ? 'field-error' : 'field-help'} role={error ? 'alert' : undefined}>{error || (dirty ? '修改尚未应用' : desktop.state.canStartConversation ? '使用已配置的 AI 与当前书籍连接' : '留空可启动已配置的 AI 会话')}</p>
      <div className="ai-actions"><button className="button primary" disabled={busy || !desktop.available || (desktop.state.status === 'loaded' && !dirty)} onClick={connect}>{busy ? '正在连接' : desktop.state.status === 'error' ? '重试' : dirty ? '保存并连接' : '连接'}</button>
        {busy ? <button className="button secondary" onClick={desktop.cancel}>取消连接</button>
          : dirty ? <button className="button secondary" onClick={() => { setDirty(false); setAddress(desktop.state.address); setError(''); }}>取消修改</button>
            : desktop.open && <button className="button secondary" onClick={desktop.disconnect}>断开连接</button>}</div>
      {desktop.available && <details className="ai-advanced"><summary>更多连接操作</summary><div className="ai-actions">
        <button className="button text" onClick={() => sendDesktop('external.configure')}>配置 AI</button>
        <button className="button text" disabled={!desktop.open} onClick={() => sendDesktop('external.reload')}>重新加载</button>
        <button className="button text" disabled={!desktop.state.canBack} onClick={() => sendDesktop('external.back')}>返回</button>
        <button className="button text" disabled={!desktop.state.canForward} onClick={() => sendDesktop('external.forward')}>前进</button>
        <button className="button text" disabled={!desktop.open} onClick={() => sendDesktop('external.browser')}>浏览器打开</button>
      </div></details>}
      <div className="ai-service"><small>本地内容服务</small><p role="status">{bridge.status}</p>
        <button className="button text" onClick={bridge.enabled ? bridge.disconnect : bridge.connect}>{bridge.enabled ? '断开本地服务' : '连接本地服务'}</button></div>
      <p className="ai-setting-help">关闭设置不影响连接。网页打开状态不代表 AI 会话已就绪。</p>
    </section>
  </section>;
}
