using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace RecollectionGarden;

internal sealed class ExternalConversation
{
    private readonly string configuration = Path.Combine(DesktopPaths.DataRoot, "external-ai-entry.json");
    internal ExternalAIEntry? Entry
    {
        get { try { return ExternalAIEntry.Parse(File.ReadAllText(configuration), Path.GetDirectoryName(configuration)!); } catch { return null; } }
    }
    internal bool Configure(IWin32Window owner)
    {
        using var picker = new OpenFileDialog { Title = "选择 AI 工具导出的会话入口", Filter = "AI 入口配置 (*.json)|*.json", CheckFileExists = true };
        if (picker.ShowDialog(owner) != DialogResult.OK) return false;
        try {
            var entry = ExternalAIEntry.Parse(File.ReadAllText(picker.FileName), Path.GetDirectoryName(picker.FileName)!);
            if (MessageBox.Show(owner, $"使用 {entry.Name} 打开外部对话？\n\n启动程序：{entry.Command}\n参数：{string.Join(" ", entry.Args)}\n\n后续连接会执行此入口。请仅使用可信 AI 工具提供的配置。",
                "配置 AI", MessageBoxButtons.OKCancel, MessageBoxIcon.Information) != DialogResult.OK) return false;
            Directory.CreateDirectory(DesktopPaths.DataRoot);
            var temporary = configuration + ".tmp"; File.WriteAllText(temporary, entry.Serialize()); File.Move(temporary, configuration, true);
            return true;
        } catch (Exception error) when (error is IOException or JsonException or InvalidOperationException or KeyNotFoundException or UnauthorizedAccessException or ArgumentException) {
            MessageBox.Show(owner, "入口配置无效或无法保存。请使用 Windows 应用包中的 ai-entry.json。", "配置 AI", MessageBoxButtons.OK, MessageBoxIcon.Warning); return false;
        }
    }
    internal async Task<Uri> Open(ReaderContext context, CancellationToken cancellationToken)
    {
        var entry = Entry ?? throw new InvalidOperationException("请先配置 AI 入口。");
        var mcp = Path.Combine(DesktopPaths.Resources, "runtime", "node.exe");
        var entryPoint = Path.Combine(DesktopPaths.Resources, "app", "desktop", "runtime", "entry.mjs");
        if (!File.Exists(mcp) || !File.Exists(entryPoint)) throw new InvalidOperationException("阅读器缺少 MCP 启动入口，请完整解压应用包。");
        return await Launch(entry, context.Request(mcp, DesktopPaths.DataRoot, entryPoint), cancellationToken);
    }
    internal static async Task<Uri> Launch(ExternalAIEntry entry, object request, CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken); timeout.CancelAfter(TimeSpan.FromSeconds(125));
        var token = timeout.Token;
        var info = new ProcessStartInfo(entry.Command) { UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true,
            StandardInputEncoding = new UTF8Encoding(false), StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8 };
        foreach (var argument in entry.Args) info.ArgumentList.Add(argument); info.ArgumentList.Add("open-session");
        using var child = Process.Start(info) ?? throw new InvalidOperationException("AI 启动入口不可执行。");
        try {
            using var errorLifetime = CancellationTokenSource.CreateLinkedTokenSource(token);
            async Task<string> Capture(StreamReader reader, bool reply) {
                try { return await ReadBounded(reader, reply ? token : errorLifetime.Token, reply); }
                catch (OperationCanceledException) when (!reply && child.HasExited) { return ""; }
                catch { timeout.Cancel(); throw; }
            }
            var output = Capture(child.StandardOutput, true); var errors = Capture(child.StandardError, false);
            await child.StandardInput.WriteAsync(JsonSerializer.Serialize(request).AsMemory(), token); child.StandardInput.Close();
            // A detached Windows backend may retain inherited pipe handles after the launcher exits.
            // The protocol result is a complete JSON object; EOF is not a completion signal.
            await Task.WhenAll(output, child.WaitForExitAsync(token)).WaitAsync(token);
            errorLifetime.Cancel(); await errors;
            if (Environment.GetEnvironmentVariable("RG_VERIFY_AI_PAIR") == "1" && child.ExitCode != 0)
                File.WriteAllText(Path.Combine(DesktopPaths.DataRoot, "ai-launch-diagnostic.json"), JsonSerializer.Serialize(new { child.ExitCode, output = await output, errors = await errors }));
            if (child.ExitCode != 0) throw new InvalidOperationException("AI 会话未打开，请检查配置后重试。");
            using var reply = JsonDocument.Parse(await output); var root = reply.RootElement;
            if (!root.TryGetProperty("ok", out var ok) || ok.ValueKind != JsonValueKind.True)
                throw new InvalidOperationException("AI 会话未打开；首次连接请在 AI 工具中确认授权。");
            var value = root.GetProperty("data").GetProperty("url").GetString();
            if (!Uri.TryCreate(value, UriKind.Absolute, out var url) || !string.IsNullOrEmpty(url.UserInfo)
                || !(url.Scheme == "https" || (url.Scheme == "http" && url.IsLoopback)))
                throw new InvalidDataException("AI 入口返回了无效的嵌入网址。");
            return url;
        } catch (OperationCanceledException) {
            if (Environment.GetEnvironmentVariable("RG_VERIFY_AI_PAIR") == "1")
                File.WriteAllText(Path.Combine(DesktopPaths.DataRoot, "ai-timeout-diagnostic.json"), JsonSerializer.Serialize(new { child.Id, child.HasExited }));
            throw;
        } finally {
            if (!child.HasExited) { child.Kill(true); await child.WaitForExitAsync(); }
        }
    }
    internal static async Task<string> ReadBounded(StreamReader reader, CancellationToken token, bool reply)
    {
        var text = new StringBuilder(); var buffer = new char[4096];
        while (true) { var count = await reader.ReadAsync(buffer.AsMemory(), token); if (count == 0) return text.ToString();
            if (text.Length + count > 65536) throw new InvalidDataException("AI 启动输出超过限制。"); text.Append(buffer, 0, count);
            if (reply) {
                try {
                    using var document = JsonDocument.Parse(text.ToString());
                    if (document.RootElement.ValueKind != JsonValueKind.Object) throw new InvalidDataException("AI 启动回复不是 JSON 对象。");
                    return text.ToString();
                } catch (JsonException) { /* A JSON object may span multiple pipe reads. */ }
            }
        }
    }
}
