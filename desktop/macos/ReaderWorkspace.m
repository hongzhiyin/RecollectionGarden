#import "ReaderWorkspace.h"
#import "BrowserPane.h"

@interface ReaderWorkspace ()
@property(strong, readwrite) NSView *view;
@property(weak) WKWebView *reader;
@property(strong) BrowserPane *browser;
@property(nonatomic) BOOL open;
@property BOOL visible;
@end
@implementation ReaderWorkspace
- (instancetype)initWithReader:(WKWebView *)reader {
    if (!(self = [super init])) return nil;
    self.reader = reader; self.view = [[NSView alloc] initWithFrame:reader.frame];
    self.view.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    reader.frame = self.view.bounds; [self.view addSubview:reader];
    self.browser = [[BrowserPane alloc] initWithFrame:NSZeroRect]; self.browser.hidden = YES;
    [self.view addSubview:self.browser];
    __weak ReaderWorkspace *weakSelf = self;
    self.browser.onState = ^(NSDictionary *state) {
        ReaderWorkspace *workspace = weakSelf;
        workspace.browser.hidden = !(workspace.open && workspace.visible && workspace.browser.hasPage);
        NSData *data = [NSJSONSerialization dataWithJSONObject:state options:0 error:nil];
        NSString *json = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        [workspace.reader evaluateJavaScript:[NSString stringWithFormat:@"window.dispatchEvent(new CustomEvent('garden-external-state',{detail:%@}))",json] completionHandler:nil];
    };
    return self;
}
- (void)setOpen:(BOOL)open {
    _open = open; self.browser.hidden = !(open && self.visible && self.browser.hasPage);
    [self.reader evaluateJavaScript:[NSString stringWithFormat:@"window.dispatchEvent(new CustomEvent('garden-external-panel',{detail:%@}))",open ? @"true" : @"false"] completionHandler:nil];
}
- (void)userContentController:(WKUserContentController *)controller didReceiveScriptMessage:(WKScriptMessage *)message {
    WKSecurityOrigin *origin = message.frameInfo.securityOrigin;
    NSInteger trustedPort = [NSBundle.mainBundle.infoDictionary[@"RGVerificationProfile"] boolValue] ? 4331 : 4321;
    if (!message.frameInfo.mainFrame || ![origin.protocol isEqual:@"http"] || ![origin.host isEqual:@"127.0.0.1"]
        || origin.port != trustedPort || ![message.body isKindOfClass:NSDictionary.class]) return;
    NSDictionary *body = message.body; NSString *type = body[@"type"];
    if ([type isEqual:@"external.layout"]) {
        self.visible = [body[@"visible"] boolValue];
        if (self.visible) {
            for (NSString *key in @[@"x",@"y",@"width",@"height"]) if (![body[key] isKindOfClass:NSNumber.class] || !isfinite([body[key] doubleValue])) return;
            NSRect bounds = self.view.bounds;
            CGFloat x = MAX(0,[body[@"x"] doubleValue]), y = MAX(0,[body[@"y"] doubleValue]);
            CGFloat width = MAX(0,MIN([body[@"width"] doubleValue],bounds.size.width-x));
            CGFloat height = MAX(0,MIN([body[@"height"] doubleValue],bounds.size.height-y));
            self.browser.frame = NSMakeRect(x,bounds.size.height-y-height,width,height);
        }
        self.browser.hidden = !(self.visible && self.open && self.browser.hasPage);
    } else if ([type isEqual:@"external.state"]) [self.browser report];
    else if ([type isEqual:@"external.toggle"]) {
        [self setOpen:body[@"open"] ? [body[@"open"] boolValue] : !self.open];
        if (self.open) {
            if ([body[@"context"] isKindOfClass:NSDictionary.class]) [self.browser openContext:body[@"context"]];
            else [self.browser activate];
        } else [self.browser command:@"external.close" address:nil];
    } else {
        if ([type isEqual:@"external.navigate"]) [self setOpen:YES];
        if ([type isEqual:@"external.close"]) [self setOpen:NO];
        [self.browser command:type address:[body[@"address"] isKindOfClass:NSString.class] ? body[@"address"] : @""];
    }
}
@end
