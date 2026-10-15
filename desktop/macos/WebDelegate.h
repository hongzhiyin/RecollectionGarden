#import <AppKit/AppKit.h>
#import <WebKit/WebKit.h>

@interface WebDelegate : NSObject <WKUIDelegate, WKNavigationDelegate, WKDownloadDelegate>
@property(weak) NSWindow *window;
@property(strong) NSMapTable<WKDownload *, NSDictionary *> *downloads;
@end
