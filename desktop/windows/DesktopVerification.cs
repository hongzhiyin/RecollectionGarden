using System.Text.Json;
using Microsoft.Web.WebView2.WinForms;

namespace RecollectionGarden;

internal static class DesktopVerification
{
    internal static async Task RunAsync(WebView2 web, string fixture, string report)
    {
        async Task Wait(string expression)
        {
            for (var attempt = 0; attempt < 300; attempt++)
            {
                if (await web.ExecuteScriptAsync(expression) == "true") return;
                await Task.Delay(100);
            }
            var layout = await web.ExecuteScriptAsync("JSON.stringify({width:innerWidth,height:innerHeight,clientWidth:document.documentElement.clientWidth,dpr:devicePixelRatio,reader:document.querySelector('.reader-screen')?.getBoundingClientRect().toJSON()})");
            throw new TimeoutException("桌面验收未通过：" + expression + " Layout: " + layout);
        }
        await Wait("!!document.querySelector('[data-testid=pdf-input]')");
        var bytes = Convert.ToBase64String(await File.ReadAllBytesAsync(fixture));
        await web.ExecuteScriptAsync("(()=>{const bytes=Uint8Array.from(atob(" + JsonSerializer.Serialize(bytes)
            + "),c=>c.charCodeAt(0));const transfer=new DataTransfer();transfer.items.add(new File([bytes],'windows-smoke.pdf',{type:'application/pdf'}));"
            + "const input=document.querySelector('[data-testid=pdf-input]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()");
        await Wait("!!document.querySelector('[aria-label=\"阅读 windows-smoke\"]')");
        await web.ExecuteScriptAsync("document.querySelector('[aria-label=\"阅读 windows-smoke\"]').click()");
        await Wait("(()=>{const c=document.querySelector('.reader-surface canvas');if(!c||getComputedStyle(c).opacity!=='1')return false;"
            + "const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<p.length;i+=4)if(p[i]<180&&p[i+3])n++;return n>100;})()");
        await Wait("document.querySelector('.textLayer')?.textContent.includes('Selecting original text')===true");
        await Wait("(()=>{const r=document.querySelector('.reader-screen').getBoundingClientRect();return r.x===0&&r.y===0&&r.width===innerWidth&&r.height===innerHeight;})()");
        var fullWidth = web.Width;
        var browser = web.Parent?.Controls.OfType<BrowserPane>().Single()
            ?? throw new InvalidOperationException("Native AI surface is missing.");
        await web.ExecuteScriptAsync("window.chrome.webview.postMessage({type:'external.navigate',address:location.origin+'/__rg_experience'})");
        await Wait("[...document.querySelectorAll('button')].find(e=>e.textContent==='外部对话').getAttribute('aria-pressed')==='true'");
        for (var attempt = 0; attempt < 100 && !browser.Visible; attempt++) await Task.Delay(100);
        if (!browser.Visible || !browser.HasPage || web.Width != fullWidth)
            throw new InvalidOperationException("Native AI surface failed to load within the full-width shell.");
        await Wait("(()=>{const r=document.querySelector('.aurora-reader').getBoundingClientRect();const a=document.querySelector('.ai-surface').getBoundingClientRect();return r.width>=420&&a.width>=300&&a.x>r.right;})()");
        await web.ExecuteScriptAsync("document.querySelector('.reader-divider').dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true}))");
        await Wait("Math.abs(document.querySelector('.aurora-reader').getBoundingClientRect().width-420)<1");
        await web.ExecuteScriptAsync("document.querySelector('.ai-toolbar button').click()");
        await Wait("!document.querySelector('#ai-settings').hidden");
        for (var attempt = 0; attempt < 100 && browser.Visible; attempt++) await Task.Delay(100);
        if (browser.Visible || !browser.HasPage) throw new InvalidOperationException("Settings must hide, not unload, the AI surface.");
        await web.ExecuteScriptAsync("document.querySelector('[aria-label=\"关闭连接设置\"]').click()");
        for (var attempt = 0; attempt < 100 && !browser.Visible; attempt++) await Task.Delay(100);
        if (!browser.Visible) throw new InvalidOperationException("AI surface was not restored after closing settings.");
        await web.ExecuteScriptAsync("window.chrome.webview.postMessage({type:'external.close'})");
        await Wait("[...document.querySelectorAll('button')].find(e=>e.textContent==='外部对话').getAttribute('aria-pressed')==='false'");
        if (web.Width != fullWidth) throw new InvalidOperationException("Reader shell width changed unexpectedly.");
        await web.ExecuteScriptAsync("document.querySelector('[aria-label=\"关闭\"]').click()");
        await Wait("!document.querySelector('.reader-surface')");
        await web.ExecuteScriptAsync("[...document.querySelectorAll('button')].find(e=>e.textContent==='连接本地服务').click()");
        await Wait("document.body.textContent.includes('外部工具已连接')");
        await using (var image = File.Create(report + ".png"))
            await web.CoreWebView2.CapturePreviewAsync(Microsoft.Web.WebView2.Core.CoreWebView2CapturePreviewImageFormat.Png, image);
        File.WriteAllText(report, JsonSerializer.Serialize(new { ok = true, nativeWebView2 = true,
            importedPdf = true, canvasHasInk = true, selectableText = true, bridgeConnected = true, fullWindowReader = true, nativeBrowserSurface = true, settingsPreserveSurface = true, minimumReaderWidth = true }));
        while (!File.Exists(report + ".stop")) await Task.Delay(100);
    }
}
