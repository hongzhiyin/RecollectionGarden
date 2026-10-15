using System.Diagnostics;
using RecollectionGarden;

static async Task ForwardInput(Process child, CancellationToken token)
{
    try
    {
        await Console.OpenStandardInput().CopyToAsync(child.StandardInput.BaseStream, token);
        child.StandardInput.Close();
    }
    catch (Exception error) when (error is IOException or OperationCanceledException or ObjectDisposedException) { }
}

try
{
    var info = DesktopPaths.Node(args.Length == 0 ? ["help"] : args, false);
    info.RedirectStandardInput = info.RedirectStandardOutput = info.RedirectStandardError = true;
    using var child = Process.Start(info) ?? throw new InvalidOperationException("内置 Node 无法启动。");
    using var inputLifetime = new CancellationTokenSource();
    _ = ForwardInput(child, inputLifetime.Token);
    var output = child.StandardOutput.BaseStream.CopyToAsync(Console.OpenStandardOutput());
    var errors = child.StandardError.BaseStream.CopyToAsync(Console.OpenStandardError());
    await child.WaitForExitAsync();
    inputLifetime.Cancel();
    await Task.WhenAll(output, errors);
    return child.ExitCode;
}
catch (Exception error)
{
    Console.Error.WriteLine(error.Message);
    return 1;
}
