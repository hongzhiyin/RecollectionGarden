#import <AppKit/AppKit.h>
#import <WebKit/WebKit.h>

@interface ReaderWorkspace : NSObject <WKScriptMessageHandler, NSSplitViewDelegate>
@property(strong, readonly) NSSplitView *view;
- (instancetype)initWithReader:(WKWebView *)reader;
@end
