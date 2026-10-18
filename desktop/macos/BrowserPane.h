#import <AppKit/AppKit.h>
#import <WebKit/WebKit.h>

@interface BrowserPane : NSView <WKNavigationDelegate, WKUIDelegate>
@property(copy) void (^onState)(NSDictionary *);
@property(readonly) BOOL hasPage;
- (void)activate;
- (void)openContext:(NSDictionary *)context;
- (void)command:(NSString *)action address:(NSString *)address;
- (void)report;
@end
