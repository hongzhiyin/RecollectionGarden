using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace RecollectionGarden;

internal static class DesktopPairVerification
{
    internal static async Task Run(WebView2 reader, string report)
    {
        var configFile = Path.Combine(DesktopPaths.DataRoot, "external-ai-entry.json");
        _ = ExternalAIEntry.Parse(File.ReadAllText(configFile), Path.GetDirectoryName(configFile)!);
        var pane = reader.Parent?.Controls.OfType<BrowserPane>().Single() ?? throw new InvalidOperationException("AI surface missing");
        static async Task Wait(WebView2 web, string expression)
        {
            for (var i = 0; i < 1200; i++) { if (web.CoreWebView2 is not null && await web.ExecuteScriptAsync(expression) == "true") return; await Task.Delay(100); }
            var state = web.CoreWebView2 is null ? "No WebView" : await web.ExecuteScriptAsync("JSON.stringify({body:document.body.innerText.slice(-3000),aiStatus:document.querySelector('.ai-status')?.textContent,aiState:document.querySelector('.ai-status')?.dataset.status})");
            throw new TimeoutException("Pair verification failed: " + expression + " State: " + state);
        }
        await reader.ExecuteScriptAsync("document.querySelector('.reader-more').open=true;[...document.querySelectorAll('button')].find(e=>e.textContent==='外部对话').click()");
        await Wait(reader, "document.querySelector('.ai-status strong').textContent==='网页已打开'");
        if (!pane.HasPage || !pane.Visible) throw new InvalidOperationException("DreamEdge is not embedded");
        var ai = pane.Content;
        await Wait(ai, "!!document.querySelector('#chat-input')");
        async Task Send(string message, string expected)
        {
            await ai.ExecuteScriptAsync("(()=>{const e=document.querySelector('#chat-input');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,"
                + JsonSerializer.Serialize(message) + ");e.dispatchEvent(new Event('input',{bubbles:true}));})()");
            await Wait(ai, "document.querySelector('[aria-label=\"发送消息\"]')?.disabled===false");
            await ai.ExecuteScriptAsync("document.querySelector('[aria-label=\"发送消息\"]').click()");
            await Wait(ai, "[...document.querySelectorAll('[data-testid=\"assistant-message\"][data-status=\"completed\"]')].some(e=>e.textContent.includes(" + JsonSerializer.Serialize(expected) + "))");
        }
        await Send("WINDOWS_PAIR_READ", "PAIR_READ_OK");
        await Send("WINDOWS_PAIR_NAVIGATE", "PAIR_NAVIGATE_OK");
        await Wait(reader, "document.querySelector('[data-testid=\"page-indicator\"]').textContent.includes('2 / 3')");
        var before = await ai.ExecuteScriptAsync("document.querySelectorAll('[data-testid=\"user-message\"]').length");
        await reader.ExecuteScriptAsync("document.querySelector('.ai-toolbar button').click()");
        await Wait(reader, "!document.querySelector('#ai-settings').hidden");
        await Task.Delay(100); if (pane.Visible) throw new InvalidOperationException("Settings is covered by native AI surface");
        await reader.ExecuteScriptAsync("document.querySelector('[aria-label=\"关闭连接设置\"]').click()");
        await Task.Delay(100); if (!pane.HasPage) throw new InvalidOperationException("Settings unloaded AI session");
        var after = await ai.ExecuteScriptAsync("document.querySelectorAll('[data-testid=\"user-message\"]').length");
        if (before != after) throw new InvalidOperationException("Session changed during settings toggle");
        await using (var image = File.Create(report + ".ai.png")) await ai.CoreWebView2.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, image);
        File.WriteAllText(report + ".pair.json", JsonSerializer.Serialize(new { ok = true, packagedWindowsApps = true, nativeEmbedded = true,
            scopedContextRead = true, originalPageRead = true, readerNavigatedToPage2 = true, settingsPreserveHistory = true, realModel = false }));
        await reader.ExecuteScriptAsync("window.chrome.webview.postMessage({type:'external.close'})");
    }
}
