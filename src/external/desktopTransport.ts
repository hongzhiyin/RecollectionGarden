export type DesktopAction = 'external.toggle' | 'external.close' | 'external.layout' | 'external.state' | 'external.navigate'
  | 'external.configure' | 'external.cancel' | 'external.reload' | 'external.back' | 'external.forward' | 'external.browser';
type NativeWindow = Window & {
  webkit?: { messageHandlers?: { gardenDesktop?: { postMessage: (message: unknown) => void } } };
  chrome?: { webview?: { postMessage: (message: unknown) => void } };
};
export function desktopAvailable() {
  const host = window as NativeWindow;
  return !!(host.webkit?.messageHandlers?.gardenDesktop || host.chrome?.webview);
}
export function sendDesktop(type: DesktopAction, fields: Record<string, unknown> = {}) {
  const host = window as NativeWindow;
  const bridge = host.webkit?.messageHandlers?.gardenDesktop ?? host.chrome?.webview;
  bridge?.postMessage({ type, ...fields }); return !!bridge;
}
export interface DesktopState { canStartConversation?: boolean; status: 'disconnected' | 'connecting' | 'loaded' | 'error'; address: string; message: string; canBack: boolean; canForward: boolean }
export const disconnected: DesktopState = { status: 'disconnected', address: '', message: '配置后连接外部 AI', canBack: false, canForward: false };
