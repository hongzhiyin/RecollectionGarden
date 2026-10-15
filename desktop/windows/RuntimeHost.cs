using System.Diagnostics;
using System.Text.Json;

namespace RecollectionGarden;

internal sealed class RuntimeHost : IDisposable
{
    private Process? child;
    private readonly object logLock = new();
    internal string LogPath => Path.Combine(DesktopPaths.DataRoot, "desktop.log");
    internal async Task StartAsync()
    {
        Directory.CreateDirectory(DesktopPaths.DataRoot);
        var info = DesktopPaths.Node(["serve"], true);
        info.RedirectStandardInput = info.RedirectStandardOutput = info.RedirectStandardError = true;
        child = new Process { StartInfo = info };
        child.OutputDataReceived += (_, e) => Log(e.Data);
        child.ErrorDataReceived += (_, e) => Log(e.Data);
        if (!child.Start()) throw new InvalidOperationException("本地服务未能启动。");
        child.BeginOutputReadLine(); child.BeginErrorReadLine();
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(1) };
        for (var attempt = 0; attempt < 150; attempt++)
        {
            if (child.HasExited) throw new InvalidOperationException("本地服务已退出。日志：" + LogPath);
            try
            {
                using var response = JsonDocument.Parse(await http.GetStringAsync("http://127.0.0.1:4321/__rg_experience"));
                var root = response.RootElement;
                if (root.GetProperty("app").GetString() == "RecollectionGarden" && root.GetProperty("ready").GetBoolean()
                    && root.GetProperty("pid").GetInt32() == child.Id) return;
            }
            catch (Exception e) when (e is HttpRequestException or TaskCanceledException or JsonException) { }
            await Task.Delay(100);
        }
        throw new TimeoutException("本地服务启动超时。日志：" + LogPath);
    }
    private void Log(string? line)
    {
        if (line is null) return;
        lock (logLock) File.AppendAllText(LogPath, line + Environment.NewLine);
    }
    internal async Task StopAsync()
    {
        if (child is null || child.HasExited) return;
        child.StandardInput.Close();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(4));
        try { await child.WaitForExitAsync(timeout.Token); }
        catch (OperationCanceledException) { if (!child.HasExited) child.Kill(true); await child.WaitForExitAsync(); }
    }
    public void Dispose()
    {
        if (child is not null && !child.HasExited) child.Kill(true);
        child?.Dispose();
    }
}
