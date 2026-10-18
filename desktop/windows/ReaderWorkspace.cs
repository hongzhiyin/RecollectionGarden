using System.Text.Json;
using Microsoft.Web.WebView2.WinForms;

namespace RecollectionGarden;

// The shared web shell owns layout and controls; native WebView2 only displays AI content.
internal sealed class ReaderWorkspace : UserControl
{
    private readonly WebView2 reader;
    private readonly BrowserPane browser = new();
    private bool open, visible;
    internal ReaderWorkspace(WebView2 reader)
    {
        this.reader = reader; Dock = DockStyle.Fill;
        Controls.Add(reader); Controls.Add(browser); browser.Visible = false;
        browser.StateChanged += async state => {
            browser.Visible = open && visible && browser.HasPage;
            if (browser.Visible) browser.BringToFront();
            try { await reader.ExecuteScriptAsync("window.dispatchEvent(new CustomEvent('garden-external-state',{detail:" + JsonSerializer.Serialize(state) + "}))"); }
            catch (Exception error) when (error is ObjectDisposedException or InvalidOperationException) { }
        };
    }
    internal void Attach()
    {
        reader.CoreWebView2.Settings.IsWebMessageEnabled = true;
        reader.CoreWebView2.WebMessageReceived += async (_, e) => {
            if (!Uri.TryCreate(e.Source, UriKind.Absolute, out var origin) || origin.Scheme != "http"
                || origin.Host != "127.0.0.1" || origin.Port != 4321) return;
            try {
                using var document = JsonDocument.Parse(e.WebMessageAsJson); var body = document.RootElement;
                var type = body.GetProperty("type").GetString() ?? "";
                if (type == "external.layout") {
                    visible = body.TryGetProperty("visible", out var show) && show.ValueKind == JsonValueKind.True;
                    if (visible) {
                        var scale = DeviceDpi / 96.0 * reader.ZoomFactor;
                        double Read(string name) { var value = body.GetProperty(name).GetDouble(); return double.IsFinite(value) ? Math.Clamp(value * scale, 0, 100000) : 0; }
                        browser.Bounds = Rectangle.Intersect(ClientRectangle, new Rectangle((int)Read("x"), (int)Read("y"), (int)Read("width"), (int)Read("height")));
                    }
                    browser.Visible = open && visible && browser.HasPage;
                    if (browser.Visible) browser.BringToFront();
                } else if (type == "external.state") browser.Report();
                else if (type == "external.toggle") {
                    await SetOpen(body.TryGetProperty("open", out var requested) ? requested.GetBoolean() : !open);
                    if (open) await browser.ActivateAsync(); else await browser.Command("external.close", "");
                } else {
                    if (type == "external.navigate") await SetOpen(true);
                    if (type == "external.close") await SetOpen(false);
                    await browser.Command(type, body.TryGetProperty("address", out var address) ? address.GetString() ?? "" : "");
                }
            } catch (Exception error) when (error is JsonException or InvalidOperationException or KeyNotFoundException or ObjectDisposedException) { }
        };
    }
    private async Task SetOpen(bool value)
    {
        open = value; browser.Visible = open && visible && browser.HasPage;
        if (browser.Visible) browser.BringToFront();
        await reader.ExecuteScriptAsync("window.dispatchEvent(new CustomEvent('garden-external-panel',{detail:" + (open ? "true" : "false") + "}))");
    }
}
