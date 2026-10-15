#import "ReaderWorkspace.h"
#import "BrowserPane.h"

@interface ReaderWorkspace ()
@property(strong, readwrite) NSSplitView *view;
@property(weak) WKWebView *reader;
@property(strong) BrowserPane *browser;
@property BOOL changing;
@property CGFloat ratio;
@end

@implementation ReaderWorkspace
- (instancetype)initWithReader:(WKWebView *)reader {
    if (!(self = [super init])) return nil;
    self.reader = reader;
    self.view = [[NSSplitView alloc] initWithFrame:reader.frame];
    self.view.vertical = YES; self.view.dividerStyle = NSSplitViewDividerStyleThin;
    self.view.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    self.view.delegate = self;
    self.browser = [[BrowserPane alloc] initWithFrame:NSZeroRect];
    [self.view addSubview:reader]; [self.view addSubview:self.browser];
    self.browser.hidden = YES;
    self.ratio = [NSUserDefaults.standardUserDefaults doubleForKey:@"ReaderSplitRatio"];
    if (self.ratio < .3 || self.ratio > .75) self.ratio = .6;
    __weak ReaderWorkspace *weakSelf = self;
    self.browser.onClose = ^{ [weakSelf setOpen:NO]; };
    [self.view adjustSubviews];
    return self;
}
- (void)setOpen:(BOOL)open {
    self.changing = YES; self.browser.hidden = !open; [self.view adjustSubviews];
    if (open) [self.view setPosition:self.view.bounds.size.width * self.ratio ofDividerAtIndex:0];
    self.changing = NO;
    [self.reader evaluateJavaScript:[NSString stringWithFormat:
        @"window.dispatchEvent(new CustomEvent('garden-external-panel',{detail:%@}))", open ? @"true" : @"false"] completionHandler:nil];
    if (open) [self.browser activate];
}
- (void)userContentController:(WKUserContentController *)controller didReceiveScriptMessage:(WKScriptMessage *)message {
    WKSecurityOrigin *origin = message.frameInfo.securityOrigin;
    if (!message.frameInfo.mainFrame || ![origin.protocol isEqual:@"http"]
        || ![origin.host isEqual:@"127.0.0.1"] || origin.port != 4321 || ![message.body isKindOfClass:NSDictionary.class]) return;
    NSString *type = message.body[@"type"];
    if ([type isEqual:@"external.toggle"]) [self setOpen:self.browser.hidden];
    else if ([type isEqual:@"external.close"]) [self setOpen:NO];
}
- (CGFloat)splitView:(NSSplitView *)view constrainMinCoordinate:(CGFloat)value ofSubviewAt:(NSInteger)index { return 420; }
- (CGFloat)splitView:(NSSplitView *)view constrainMaxCoordinate:(CGFloat)value ofSubviewAt:(NSInteger)index { return view.bounds.size.width - 360; }
- (BOOL)splitView:(NSSplitView *)view shouldHideDividerAtIndex:(NSInteger)index { return self.browser.hidden; }
- (NSRect)splitView:(NSSplitView *)view additionalEffectiveRectOfDividerAtIndex:(NSInteger)index {
    return self.browser.hidden ? NSZeroRect : NSMakeRect(NSMaxX(self.reader.frame) - 4, 0, 9, view.bounds.size.height);
}
- (BOOL)splitView:(NSSplitView *)view canCollapseSubview:(NSView *)subview { return NO; }
- (void)splitViewDidResizeSubviews:(NSNotification *)notification {
    if (!self.changing && !self.browser.hidden && self.view.bounds.size.width > 0) {
        self.ratio = self.reader.frame.size.width / self.view.bounds.size.width;
        [NSUserDefaults.standardUserDefaults setDouble:self.ratio forKey:@"ReaderSplitRatio"];
    }
}
@end
