#import <AppKit/AppKit.h>
@interface ExternalConversation : NSObject
- (BOOL)configured;
- (BOOL)configure;
- (void)openContext:(NSDictionary *)context completion:(void (^)(NSURL *, NSString *))completion;
@end
