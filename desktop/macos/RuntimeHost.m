#import "RuntimeHost.h"

@implementation RuntimeHost
- (instancetype)init {
    if ((self = [super init])) self.baseURL = [NSURL URLWithString:@"http://127.0.0.1:4321/"];
    return self;
}
- (void)start:(void (^)(NSError *))completion {
    NSString *resources = NSBundle.mainBundle.resourcePath;
    NSString *support = [NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory, NSUserDomainMask, YES).firstObject
        stringByAppendingPathComponent:[NSBundle.mainBundle.infoDictionary[@"RGVerificationProfile"] boolValue]
            ? @"RecollectionGarden/DesktopQA" : @"RecollectionGarden/Desktop"];
    NSError *error = nil;
    [NSFileManager.defaultManager createDirectoryAtPath:support withIntermediateDirectories:YES attributes:@{NSFilePosixPermissions:@0700} error:&error];
    if (error) { completion(error); return; }
    self.logPath = [support stringByAppendingPathComponent:@"desktop.log"];
    if (![NSFileManager.defaultManager fileExistsAtPath:self.logPath])
        [NSFileManager.defaultManager createFileAtPath:self.logPath contents:nil attributes:@{NSFilePosixPermissions:@0600}];
    NSFileHandle *log = [NSFileHandle fileHandleForWritingAtPath:self.logPath]; [log seekToEndOfFile];
    self.task = [NSTask new];
    self.task.executableURL = [NSURL fileURLWithPath:[resources stringByAppendingPathComponent:@"runtime/node"]];
    self.task.arguments = @[[resources stringByAppendingPathComponent:@"app/desktop/runtime/entry.mjs"], @"serve"];
    self.task.currentDirectoryURL = [NSURL fileURLWithPath:[resources stringByAppendingPathComponent:@"app"]];
    self.task.standardOutput = log; self.task.standardError = log;
    self.lifetimePipe = [NSPipe pipe]; self.task.standardInput = self.lifetimePipe;
    NSMutableDictionary *environment = [NSProcessInfo.processInfo.environment mutableCopy];
    for (NSString *key in @[@"NODE_OPTIONS", @"NODE_PATH", @"RG_BRIDGE_CONFIG", @"RG_DESKTOP_UI_PORT", @"RG_DESKTOP_BRIDGE_PORT"])
        [environment removeObjectForKey:key];
    environment[@"RG_DESKTOP_DATA_DIR"] = support;
    environment[@"RG_DESKTOP_MANAGED"] = @"1";
    self.task.environment = environment;
    if (![self.task launchAndReturnError:&error]) { completion(error); return; }
    [self waitForReady:150 completion:completion];
}
- (void)waitForReady:(NSInteger)remaining completion:(void (^)(NSError *))completion {
    if (!self.task.running || remaining <= 0) {
        completion([NSError errorWithDomain:@"RecollectionGarden" code:1 userInfo:@{NSLocalizedDescriptionKey:
            [@"本地服务未能启动。请关闭其他桌面体验版本后重试。日志：" stringByAppendingString:self.logPath ?: @""]}]); return;
    }
    NSURL *url = [self.baseURL URLByAppendingPathComponent:@"__rg_experience"];
    NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url]; request.timeoutInterval = 1;
    [[[NSURLSession sharedSession] dataTaskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        NSDictionary *info = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
        dispatch_async(dispatch_get_main_queue(), ^{
            if ([info[@"app"] isEqual:@"RecollectionGarden"] && [info[@"ready"] boolValue]
                && [info[@"pid"] intValue] == self.task.processIdentifier) completion(nil);
            else dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 100 * NSEC_PER_MSEC), dispatch_get_main_queue(),
                ^{ [self waitForReady:remaining - 1 completion:completion]; });
        });
    }] resume];
}
- (void)stop {
    [self.lifetimePipe.fileHandleForWriting closeFile]; self.lifetimePipe = nil;
    if (self.task.running) [self.task terminate];
    NSDate *deadline = [NSDate dateWithTimeIntervalSinceNow:3.5];
    while (self.task.running && deadline.timeIntervalSinceNow > 0) [NSThread sleepForTimeInterval:0.02];
}
@end
