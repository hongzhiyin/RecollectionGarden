using System.Diagnostics;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace RecollectionGarden;

internal sealed class BrowserPane : UserControl
{
    private readonly WebView2 web = new() { Dock = DockStyle.Fill };
    private readonly TextBox address = new() { Dock = DockStyle.Fill, PlaceholderText = "输入 AI 对话网址", AccessibleName = "AI 对话网址" };
    private readonly Label status = new() { Dock = DockStyle.Top, Height = 30, Text = "输入 DreamEdge 或其他 AI 工具的网址", AutoEllipsis = true };
    private readonly string savedSite = Path.Combine(DesktopPaths.DataRoot, "external-site.txt");
    private Task? initialization;
    private readonly Button back, forward;
    internal event Action? CloseRequested;
    internal BrowserPane()
    {
        Padding = new Padding(8); BackColor = SystemColors.Window;
        var navigation = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 38, WrapContents = false };
        back = Button("返回", () => { if (web.CanGoBack) web.GoBack(); });
        forward = Button("前进", () => { if (web.CanGoForward) web.GoForward(); });
        navigation.Controls.AddRange([back, forward, Button("刷新", () => web.Reload()),
            Button("浏览器打开", OpenBrowser), Button("关闭", () => CloseRequested?.Invoke())]);
        var location = new TableLayoutPanel { Dock = DockStyle.Top, Height = 38, ColumnCount = 2 };
        location.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        location.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 58));
        location.Controls.Add(address, 0, 0); location.Controls.Add(Button("打开", Navigate), 1, 0);
        address.KeyDown += (_, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; Navigate(); } };
        Controls.Add(web); Controls.Add(status); Controls.Add(location); Controls.Add(navigation);
        back.Enabled = forward.Enabled = false;
    }
    private static Button Button(string text, Action action)
    {
        var button = new Button { Text = text, AutoSize = true, Height = 30, MinimumSize = new Size(44, 30), TabStop = true };
        button.Click += (_, _) => action(); return button;
    }
    internal async Task ActivateAsync()
    {
        try { await (initialization ??= InitializeAsync()); address.Focus(); }
        catch { initialization = null; status.Text = "网页面板启动失败，请关闭后重试"; }
    }
    private async Task InitializeAsync()
    {
        var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(DesktopPaths.DataRoot, "ExternalWebView2"));
        await web.EnsureCoreWebView2Async(environment);
        web.CoreWebView2.Settings.AreHostObjectsAllowed = false;
        web.CoreWebView2.Settings.IsWebMessageEnabled = false;
        web.CoreWebView2.NavigationStarting += (_, e) => {
            e.Cancel = !Allowed(e.Uri); status.Text = e.Cancel ? "此链接无法在网页面板中打开" : "正在加载…";
        };
        web.CoreWebView2.NavigationCompleted += (_, e) => {
            status.Text = e.IsSuccess ? web.CoreWebView2.DocumentTitle : "加载失败，请检查网址或在浏览器打开";
            address.Text = web.Source?.AbsoluteUri ?? ""; back.Enabled = web.CanGoBack; forward.Enabled = web.CanGoForward;
        };
        web.CoreWebView2.NewWindowRequested += (_, e) => { e.Handled = true; if (Allowed(e.Uri)) web.CoreWebView2.Navigate(e.Uri); };
        web.CoreWebView2.DownloadStarting += (_, e) => { e.Cancel = true; status.Text = "下载文件请在浏览器中打开"; };
        if (File.Exists(savedSite)) { address.Text = await File.ReadAllTextAsync(savedSite); Navigate(); }
    }
    private static bool Allowed(string value) => Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && (uri.Scheme == "https" || uri.Scheme == "http") && !string.IsNullOrWhiteSpace(uri.Host) && string.IsNullOrEmpty(uri.UserInfo);
    private void Navigate()
    {
        var value = address.Text.Trim(); if (!value.Contains("://")) value = "https://" + value;
        if (!Allowed(value)) { status.Text = "请输入有效的 http 或 https 网址"; return; }
        if (web.CoreWebView2 is null) { status.Text = "网页面板尚未准备好"; return; }
        web.CoreWebView2.Navigate(value);
        try { File.WriteAllText(savedSite, new Uri(value).GetLeftPart(UriPartial.Authority) + "/"); }
        catch { status.Text = "已打开，网址偏好未能保存"; }
    }
    private void OpenBrowser()
    {
        if (web.Source is { } uri && Allowed(uri.AbsoluteUri))
            Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true });
    }
}
