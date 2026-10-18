#import <AppKit/AppKit.h>
#import <WebKit/WebKit.h>
@interface ReaderWorkspace : NSObject <WKScriptMessageHandler>
@property(strong, readonly) NSView *view;
- (instancetype)initWithReader:(WKWebView *)reader;
@end
