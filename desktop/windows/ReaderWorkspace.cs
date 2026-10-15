using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace RecollectionGarden;

internal sealed class ReaderWorkspace : SplitContainer
{
    private readonly WebView2 reader;
    private readonly BrowserPane browser = new();
    private readonly string preference = Path.Combine(DesktopPaths.DataRoot, "reader-split.json");
    private double ratio = .6;
    private bool changing;
    internal ReaderWorkspace(WebView2 reader)
    {
        this.reader = reader; Dock = DockStyle.Fill; Orientation = Orientation.Vertical;
        Size = new Size(1240, 860); SplitterWidth = 6; SplitterDistance = 744; Panel1MinSize = 420; Panel2MinSize = 360;
        Panel1.Controls.Add(reader); browser.Dock = DockStyle.Fill; Panel2.Controls.Add(browser);
        Panel2Collapsed = true; browser.CloseRequested += () => SetOpen(false);
        try { if (File.Exists(preference)) ratio = Math.Clamp(JsonSerializer.Deserialize<double>(File.ReadAllText(preference)), .3, .75); }
        catch { ratio = .6; }
        SplitterMoved += (_, _) => {
            if (changing || Panel2Collapsed || Width <= 0) return;
            ratio = (double)SplitterDistance / Width;
            try { File.WriteAllText(preference, JsonSerializer.Serialize(ratio)); } catch { /* Keep the current split for this run. */ }
        };
    }
    internal void Attach()
    {
        reader.CoreWebView2.Settings.IsWebMessageEnabled = true;
        reader.CoreWebView2.WebMessageReceived += (_, e) => {
            if (!Uri.TryCreate(e.Source, UriKind.Absolute, out var origin) || origin.Scheme != "http"
                || origin.Host != "127.0.0.1" || origin.Port != 4321) return;
            try {
                using var document = JsonDocument.Parse(e.WebMessageAsJson);
                var type = document.RootElement.GetProperty("type").GetString();
                if (type == "external.toggle") SetOpen(Panel2Collapsed);
                else if (type == "external.close") SetOpen(false);
            } catch (Exception error) when (error is JsonException or InvalidOperationException or KeyNotFoundException) { }
        };
    }
    private async void SetOpen(bool open)
    {
        changing = true; Panel2Collapsed = !open;
        if (open) SplitterDistance = Math.Clamp((int)(Width * ratio), Panel1MinSize, Math.Max(Panel1MinSize, Width - Panel2MinSize - SplitterWidth));
        changing = false;
        try {
            await reader.ExecuteScriptAsync("window.dispatchEvent(new CustomEvent('garden-external-panel',{detail:" + (open ? "true" : "false") + "}))");
            if (open) await browser.ActivateAsync();
        } catch (Exception error) when (error is ObjectDisposedException or InvalidOperationException) { }
    }
}
