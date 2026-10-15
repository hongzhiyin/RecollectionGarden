using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace RecollectionGarden;

internal sealed class MainWindow : Form
{
    private readonly WebView2 web = new() { Dock = DockStyle.Fill };
    private readonly RuntimeHost runtime = new();
    private readonly string[] arguments;
    private bool allowClose, closing;
    internal MainWindow(string[] args)
    {
        arguments = args;
        Text = "流光忆庭 · Garden of Recollection";
        Size = new Size(1240, 860); MinimumSize = new Size(900, 620); StartPosition = FormStartPosition.CenterScreen;
        Controls.Add(web); Shown += async (_, _) => await StartAsync();
        FormClosing += OnClosing;
        FormClosed += (_, _) => { web.Dispose(); runtime.Dispose(); };
    }
    private async Task StartAsync()
    {
        try
        {
            CoreWebView2Environment.GetAvailableBrowserVersionString();
            await runtime.StartAsync();
            var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(DesktopPaths.DataRoot, "WebView2"));
            await web.EnsureCoreWebView2Async(environment);
            web.CoreWebView2.Settings.AreDevToolsEnabled = false;
            web.CoreWebView2.Settings.IsWebMessageEnabled = false;
            web.CoreWebView2.NavigationStarting += (_, e) => e.Cancel = !Allowed(e.Uri);
            web.CoreWebView2.NewWindowRequested += (_, e) => e.Handled = true;
            web.CoreWebView2.DownloadStarting += OnDownload;
            var loaded = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            web.CoreWebView2.NavigationCompleted += (_, e) =>
            {
                if (e.IsSuccess) loaded.TrySetResult();
                else loaded.TrySetException(new InvalidOperationException("阅读页面加载失败：" + e.WebErrorStatus));
            };
            web.CoreWebView2.Navigate("http://127.0.0.1:4321/");
            await loaded.Task.WaitAsync(TimeSpan.FromSeconds(30));
            if (arguments.FirstOrDefault() == "--verify")
            {
                await DesktopVerification.RunAsync(web, arguments[1], arguments[2]);
                allowClose = true; await runtime.StopAsync(); Close();
            }
        }
        catch (Exception error)
        {
            if (arguments.FirstOrDefault() == "--verify")
            {
                File.WriteAllText(arguments[2], System.Text.Json.JsonSerializer.Serialize(new { ok = false, error = error.ToString() }));
                Environment.ExitCode = 1;
            }
            else MessageBox.Show(this, error is WebView2RuntimeNotFoundException
                ? "此设备缺少 Microsoft Edge WebView2 Runtime。请从微软官网下载并安装后重试：\nhttps://developer.microsoft.com/microsoft-edge/webview2/"
                : error.Message, "无法打开流光忆庭", MessageBoxButtons.OK, MessageBoxIcon.Error);
            allowClose = true; await runtime.StopAsync(); Close();
        }
    }
    private static bool Allowed(string value) => value == "about:blank"
        || value.StartsWith("blob:http://127.0.0.1:4321/", StringComparison.Ordinal)
        || Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == "http" && uri.Host == "127.0.0.1" && uri.Port == 4321;
    private void OnDownload(object? sender, CoreWebView2DownloadStartingEventArgs e)
    {
        e.Handled = true;
        using var save = new SaveFileDialog { FileName = Path.GetFileName(e.ResultFilePath),
            Filter = "Markdown 笔记 (*.md)|*.md", OverwritePrompt = true };
        if (save.ShowDialog(this) != DialogResult.OK) e.Cancel = true;
        else e.ResultFilePath = save.FileName;
    }
    private async void OnClosing(object? sender, FormClosingEventArgs e)
    {
        if (allowClose) return;
        e.Cancel = true;
        if (closing) return;
        closing = true;
        try
        {
            if (web.CoreWebView2 is not null)
            {
                var dirty = await web.ExecuteScriptAsync("(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;})()");
                if (dirty == "true" && MessageBox.Show(this, "笔记尚未保存。仍要退出并放弃输入吗？", "流光忆庭",
                    MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
                await web.ExecuteScriptAsync("window.dispatchEvent(new Event('pagehide'));true");
                await Task.Delay(300);
            }
            await runtime.StopAsync(); allowClose = true; Close();
        }
        catch (Exception error) { MessageBox.Show(this, error.Message, "退出失败，请重试"); }
        finally { closing = false; }
    }
}
