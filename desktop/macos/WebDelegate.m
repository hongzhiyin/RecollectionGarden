#import "WebDelegate.h"
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

@implementation WebDelegate
- (instancetype)init {
    if ((self = [super init])) self.downloads = [NSMapTable strongToStrongObjectsMapTable];
    return self;
}
- (void)webView:(WKWebView *)webView runOpenPanelWithParameters:(WKOpenPanelParameters *)parameters
    initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(NSArray<NSURL *> *))completionHandler {
    NSOpenPanel *panel = [NSOpenPanel openPanel]; panel.canChooseFiles = YES;
    panel.canChooseDirectories = NO; panel.allowsMultipleSelection = parameters.allowsMultipleSelection;
    panel.allowedContentTypes = @[UTTypePDF]; panel.message = @"选择要加入书架的 PDF";
    [panel beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse result) {
        completionHandler(result == NSModalResponseOK ? panel.URLs : nil);
    }];
}
- (void)webView:(WKWebView *)webView decidePolicyForNavigationAction:(WKNavigationAction *)action
    decisionHandler:(void (^)(WKNavigationActionPolicy))decisionHandler {
    NSURL *url = action.request.URL;
    int port = [NSBundle.mainBundle.infoDictionary[@"RGVerificationProfile"] boolValue] ? 4331 : 4321;
    BOOL local = [url.scheme isEqual:@"http"] && [url.host isEqual:@"127.0.0.1"] && url.port.intValue == port;
    BOOL blob = [url.absoluteString hasPrefix:[NSString stringWithFormat:@"blob:http://127.0.0.1:%d/",port]];
    if (action.shouldPerformDownload && (local || blob)) decisionHandler(WKNavigationActionPolicyDownload);
    else decisionHandler(local || [url.absoluteString isEqual:@"about:blank"] ? WKNavigationActionPolicyAllow : WKNavigationActionPolicyCancel);
}
- (void)webView:(WKWebView *)webView navigationAction:(WKNavigationAction *)action didBecomeDownload:(WKDownload *)download {
    download.delegate = self;
}
- (void)webView:(WKWebView *)webView navigationResponse:(WKNavigationResponse *)response didBecomeDownload:(WKDownload *)download {
    download.delegate = self;
}
- (void)download:(WKDownload *)download decideDestinationUsingResponse:(NSURLResponse *)response
    suggestedFilename:(NSString *)suggestedFilename completionHandler:(void (^)(NSURL *))completionHandler {
    NSSavePanel *panel = [NSSavePanel savePanel];
    panel.nameFieldStringValue = suggestedFilename.lastPathComponent;
    panel.canCreateDirectories = YES; panel.message = @"保存导出的 Markdown 笔记";
    [panel beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse result) {
        if (result != NSModalResponseOK) { completionHandler(nil); return; }
        NSURL *target = panel.URL;
        NSURL *temporary = [[target URLByDeletingLastPathComponent] URLByAppendingPathComponent:
            [NSString stringWithFormat:@".rg-download-%@.part", NSUUID.UUID.UUIDString]];
        [self.downloads setObject:@{@"target":target, @"temporary":temporary} forKey:download];
        completionHandler(temporary);
    }];
}
- (void)downloadDidFinish:(WKDownload *)download {
    NSDictionary *info = [self.downloads objectForKey:download]; if (!info) return;
    NSError *error = nil; NSURL *target = info[@"target"], *temporary = info[@"temporary"];
    if ([NSFileManager.defaultManager fileExistsAtPath:target.path])
        [NSFileManager.defaultManager replaceItemAtURL:target withItemAtURL:temporary backupItemName:nil options:0 resultingItemURL:nil error:&error];
    else [NSFileManager.defaultManager moveItemAtURL:temporary toURL:target error:&error];
    [self.downloads removeObjectForKey:download];
    if (error) [self showError:error];
}
- (void)download:(WKDownload *)download didFailWithError:(NSError *)error resumeData:(NSData *)resumeData {
    NSDictionary *info = [self.downloads objectForKey:download];
    if (info) [NSFileManager.defaultManager removeItemAtURL:info[@"temporary"] error:nil];
    [self.downloads removeObjectForKey:download];
    if (error.code != NSURLErrorCancelled) [self showError:error];
}
- (void)webView:(WKWebView *)webView runJavaScriptAlertPanelWithMessage:(NSString *)message
    initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(void))completionHandler {
    NSAlert *alert = [NSAlert new]; alert.messageText = @"流光忆庭"; alert.informativeText = message;
    [alert beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse result) { completionHandler(); }];
}
- (void)webView:(WKWebView *)webView runJavaScriptConfirmPanelWithMessage:(NSString *)message
    initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(BOOL))completionHandler {
    NSAlert *alert = [NSAlert new]; alert.messageText = @"流光忆庭"; alert.informativeText = message;
    [alert addButtonWithTitle:@"确定"]; [alert addButtonWithTitle:@"取消"];
    [alert beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse result) { completionHandler(result == NSAlertFirstButtonReturn); }];
}
- (void)showError:(NSError *)error {
    NSAlert *alert = [NSAlert new]; alert.messageText = @"操作未完成"; alert.informativeText = error.localizedDescription;
    [alert beginSheetModalForWindow:self.window completionHandler:nil];
}
@end
