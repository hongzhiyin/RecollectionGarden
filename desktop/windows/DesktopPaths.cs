using System.Diagnostics;

namespace RecollectionGarden;

internal static class DesktopPaths
{
    internal static string DataRoot => Environment.GetEnvironmentVariable("RG_DESKTOP_DATA_DIR")
        ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "RecollectionGarden", "Desktop");
    internal static string Resources => Path.Combine(AppContext.BaseDirectory, "Resources");
    internal static ProcessStartInfo Node(IEnumerable<string> arguments, bool managed)
    {
        var info = new ProcessStartInfo(Path.Combine(Resources, "runtime", "node.exe"))
        {
            UseShellExecute = false, CreateNoWindow = true,
            WorkingDirectory = Path.Combine(Resources, "app"),
        };
        info.ArgumentList.Add(Path.Combine(Resources, "app", "desktop", "runtime", "entry.mjs"));
        foreach (var argument in arguments) info.ArgumentList.Add(argument);
        foreach (var key in new[] { "NODE_OPTIONS", "NODE_PATH", "RG_DESKTOP_MANAGED", "RG_DESKTOP_UI_PORT", "RG_DESKTOP_BRIDGE_PORT" })
            info.Environment.Remove(key);
        info.Environment["RG_DESKTOP_DATA_DIR"] = DataRoot;
        if (managed)
        {
            info.Environment.Remove("RG_BRIDGE_CONFIG");
            info.Environment["RG_DESKTOP_MANAGED"] = "1";
        }
        return info;
    }
}
