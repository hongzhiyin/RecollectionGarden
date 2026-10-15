using System.Diagnostics;
using RecollectionGarden;

try
{
    using var child = Process.Start(DesktopPaths.Node(args.Length == 0 ? ["help"] : args, false))
        ?? throw new InvalidOperationException("内置 Node 无法启动。");
    await child.WaitForExitAsync();
    return child.ExitCode;
}
catch (Exception error)
{
    Console.Error.WriteLine(error.Message);
    return 1;
}
