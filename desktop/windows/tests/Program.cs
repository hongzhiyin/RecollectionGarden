using System.Text.Json;
using RecollectionGarden;

if (args.FirstOrDefault() == "fixture") {
    var input = await Console.In.ReadToEndAsync();
    if (args[1] == "wait") { await Task.Delay(30000); return; }
    if (args[1] == "large") { Console.Write(new string('x', 70000)); await Task.Delay(30000); return; }
    if (args[1] == "denied") { Console.WriteLine("{\"ok\":false}"); return; }
    var url = args[1] == "unsafe" ? "file:///C:/private" : "http://127.0.0.1:12345/embedded#fixture";
    Console.WriteLine(JsonSerializer.Serialize(new { ok = true, data = new { url } })); return;
}
var executable = Environment.ProcessPath!;
void Check(bool condition, string message) { if (!condition) throw new Exception(message); }
async Task Reject(Func<Task> action) { try { await action(); } catch { return; } throw new Exception("Expected rejection"); }
var json = JsonSerializer.Serialize(new { protocol = "ai-session-launch/v1", name = "Windows 中文 test",
    transport = new { type = "stdio", command = Path.GetFileName(executable), args = new[] { "fixture", "ok" } } });
var entry = ExternalAIEntry.Parse(json, AppContext.BaseDirectory);
Check(entry.Command == executable, "Relative portable entry resolved incorrectly");
Check(ExternalAIEntry.Parse(entry.Serialize(), AppContext.BaseDirectory) == entry || ExternalAIEntry.Parse(entry.Serialize(), AppContext.BaseDirectory).Command == entry.Command, "Saved entry changed");
var context = new ReaderContext(Guid.NewGuid().ToString(), Guid.NewGuid().ToString(), "中文书籍");
var request = context.Request(executable, AppContext.BaseDirectory);
using (var scoped = JsonDocument.Parse(JsonSerializer.Serialize(request))) {
    var declared = scoped.RootElement.GetProperty("mcp").GetProperty("transport").GetProperty("args").EnumerateArray().Select(value => value.GetString()).ToArray();
    Check(declared.Contains(context.Window) && declared.Contains(context.Resource), "Reader scope was not bound");
    Check(declared[^2] == "--data-dir" && declared[^1] == AppContext.BaseDirectory, "Explicit profile was not handed off");
}
var uri = await ExternalConversation.Launch(entry, request, CancellationToken.None);
Check(uri.IsLoopback && uri.Fragment == "#fixture", "Valid embedded handoff rejected");
await Reject(() => ExternalConversation.Launch(entry with { Args = ["fixture", "unsafe"] }, request, CancellationToken.None));
await Reject(() => ExternalConversation.Launch(entry with { Args = ["fixture", "denied"] }, request, CancellationToken.None));
using (var cancel = new CancellationTokenSource(200))
    await Reject(() => ExternalConversation.Launch(entry with { Args = ["fixture", "wait"] }, request, cancel.Token));
var start = DateTime.UtcNow;
await Reject(() => ExternalConversation.Launch(entry with { Args = ["fixture", "large"] }, request, CancellationToken.None));
Check((DateTime.UtcNow - start).TotalSeconds < 10, "Output overflow did not terminate launcher promptly");
try { ExternalAIEntry.Parse(json.Replace(Path.GetFileName(executable), "../escape.exe"), AppContext.BaseDirectory); throw new Exception("Path escape accepted"); }
catch (InvalidDataException) { }
Console.WriteLine("Windows AI entry, scoped request, URL validation, denial, cancellation and output-limit checks passed.");
