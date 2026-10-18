#import "BrowserPane.h"
#import "ExternalConversation.h"

@interface BrowserPane ()
@property(strong) WKWebView *web;
@property(strong) ExternalConversation *conversation;
@property(strong) WKNavigation *navigation;
@property(copy) NSDictionary *context;
@property(copy) NSString *status;
@property(copy) NSString *message;
@property(copy) NSString *address;
@property BOOL activated;
@property BOOL acceptsNavigation;
@property BOOL launching;
@property NSUInteger generation;
@property(readwrite) BOOL hasPage;
@end
@implementation BrowserPane
- (instancetype)initWithFrame:(NSRect)frame {
    if (!(self = [super initWithFrame:frame])) return nil;
    self.conversation = [ExternalConversation new];
    self.acceptsNavigation = YES; self.status = @"disconnected"; self.message = @"配置后连接外部 AI";
    self.address = [NSUserDefaults.standardUserDefaults stringForKey:@"ExternalBrowserURL"] ?: @"";
    WKWebViewConfiguration *configuration = [WKWebViewConfiguration new];
    configuration.websiteDataStore = [WKWebsiteDataStore dataStoreForIdentifier:
        [[NSUUID alloc] initWithUUIDString:@"09F5F8BB-0740-47CF-89CA-778B6058A02E"]];
    if ([NSBundle.mainBundle.infoDictionary[@"RGVerificationProfile"] boolValue]) configuration.websiteDataStore = WKWebsiteDataStore.nonPersistentDataStore;
    self.web = [[WKWebView alloc] initWithFrame:self.bounds configuration:configuration];
    self.web.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    self.web.navigationDelegate = self; self.web.UIDelegate = self; [self addSubview:self.web];
    return self;
}
- (void)report {
    if (self.onState) self.onState(@{ @"status":self.status, @"message":self.message, @"address":self.address,
        @"canStartConversation":@([self.conversation configured]), @"canBack":@(self.web.canGoBack), @"canForward":@(self.web.canGoForward) });
}
- (void)setStatus:(NSString *)status message:(NSString *)message {
    self.status = status; self.message = message; [self report];
}
- (BOOL)allowed:(NSURL *)url {
    return [@[@"http",@"https"] containsObject:url.scheme.lowercaseString] && url.host.length && !url.user.length && !url.password.length;
}
- (void)activate {
    if (!self.activated && self.address.length) [self command:@"external.navigate" address:self.address];
    else [self report];
}
- (void)openContext:(NSDictionary *)context {
    BOOL changed = ![self.context isEqual:context]; self.context = [context copy];
    if (self.launching && !changed) return;
    if (![self.conversation configured] && ![self.conversation configure]) {
        [self setStatus:@"disconnected" message:@"配置已取消，阅读不受影响"]; return;
    }
    NSUInteger generation = ++self.generation; self.launching = YES; self.hasPage = NO; self.acceptsNavigation = YES;
    [self.web stopLoading];
    [self setStatus:@"connecting" message:@"正在打开 AI 会话；首次连接请确认授权…"];
    __weak BrowserPane *weakSelf = self;
    [self.conversation openContext:context completion:^(NSURL *url, NSString *error) {
        BrowserPane *pane = weakSelf; if (!pane || generation != pane.generation) return;
        pane.launching = NO;
        if (!url) { [pane setStatus:@"error" message:error ?: @"会话启动失败"]; return; }
        pane.activated = YES; pane.navigation = [pane.web loadRequest:[NSURLRequest requestWithURL:url]];
    }];
}
- (void)command:(NSString *)action address:(NSString *)address {
    if ([@[@"external.navigate",@"external.reload",@"external.back",@"external.forward"] containsObject:action]) self.acceptsNavigation = YES;
    if ([action isEqual:@"external.navigate"]) {
        NSURL *url = [NSURL URLWithString:[address stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet]];
        if (![self allowed:url]) { [self setStatus:@"error" message:@"请输入完整有效的 http 或 https 网址"]; return; }
        self.generation++; self.launching = NO; self.context = nil; self.activated = YES; self.address = url.absoluteString;
        NSURLComponents *site = [NSURLComponents componentsWithURL:url resolvingAgainstBaseURL:NO];
        site.path = @"/"; site.query = nil; site.fragment = nil;
        [NSUserDefaults.standardUserDefaults setObject:site.URL.absoluteString forKey:@"ExternalBrowserURL"];
        self.navigation = [self.web loadRequest:[NSURLRequest requestWithURL:url]];
    } else if ([action isEqual:@"external.configure"]) {
        if ([self.conversation configure] && self.context) [self openContext:self.context]; else [self report];
    } else if ([action isEqual:@"external.reload"]) {
        if (self.context && [self.conversation configured]) [self openContext:self.context]; else self.navigation = [self.web reload];
    } else if ([action isEqual:@"external.back"]) self.navigation = [self.web goBack];
    else if ([action isEqual:@"external.forward"]) self.navigation = [self.web goForward];
    else if ([action isEqual:@"external.browser"]) {
        if ([self allowed:self.web.URL]) [NSWorkspace.sharedWorkspace openURL:self.web.URL];
    } else if ([action isEqual:@"external.cancel"] || [action isEqual:@"external.close"]) {
        self.generation++; self.launching = NO; self.navigation = nil; self.acceptsNavigation = NO; [self.web stopLoading];
        if ([action isEqual:@"external.close"]) { self.hasPage = NO; [self.web loadHTMLString:@"" baseURL:nil]; }
        [self setStatus:self.hasPage ? @"loaded" : @"disconnected" message:@"连接已停止，阅读位置保持"];
    }
}
- (void)webView:(WKWebView *)webView decidePolicyForNavigationAction:(WKNavigationAction *)action decisionHandler:(void (^)(WKNavigationActionPolicy))handler {
    BOOL allowed = [self allowed:action.request.URL] || [action.request.URL.absoluteString isEqual:@"about:blank"];
    if (allowed && action.navigationType != WKNavigationTypeOther) self.acceptsNavigation = YES;
    handler(allowed ? WKNavigationActionPolicyAllow : WKNavigationActionPolicyCancel);
    if (!allowed) [self setStatus:@"error" message:@"此链接无法在网页面板中打开"];
}
- (void)webView:(WKWebView *)webView didStartProvisionalNavigation:(WKNavigation *)navigation {
    if (!self.acceptsNavigation || [webView.URL.absoluteString isEqual:@"about:blank"]) return;
    self.navigation = navigation;
    if (![webView.URL.absoluteString isEqual:@"about:blank"]) [self setStatus:@"connecting" message:@"正在加载 AI 网页…"];
}
- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    if (navigation != self.navigation || ![self allowed:webView.URL]) return;
    self.hasPage = YES;
    NSURLComponents *display = [NSURLComponents componentsWithURL:webView.URL resolvingAgainstBaseURL:NO];
    display.fragment = nil; self.address = display.URL.absoluteString ?: @"";
    [self setStatus:@"loaded" message:@"AI 网页已打开；会话状态由 AI 软件展示"];
}
- (void)webView:(WKWebView *)webView didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    if (navigation != self.navigation) return;
    if (error.code != NSURLErrorCancelled) [self setStatus:@"error" message:@"加载失败，请检查地址后重试，或在浏览器打开"];
}
- (void)webView:(WKWebView *)webView didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    [self webView:webView didFailProvisionalNavigation:navigation withError:error];
}
- (WKWebView *)webView:(WKWebView *)webView createWebViewWithConfiguration:(WKWebViewConfiguration *)configuration
    forNavigationAction:(WKNavigationAction *)action windowFeatures:(WKWindowFeatures *)features {
    if ([self allowed:action.request.URL]) self.navigation = [webView loadRequest:[NSURLRequest requestWithURL:action.request.URL]]; return nil;
}
@end
