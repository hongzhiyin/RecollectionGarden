using System.Diagnostics;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace RecollectionGarden;

internal sealed class BrowserPane : UserControl
{
    private readonly WebView2 web = new() { Dock = DockStyle.Fill };
    private readonly string savedSite = Path.Combine(DesktopPaths.DataRoot, "external-site.txt");
    private Task? initialization;
    private readonly ExternalConversation conversation = new();
    private ReaderContext? context;
    private CancellationTokenSource? launching;
    private string status = "disconnected", message = "配置后连接外部 AI", address = "";
    private int generation;
    private ulong navigation;
    private bool acceptNavigation;
    internal bool HasPage { get; private set; }
    internal WebView2 Content => web;
    internal event Action<object>? StateChanged;
    internal BrowserPane()
    {
        Controls.Add(web);
        try { if (File.Exists(savedSite)) address = File.ReadAllText(savedSite); } catch { }
    }
    internal void Report() => StateChanged?.Invoke(new { status, message, address, canStartConversation = conversation.Entry is not null, canBack = web.CanGoBack, canForward = web.CanGoForward });
    private void State(string state, string detail) { status = state; message = detail; Report(); }
    internal async Task ActivateAsync()
    {
        if (address.Length > 0) await Command("external.navigate", address);
        else State("disconnected", "请配置 AI 会话入口或填写网页地址");
    }
    internal async Task OpenContext(ReaderContext next)
    {
        launching?.Cancel(); context = next;
        if (conversation.Entry is null && !conversation.Configure((IWin32Window?)FindForm() ?? this)) { State("disconnected", "配置已取消，阅读不受影响"); return; }
        using var lifetime = new CancellationTokenSource(); launching = lifetime; var current = ++generation;
        State("connecting", "正在打开 AI 会话；首次连接请确认授权…");
        try {
            var url = await conversation.Open(next, lifetime.Token);
            await (initialization ??= InitializeAsync()); if (current != generation || lifetime.IsCancellationRequested) return;
            web.CoreWebView2.Navigate(url.AbsoluteUri);
        } catch (OperationCanceledException) { if (current == generation) State("disconnected", "连接已取消或超时，可重试"); }
        catch (Exception error) when (error is IOException or InvalidOperationException or System.Text.Json.JsonException or System.ComponentModel.Win32Exception or KeyNotFoundException) {
            if (current == generation) State("error", "AI 会话打开失败，请检查入口、授权或服务后重试");
        } finally { if (ReferenceEquals(launching, lifetime)) launching = null; }
    }
    private async Task InitializeAsync()
    {
        var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(DesktopPaths.DataRoot, "ExternalWebView2"));
        await web.EnsureCoreWebView2Async(environment);
        web.CoreWebView2.Settings.AreHostObjectsAllowed = false;
        web.CoreWebView2.Settings.IsWebMessageEnabled = false;
        web.CoreWebView2.NavigationStarting += (_, e) => {
            e.Cancel = !Allowed(e.Uri) && e.Uri != "about:blank";
            navigation = e.NavigationId;
            if (e.Uri == "about:blank") return;
            acceptNavigation = !e.Cancel;
            State(e.Cancel ? "error" : "connecting", e.Cancel ? "此链接无法在网页面板中打开" : "正在加载 AI 网页…");
        };
        web.CoreWebView2.NavigationCompleted += (_, e) => {
            if (!acceptNavigation || e.NavigationId != navigation || web.Source?.AbsoluteUri == "about:blank") return;
            if (e.IsSuccess) { HasPage = true; address = web.Source is { } source ? new UriBuilder(source) { Fragment = "" }.Uri.AbsoluteUri : address; }
            State(e.IsSuccess ? "loaded" : "error", e.IsSuccess ? "AI 网页已打开；会话状态由 AI 软件展示" : "加载失败，请检查网址或在浏览器打开");
        };
        web.CoreWebView2.NewWindowRequested += (_, e) => { e.Handled = true; if (Allowed(e.Uri)) web.CoreWebView2.Navigate(e.Uri); };
        web.CoreWebView2.DownloadStarting += (_, e) => { e.Cancel = true; State("error", "下载文件请在浏览器中打开"); };
    }
    private static bool Allowed(string value) => Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && (uri.Scheme == "https" || uri.Scheme == "http") && !string.IsNullOrWhiteSpace(uri.Host) && string.IsNullOrEmpty(uri.UserInfo);
    internal async Task Command(string action, string value)
    {
        if (action == "external.cancel" || action == "external.close") {
            generation++; launching?.Cancel(); acceptNavigation = false; web.Stop();
            if (action == "external.close") { context = null; HasPage = false; web.CoreWebView2?.Navigate("about:blank"); }
            State(HasPage ? "loaded" : "disconnected", "连接已停止，阅读位置保持"); return;
        }
        if (action == "external.configure") { if (conversation.Configure((IWin32Window?)FindForm() ?? this) && context is not null) await OpenContext(context); else Report(); return; }
        if (action == "external.navigate") {
            launching?.Cancel(); context = null; value = value.Trim();
            if (!Allowed(value)) { State("error", "请输入完整有效的 http 或 https 网址"); return; }
            var current = ++generation; State("connecting", "正在准备 AI 网页…");
            try {
                await (initialization ??= InitializeAsync()); if (current != generation) return;
                address = value; web.CoreWebView2.Navigate(value);
                try { File.WriteAllText(savedSite, new Uri(value).GetLeftPart(UriPartial.Authority) + "/"); }
                catch { message = "已打开，网址偏好未能保存"; Report(); }
            } catch { initialization = null; if (current == generation) State("error", "网页面板启动失败，请重试"); }
            return;
        }
        if (web.CoreWebView2 is null) return;
        if (action == "external.back" && web.CanGoBack) web.GoBack();
        if (action == "external.forward" && web.CanGoForward) web.GoForward();
        if (action == "external.reload") { if (context is not null && conversation.Entry is not null) await OpenContext(context); else web.Reload(); }
        if (action == "external.browser" && web.Source is { } uri && Allowed(uri.AbsoluteUri))
            Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
    }
}
