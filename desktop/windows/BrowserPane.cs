using System.Diagnostics;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace RecollectionGarden;

internal sealed class BrowserPane : UserControl
{
    private readonly WebView2 web = new() { Dock = DockStyle.Fill };
    private readonly string savedSite = Path.Combine(DesktopPaths.DataRoot, "external-site.txt");
    private Task? initialization;
    private string status = "disconnected", message = "配置后连接外部 AI", address = "";
    private int generation;
    private ulong navigation;
    private bool acceptNavigation;
    internal bool HasPage { get; private set; }
    internal event Action<object>? StateChanged;
    internal BrowserPane()
    {
        Controls.Add(web);
        try { if (File.Exists(savedSite)) address = File.ReadAllText(savedSite); } catch { }
    }
    internal void Report() => StateChanged?.Invoke(new { status, message, address, canBack = web.CanGoBack, canForward = web.CanGoForward });
    private void State(string state, string detail) { status = state; message = detail; Report(); }
    internal async Task ActivateAsync()
    {
        if (address.Length > 0) await Command("external.navigate", address);
        else State("disconnected", "请在设置中填写 AI 网址；本端尚不支持自动创建上下文会话");
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
            if (e.IsSuccess) { HasPage = true; address = web.Source?.AbsoluteUri ?? address; }
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
            generation++; acceptNavigation = false; web.Stop();
            if (action == "external.close") { HasPage = false; web.CoreWebView2?.Navigate("about:blank"); }
            State(HasPage ? "loaded" : "disconnected", "连接已停止，阅读位置保持"); return;
        }
        if (action == "external.configure") { State(status, "请在 AI 入口地址填写网址；自动上下文会话尚未支持"); return; }
        if (action == "external.navigate") {
            value = value.Trim();
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
        if (action == "external.reload") web.Reload();
        if (action == "external.browser" && web.Source is { } uri && Allowed(uri.AbsoluteUri))
            Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
    }
}
