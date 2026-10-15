#import <AppKit/AppKit.h>
#import <WebKit/WebKit.h>
#import "RuntimeHost.h"
#import "WebDelegate.h"
#import "SingleInstance.h"
#import "ReaderWorkspace.h"

@interface GardenApp : NSObject <NSApplicationDelegate, NSWindowDelegate>
@property(strong) NSWindow *window;
@property(strong) WKWebView *webView;
@property(strong) WebDelegate *webDelegate;
@property(strong) RuntimeHost *runtime;
@property(strong) ReaderWorkspace *workspace;
@property BOOL closing;
@end
static GardenApp *retainedDelegate;

@implementation GardenApp
- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    [NSDistributedNotificationCenter.defaultCenter addObserver:self selector:@selector(showWindow:)
        name:GardenReopenNotification() object:nil suspensionBehavior:NSNotificationSuspensionBehaviorDeliverImmediately];
    NSError *instanceError = nil;
    if (!ClaimGardenInstance(&instanceError)) {
        if (instanceError) {
            NSAlert *alert = [NSAlert new]; alert.messageText = @"无法打开流光忆庭";
            alert.informativeText = instanceError.localizedDescription; [alert runModal];
        }
        exit(instanceError ? 1 : 0);
    }
    [self buildMenus];
    self.window = [[NSWindow alloc] initWithContentRect:NSMakeRect(0, 0, 1240, 860)
        styleMask:NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable
        backing:NSBackingStoreBuffered defer:NO];
    self.window.title = @"流光忆庭 · Garden of Recollection";
    self.window.minSize = NSMakeSize(900, 620); self.window.delegate = self; self.window.releasedWhenClosed = NO;
    [self.window center];
    WKWebViewConfiguration *configuration = [WKWebViewConfiguration new];
    configuration.websiteDataStore = WKWebsiteDataStore.defaultDataStore;
    self.webView = [[WKWebView alloc] initWithFrame:self.window.contentView.bounds configuration:configuration];
    self.webView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    self.webView.allowsBackForwardNavigationGestures = NO;
    self.webDelegate = [WebDelegate new]; self.webDelegate.window = self.window;
    self.webView.UIDelegate = self.webDelegate; self.webView.navigationDelegate = self.webDelegate;
    self.workspace = [[ReaderWorkspace alloc] initWithReader:self.webView];
    [configuration.userContentController addScriptMessageHandler:self.workspace name:@"gardenDesktop"];
    self.window.contentView = self.workspace.view;
    [self.window makeKeyAndOrderFront:nil]; [NSApp activateIgnoringOtherApps:YES];
    [self.webView loadHTMLString:@"<html><body style='background:#f5f3ee;font:16px -apple-system;padding:48px'>正在打开流光忆庭…</body></html>" baseURL:nil];
    self.runtime = [RuntimeHost new];
    [self.runtime start:^(NSError *error) {
        if (error) {
            NSAlert *alert = [NSAlert new]; alert.messageText = @"无法打开流光忆庭"; alert.informativeText = error.localizedDescription;
            [alert runModal]; [NSApp terminate:nil]; return;
        }
        [self.webView loadRequest:[NSURLRequest requestWithURL:self.runtime.baseURL]];
    }];
}
- (void)buildMenus {
    NSMenu *bar = [NSMenu new], *appMenu = [NSMenu new]; NSMenuItem *appItem = [NSMenuItem new];
    [appMenu addItemWithTitle:@"关于流光忆庭" action:@selector(orderFrontStandardAboutPanel:) keyEquivalent:@""];
    [appMenu addItem:NSMenuItem.separatorItem];
    NSMenuItem *open = [appMenu addItemWithTitle:@"打开流光忆庭" action:@selector(showWindow:) keyEquivalent:@"1"]; open.target = self;
    [appMenu addItem:NSMenuItem.separatorItem];
    [appMenu addItemWithTitle:@"退出流光忆庭" action:@selector(terminate:) keyEquivalent:@"q"];
    appItem.submenu = appMenu; [bar addItem:appItem];
    NSMenuItem *edit = [[NSMenuItem alloc] initWithTitle:@"编辑" action:nil keyEquivalent:@""]; NSMenu *menu = [[NSMenu alloc] initWithTitle:@"编辑"];
    [menu addItemWithTitle:@"撤销" action:@selector(undo:) keyEquivalent:@"z"];
    [menu addItem:NSMenuItem.separatorItem];
    [menu addItemWithTitle:@"剪切" action:@selector(cut:) keyEquivalent:@"x"];
    [menu addItemWithTitle:@"复制" action:@selector(copy:) keyEquivalent:@"c"];
    [menu addItemWithTitle:@"粘贴" action:@selector(paste:) keyEquivalent:@"v"];
    [menu addItemWithTitle:@"全选" action:@selector(selectAll:) keyEquivalent:@"a"];
    edit.submenu = menu; [bar addItem:edit]; NSApp.mainMenu = bar;
}
- (void)showWindow:(id)sender { [self.window makeKeyAndOrderFront:nil]; [NSApp activateIgnoringOtherApps:YES]; }
- (BOOL)applicationShouldHandleReopen:(NSApplication *)application hasVisibleWindows:(BOOL)visible { [self showWindow:nil]; return YES; }
- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender { return NO; }
- (void)checkUnsaved:(void (^)(BOOL))completion {
    [self.webView evaluateJavaScript:@"(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;})()"
        completionHandler:^(id value, NSError *error) {
            if (![value boolValue]) { completion(YES); return; }
            NSAlert *alert = [NSAlert new]; alert.messageText = @"笔记尚未保存";
            alert.informativeText = @"返回应用保存，或放弃尚未保存的输入。";
            [alert addButtonWithTitle:@"返回保存"]; [alert addButtonWithTitle:@"放弃并继续"];
            [alert beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse result) { completion(result == NSAlertSecondButtonReturn); }];
        }];
}
- (BOOL)windowShouldClose:(NSWindow *)sender {
    return YES; // The retained window keeps drafts alive; Quit checks before terminating.
}
- (NSApplicationTerminateReply)applicationShouldTerminate:(NSApplication *)sender {
    [self checkUnsaved:^(BOOL allowed) {
        if (!allowed) { [NSApp replyToApplicationShouldTerminate:NO]; return; }
        [self.webView evaluateJavaScript:@"window.dispatchEvent(new Event('pagehide'));true" completionHandler:^(id value, NSError *error) {
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 300 * NSEC_PER_MSEC), dispatch_get_main_queue(),
                ^{ [self.runtime stop]; [NSApp replyToApplicationShouldTerminate:YES]; });
        }];
    }]; return NSTerminateLater;
}
- (void)applicationWillTerminate:(NSNotification *)notification { [self.runtime stop]; }
@end

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSApplication *application = NSApplication.sharedApplication;
        [application setActivationPolicy:NSApplicationActivationPolicyRegular];
        retainedDelegate = [GardenApp new]; application.delegate = retainedDelegate;
        [application run];
    }
    return 0;
}
