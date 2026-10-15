#import "BrowserPane.h"

@interface BrowserPane ()
@property(strong) WKWebView *web;
@property(strong) NSTextField *address;
@property(strong) NSTextField *status;
@property(strong) NSButton *back;
@property(strong) NSButton *forward;
@property BOOL activated;
@end

@implementation BrowserPane
- (instancetype)initWithFrame:(NSRect)frame {
    if (!(self = [super initWithFrame:frame])) return nil;
    self.wantsLayer = YES; self.layer.backgroundColor = NSColor.windowBackgroundColor.CGColor;
    WKWebViewConfiguration *configuration = [WKWebViewConfiguration new];
    configuration.websiteDataStore = [WKWebsiteDataStore dataStoreForIdentifier:
        [[NSUUID alloc] initWithUUIDString:@"09F5F8BB-0740-47CF-89CA-778B6058A02E"]];
    self.web = [[WKWebView alloc] initWithFrame:NSZeroRect configuration:configuration];
    self.web.navigationDelegate = self; self.web.UIDelegate = self;
    self.address = [NSTextField new]; self.address.placeholderString = @"输入 AI 对话网址";
    self.address.accessibilityLabel = @"AI 对话网址"; self.address.target = self; self.address.action = @selector(navigate:);
    self.status = [NSTextField wrappingLabelWithString:@"输入 DreamEdge 或其他 AI 工具的网址"];
    self.status.font = [NSFont systemFontOfSize:12]; self.status.textColor = NSColor.secondaryLabelColor;
    self.back = [self button:@"返回" action:@selector(goBack:)];
    self.forward = [self button:@"前进" action:@selector(goForward:)];
    NSStackView *navigation = [NSStackView stackViewWithViews:@[self.back, self.forward,
        [self button:@"刷新" action:@selector(reload:)], [self button:@"浏览器打开" action:@selector(openBrowser:)],
        [self button:@"关闭" action:@selector(close:)]]];
    NSStackView *location = [NSStackView stackViewWithViews:@[self.address, [self button:@"打开" action:@selector(navigate:)]]];
    for (NSView *view in @[navigation, location, self.status, self.web]) {
        view.translatesAutoresizingMaskIntoConstraints = NO; [self addSubview:view];
    }
    [self.address setContentHuggingPriority:1 forOrientation:NSLayoutConstraintOrientationHorizontal];
    [self.address setContentCompressionResistancePriority:1 forOrientation:NSLayoutConstraintOrientationHorizontal];
    navigation.spacing = 4; location.spacing = 6;
    [NSLayoutConstraint activateConstraints:@[
        [navigation.topAnchor constraintEqualToAnchor:self.topAnchor constant:12],
        [navigation.leadingAnchor constraintEqualToAnchor:self.leadingAnchor constant:10],
        [navigation.trailingAnchor constraintLessThanOrEqualToAnchor:self.trailingAnchor constant:-10],
        [location.topAnchor constraintEqualToAnchor:navigation.bottomAnchor constant:10],
        [location.leadingAnchor constraintEqualToAnchor:self.leadingAnchor constant:10],
        [location.trailingAnchor constraintEqualToAnchor:self.trailingAnchor constant:-10],
        [self.status.topAnchor constraintEqualToAnchor:location.bottomAnchor constant:8],
        [self.status.leadingAnchor constraintEqualToAnchor:self.leadingAnchor constant:12],
        [self.status.trailingAnchor constraintEqualToAnchor:self.trailingAnchor constant:-12],
        [self.web.topAnchor constraintEqualToAnchor:self.status.bottomAnchor constant:10],
        [self.web.leadingAnchor constraintEqualToAnchor:self.leadingAnchor],
        [self.web.trailingAnchor constraintEqualToAnchor:self.trailingAnchor],
        [self.web.bottomAnchor constraintEqualToAnchor:self.bottomAnchor]]];
    self.back.enabled = NO; self.forward.enabled = NO;
    return self;
}
- (NSButton *)button:(NSString *)title action:(SEL)action {
    NSButton *button = [NSButton buttonWithTitle:title target:self action:action];
    button.controlSize = NSControlSizeSmall; return button;
}
- (void)activate {
    if (!self.activated) {
        self.activated = YES;
        NSString *saved = [NSUserDefaults.standardUserDefaults stringForKey:@"ExternalBrowserURL"];
        if (saved.length) { self.address.stringValue = saved; [self navigate:nil]; }
    }
    [self.window makeFirstResponder:self.address];
}
- (BOOL)allowed:(NSURL *)url {
    return ([@[@"https", @"http"] containsObject:url.scheme.lowercaseString]) && url.host.length
        && !url.user.length && !url.password.length;
}
- (void)navigate:(id)sender {
    NSString *text = [self.address.stringValue stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
    if (![text containsString:@"://"]) text = [@"https://" stringByAppendingString:text];
    NSURL *url = [NSURL URLWithString:text];
    if (![self allowed:url]) { self.status.stringValue = @"请输入有效的 http 或 https 网址"; return; }
    [self.web loadRequest:[NSURLRequest requestWithURL:url]];
    NSURLComponents *site = [NSURLComponents componentsWithURL:url resolvingAgainstBaseURL:NO];
    site.path = @"/"; site.query = nil; site.fragment = nil;
    [NSUserDefaults.standardUserDefaults setObject:site.URL.absoluteString forKey:@"ExternalBrowserURL"];
}
- (void)goBack:(id)sender { [self.web goBack]; }
- (void)goForward:(id)sender { [self.web goForward]; }
- (void)reload:(id)sender { [self.web reload]; }
- (void)close:(id)sender { if (self.onClose) self.onClose(); }
- (void)openBrowser:(id)sender { if ([self allowed:self.web.URL]) [NSWorkspace.sharedWorkspace openURL:self.web.URL]; }
- (void)webView:(WKWebView *)webView decidePolicyForNavigationAction:(WKNavigationAction *)action
    decisionHandler:(void (^)(WKNavigationActionPolicy))decisionHandler {
    BOOL allowed = [self allowed:action.request.URL] || [action.request.URL.absoluteString isEqual:@"about:blank"];
    decisionHandler(allowed ? WKNavigationActionPolicyAllow : WKNavigationActionPolicyCancel);
    if (!allowed) self.status.stringValue = @"此链接无法在网页面板中打开";
}
- (void)webView:(WKWebView *)webView didStartProvisionalNavigation:(WKNavigation *)navigation {
    self.status.stringValue = @"正在加载…";
}
- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    self.address.stringValue = webView.URL.absoluteString ?: @"";
    self.back.enabled = webView.canGoBack; self.forward.enabled = webView.canGoForward;
    self.status.stringValue = webView.title.length ? webView.title : @"页面已打开";

}
- (void)webView:(WKWebView *)webView didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    if (error.code != NSURLErrorCancelled) self.status.stringValue = @"加载失败，请检查网址或刷新；登录受限时可在浏览器打开";
}
- (void)webView:(WKWebView *)webView didFailNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    [self webView:webView didFailProvisionalNavigation:navigation withError:error];
}
- (WKWebView *)webView:(WKWebView *)webView createWebViewWithConfiguration:(WKWebViewConfiguration *)configuration
    forNavigationAction:(WKNavigationAction *)action windowFeatures:(WKWindowFeatures *)features {
    if ([self allowed:action.request.URL]) [webView loadRequest:action.request];
    return nil;
}
@end
