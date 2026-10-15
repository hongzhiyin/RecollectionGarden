#import <Foundation/Foundation.h>

@interface RuntimeHost : NSObject
@property(strong) NSTask *task;
@property(strong) NSPipe *lifetimePipe;
@property(strong) NSURL *baseURL;
@property(strong) NSString *logPath;
- (void)start:(void (^)(NSError *error))completion;
- (void)stop;
@end
