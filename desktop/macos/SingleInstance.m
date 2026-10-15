#import "SingleInstance.h"
#import <sys/file.h>
#import <fcntl.h>
#import <unistd.h>
#import <errno.h>

NSString *GardenReopenNotification(void) {
    return [NSBundle.mainBundle.bundleIdentifier stringByAppendingString:@".showWindow"];
}

static void ActivateExistingInstance(void) {
    for (NSRunningApplication *app in [NSRunningApplication runningApplicationsWithBundleIdentifier:NSBundle.mainBundle.bundleIdentifier]) {
        if (app.processIdentifier == NSProcessInfo.processInfo.processIdentifier) continue;
        [app unhide]; [app activateWithOptions:NSApplicationActivateAllWindows | NSApplicationActivateIgnoringOtherApps];
    }
    [NSDistributedNotificationCenter.defaultCenter postNotificationName:GardenReopenNotification()
        object:nil userInfo:nil deliverImmediately:YES];
}

BOOL ClaimGardenInstance(NSError **error) {
    NSString *support = [NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory, NSUserDomainMask, YES).firstObject
        stringByAppendingPathComponent:@"RecollectionGarden"];
    if (![NSFileManager.defaultManager createDirectoryAtPath:support withIntermediateDirectories:YES
        attributes:@{NSFilePosixPermissions:@0700} error:error]) return NO;
    NSString *path = [support stringByAppendingPathComponent:[NSBundle.mainBundle.bundleIdentifier stringByAppendingString:@".lock"]];
    int fd = open(path.fileSystemRepresentation, O_CREAT | O_RDWR | O_CLOEXEC, 0600);
    if (fd < 0 || flock(fd, LOCK_EX | LOCK_NB) != 0) {
        int code = errno; if (fd >= 0) close(fd);
        if (code == EWOULDBLOCK) ActivateExistingInstance();
        else if (error) *error = [NSError errorWithDomain:NSPOSIXErrorDomain code:code userInfo:nil];
        return NO;
    }
    // Earlier releases have no lock; let their existing window own the service until they quit.
    for (NSRunningApplication *app in [NSRunningApplication runningApplicationsWithBundleIdentifier:NSBundle.mainBundle.bundleIdentifier]) {
        if (app.processIdentifier == NSProcessInfo.processInfo.processIdentifier || app.terminated) continue;
        NSDictionary *info = [NSDictionary dictionaryWithContentsOfURL:[app.bundleURL URLByAppendingPathComponent:@"Contents/Info.plist"]];
        if ([info[@"RGSingleInstance"] boolValue]) continue;
        close(fd); ActivateExistingInstance(); return NO;
    }
    // Held for the application lifetime. O_CLOEXEC keeps the child runtime from inheriting it.
    return YES;
}
