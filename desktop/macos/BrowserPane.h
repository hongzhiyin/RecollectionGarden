#import <AppKit/AppKit.h>
#import <WebKit/WebKit.h>

@interface BrowserPane : NSView <WKNavigationDelegate, WKUIDelegate>
@property(copy) void (^onClose)(void);
- (void)activate;
@end
