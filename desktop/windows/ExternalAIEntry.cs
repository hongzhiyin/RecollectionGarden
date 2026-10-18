using System.Text.Json;

namespace RecollectionGarden;

internal sealed record ExternalAIEntry(string Name, string Command, string[] Args)
{
    internal static ExternalAIEntry Parse(string json, string directory)
    {
        if (json.Length > 65536) throw new InvalidDataException("AI 入口配置过大。");
        using var document = JsonDocument.Parse(json); var root = document.RootElement;
        if (root.GetProperty("protocol").GetString() != "ai-session-launch/v1") throw new InvalidDataException("不支持此 AI 入口协议。");
        static string Text(JsonElement value)
        {
            var text = value.GetString();
            if (string.IsNullOrWhiteSpace(text) || text.Length > 1024 || text.Any(char.IsControl)) throw new InvalidDataException("AI 入口字段无效。");
            return text;
        }
        var name = Text(root.GetProperty("name")); var transport = root.GetProperty("transport");
        if (transport.GetProperty("type").GetString() != "stdio") throw new InvalidDataException("需要 stdio 启动入口。");
        var command = Text(transport.GetProperty("command"));
        if (!Path.IsPathFullyQualified(command)) {
            if (command != Path.GetFileName(command) || command.Contains('/') || command.Contains('\\'))
                throw new InvalidDataException("相对启动入口必须位于配置文件旁。");
            command = Path.GetFullPath(Path.Combine(directory, command));
        }
        if (!command.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) || !File.Exists(command))
            throw new InvalidDataException("启动入口不存在，请选择 Windows 应用包中的 ai-entry.json。");
        var args = transport.GetProperty("args").EnumerateArray().Select(Text).ToArray();
        if (args.Length > 32) throw new InvalidDataException("启动参数过多。");
        return new(name, command, args);
    }
    internal string Serialize() => JsonSerializer.Serialize(new { protocol = "ai-session-launch/v1", name = Name,
        transport = new { type = "stdio", command = Command, args = Args } });
}

internal sealed record ReaderContext(string Window, string Resource, string Title)
{
    internal static ReaderContext Parse(JsonElement value)
    {
        var window = value.GetProperty("window").GetString() ?? "";
        var resource = value.GetProperty("resource").GetString() ?? "";
        if (!Guid.TryParse(window, out _) || !Guid.TryParse(resource, out _)) throw new InvalidDataException("当前阅读上下文无效。");
        var title = value.TryGetProperty("title", out var name) ? name.GetString() ?? "当前书籍" : "当前书籍";
        return new(window, resource, title[..Math.Min(title.Length, 180)]);
    }
    internal object Request(string mcpCommand) => new {
        protocol = "ai-session-launch/v1", operation = "open-session", requestId = Guid.NewGuid().ToString(),
        application = new { id = "com.chihoyo.RecollectionGarden", name = "流光忆庭", profile = "desktop-default" },
        context = new { window = Window, resource = Resource },
        mcp = new { transport = new { type = "stdio", command = mcpCommand, args = new[] { "mcp", "--window", Window, "--book", Resource } },
            scope = "当前阅读窗口中的内容、目录读取与阅读导航：" + Title,
            readTools = new[] { "rg_context_get", "rg_page_read", "rg_outline_get" },
            interactionTools = new[] { "rg_reader_navigate", "rg_outline_navigate" } }
    };
}
