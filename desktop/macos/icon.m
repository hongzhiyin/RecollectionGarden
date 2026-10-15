#import <AppKit/AppKit.h>
int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSString *folder = [NSString stringWithUTF8String:argv[1]];
        NSDictionary *sizes = @{@"icon_16x16":@16, @"icon_16x16@2x":@32, @"icon_32x32":@32, @"icon_32x32@2x":@64,
            @"icon_128x128":@128, @"icon_128x128@2x":@256, @"icon_256x256":@256,
            @"icon_256x256@2x":@512, @"icon_512x512":@512, @"icon_512x512@2x":@1024};
        for (NSString *name in sizes) {
            NSInteger size = [sizes[name] integerValue];
            NSBitmapImageRep *bitmap = [[NSBitmapImageRep alloc] initWithBitmapDataPlanes:NULL pixelsWide:size pixelsHigh:size
                bitsPerSample:8 samplesPerPixel:4 hasAlpha:YES isPlanar:NO colorSpaceName:NSCalibratedRGBColorSpace bytesPerRow:0 bitsPerPixel:0];
            [NSGraphicsContext saveGraphicsState]; NSGraphicsContext.currentContext = [NSGraphicsContext graphicsContextWithBitmapImageRep:bitmap];
            NSAffineTransform *scale = [NSAffineTransform transform]; [scale scaleBy:size / 100.0]; [scale concat];
            [[NSColor colorWithRed:.95 green:.93 blue:.89 alpha:1] setFill];
            [[NSBezierPath bezierPathWithRoundedRect:NSMakeRect(4,4,92,92) xRadius:21 yRadius:21] fill];
            [[NSColor colorWithRed:.43 green:.35 blue:.46 alpha:1] setStroke];
            NSBezierPath *book = [NSBezierPath bezierPath]; book.lineWidth = 3.5; book.lineJoinStyle = NSLineJoinStyleRound;
            [book moveToPoint:NSMakePoint(50,26)]; [book curveToPoint:NSMakePoint(22,28) controlPoint1:NSMakePoint(40,33) controlPoint2:NSMakePoint(30,33)];
            [book lineToPoint:NSMakePoint(22,70)]; [book curveToPoint:NSMakePoint(50,68) controlPoint1:NSMakePoint(31,75) controlPoint2:NSMakePoint(41,75)];
            [book curveToPoint:NSMakePoint(78,70) controlPoint1:NSMakePoint(59,75) controlPoint2:NSMakePoint(69,75)];
            [book lineToPoint:NSMakePoint(78,28)]; [book curveToPoint:NSMakePoint(50,26) controlPoint1:NSMakePoint(70,33) controlPoint2:NSMakePoint(60,33)];
            [book lineToPoint:NSMakePoint(50,68)]; [book stroke];
            [NSGraphicsContext restoreGraphicsState];
            NSData *png = [bitmap representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
            [png writeToFile:[folder stringByAppendingPathComponent:[name stringByAppendingString:@".png"]] atomically:YES];
        }
    } return 0;
}
