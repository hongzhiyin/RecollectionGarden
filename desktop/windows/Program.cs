namespace RecollectionGarden;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        var suffix = args.FirstOrDefault() == "--verify" ? ".Verification" : "";
        using var reopen = new EventWaitHandle(false, EventResetMode.AutoReset, "Local\\RecollectionGarden.Reopen" + suffix);
        using var mutex = new Mutex(false, "Local\\RecollectionGarden.Desktop" + suffix);
        bool acquired;
        try { acquired = mutex.WaitOne(0); }
        catch (AbandonedMutexException) { acquired = true; }
        if (!acquired) { reopen.Set(); return; }
        try
        {
            using var window = new MainWindow(args);
            window.CreateControl();
            var waiter = ThreadPool.RegisterWaitForSingleObject(reopen, (_, _) =>
            {
                if (!window.IsDisposed && window.IsHandleCreated)
                    window.BeginInvoke(() => { window.Show(); window.WindowState = FormWindowState.Normal; window.Activate(); });
            }, null, Timeout.Infinite, false);
            try { Application.Run(window); }
            finally { waiter.Unregister(null); }
        }
        finally { mutex.ReleaseMutex(); }
    }
}
