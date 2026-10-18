#import "ExternalConversation.h"
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

static NSString *const EntryKey = @"ExternalAIEntryV1";
static BOOL Text(id value) { return [value isKindOfClass:NSString.class] && [value length] > 0 && [value length] <= 1024; }
static BOOL ValidEntry(id entry) {
    if (![entry isKindOfClass:NSDictionary.class] || ![entry[@"protocol"] isEqual:@"ai-session-launch/v1"] || !Text(entry[@"name"])) return NO;
    id transport = entry[@"transport"];
    if (![transport isKindOfClass:NSDictionary.class] || ![transport[@"type"] isEqual:@"stdio"]
        || !Text(transport[@"command"]) || ![transport[@"command"] isAbsolutePath]) return NO;
    id args = transport[@"args"];
    if (![args isKindOfClass:NSArray.class] || [args count] > 32) return NO;
    for (id arg in args) if (!Text(arg)) return NO;
    return [NSFileManager.defaultManager isExecutableFileAtPath:transport[@"command"]];
}
@implementation ExternalConversation
- (BOOL)configured { return ValidEntry([NSUserDefaults.standardUserDefaults dictionaryForKey:EntryKey]); }
- (BOOL)configure {
    NSOpenPanel *panel = [NSOpenPanel openPanel]; panel.allowedContentTypes = @[UTTypeJSON];
    panel.message = @"选择 AI 工具导出的会话入口 JSON 文件";
    if ([panel runModal] != NSModalResponseOK) return NO;
    NSData *data = [NSData dataWithContentsOfURL:panel.URL];
    id entry = data.length > 0 && data.length <= 65536 ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
    NSAlert *alert = [NSAlert new];
    if (!ValidEntry(entry)) { alert.messageText = @"入口配置无效"; alert.informativeText = @"需要 ai-session-launch/v1 配置和可执行的本地启动入口。"; [alert runModal]; return NO; }
    alert.messageText = [NSString stringWithFormat:@"使用 %@ 打开外部对话？", entry[@"name"]];
    alert.informativeText = [NSString stringWithFormat:@"启动程序：%@\n参数：%@\n后续点击外部对话将执行此入口。只导入可信 AI 工具生成的配置。",
        entry[@"transport"][@"command"], [entry[@"transport"][@"args"] componentsJoinedByString:@" "]];
    [alert addButtonWithTitle:@"使用此入口"]; [alert addButtonWithTitle:@"取消"];
    if ([alert runModal] != NSAlertFirstButtonReturn) return NO;
    [NSUserDefaults.standardUserDefaults setObject:entry forKey:EntryKey]; return YES;
}
- (void)openContext:(NSDictionary *)context completion:(void (^)(NSURL *, NSString *))completion {
    NSDictionary *entry = [NSUserDefaults.standardUserDefaults dictionaryForKey:EntryKey];
    if (!ValidEntry(entry)) { completion(nil, @"请先配置外部 AI 入口"); return; }
    if (!Text(context[@"window"]) || !Text(context[@"resource"])) { completion(nil, @"当前窗口上下文尚未就绪"); return; }
    NSString *appId = NSBundle.mainBundle.bundleIdentifier ?: @"local.reader";
    NSString *name = [NSBundle.mainBundle objectForInfoDictionaryKey:@"CFBundleDisplayName"] ?: @"阅读器";
    NSString *mcpCommand = [[NSBundle.mainBundle.executablePath stringByDeletingLastPathComponent] stringByAppendingPathComponent:@"recollection-garden"];
    if (![NSFileManager.defaultManager isExecutableFileAtPath:mcpCommand]) { completion(nil, @"此阅读器缺少 MCP 启动入口，请使用完整应用包"); return; }
    NSString *title = Text(context[@"title"]) ? context[@"title"] : @"当前书籍";
    if (title.length > 180) title = [title substringToIndex:180];
    NSDictionary *mcp = @{ @"transport": @{ @"type": @"stdio", @"command": mcpCommand,
        @"args": @[@"mcp", @"--window", context[@"window"], @"--book", context[@"resource"]] },
        @"scope": [@"当前阅读窗口中的内容、目录读取与阅读导航：" stringByAppendingString:title],
        @"readTools": @[@"rg_context_get", @"rg_page_read", @"rg_outline_get"], @"interactionTools": @[@"rg_reader_navigate", @"rg_outline_navigate"] };
    NSDictionary *request = @{ @"protocol": @"ai-session-launch/v1", @"operation": @"open-session",
        @"requestId": NSUUID.UUID.UUIDString,
        @"application": @{ @"id": appId, @"name": name, @"profile": @"desktop-default" },
        @"context": @{ @"window": context[@"window"], @"resource": context[@"resource"] }, @"mcp": mcp };
    NSData *input = [NSJSONSerialization dataWithJSONObject:request options:0 error:nil];
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        NSTask *task = [NSTask new]; task.executableURL = [NSURL fileURLWithPath:entry[@"transport"][@"command"]];
        task.arguments = [entry[@"transport"][@"args"] arrayByAddingObject:@"open-session"];
        NSPipe *inPipe = [NSPipe pipe], *outPipe = [NSPipe pipe];
        task.standardInput = inPipe; task.standardOutput = outPipe; task.standardError = NSFileHandle.fileHandleWithNullDevice;
        NSError *error = nil;
        if (![task launchAndReturnError:&error]) {
            dispatch_async(dispatch_get_main_queue(), ^{ completion(nil, @"AI 启动入口不可执行，请重新配置"); }); return;
        }
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 125 * NSEC_PER_SEC), dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
            if (task.running) [task terminate];
        });
        [inPipe.fileHandleForWriting writeData:input error:nil]; [inPipe.fileHandleForWriting closeFile];
        NSMutableData *output = [NSMutableData data];
        while (YES) {
            NSData *part = [outPipe.fileHandleForReading readDataOfLength:4096];
            if (!part.length) break;
            [output appendData:part];
            if (output.length > 65536) { if (task.running) [task terminate]; break; }
        }
        [outPipe.fileHandleForReading closeFile]; [task waitUntilExit];
        id reply = output.length > 0 && output.length <= 65536 ? [NSJSONSerialization JSONObjectWithData:output options:0 error:nil] : nil;
        NSString *message = @"AI 会话未打开，请重试；首次连接需在 AI 工具的确认窗口中允许"; NSURL *url = nil;
        if ([reply isKindOfClass:NSDictionary.class] && [reply[@"ok"] isEqual:@YES] && [reply[@"data"] isKindOfClass:NSDictionary.class]) {
            id raw = reply[@"data"][@"url"]; NSURLComponents *parts = Text(raw) ? [NSURLComponents componentsWithString:raw] : nil;
            BOOL local = [parts.scheme isEqual:@"http"] && [@[@"127.0.0.1", @"localhost", @"::1"] containsObject:parts.host];
            if ((local || [parts.scheme isEqual:@"https"]) && parts.host.length && !parts.user.length && !parts.password.length) url = parts.URL;
        } else if ([reply isKindOfClass:NSDictionary.class] && [reply[@"error"] isKindOfClass:NSDictionary.class] && Text(reply[@"error"][@"message"])) {
            message = reply[@"error"][@"message"];
        }
        dispatch_async(dispatch_get_main_queue(), ^{ completion(url, url ? nil : message); });
    });
}
@end
