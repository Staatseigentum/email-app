// Harmloses Ersatz-Setup und Ersatz-MailWave für bootstrap-smoke.ps1.
using System;
using System.IO;

internal static class BootstrapFixture
{
    private static int Main(string[] args)
    {
#if SETUP
        string target = null;
        bool silent = false;
        bool update = false;
        foreach (string arg in args)
        {
            if (arg.Equals("/S", StringComparison.OrdinalIgnoreCase)) silent = true;
            if (arg.Equals("/update", StringComparison.OrdinalIgnoreCase)) update = true;
            if (arg.StartsWith("/D=", StringComparison.OrdinalIgnoreCase)) target = arg.Substring(3);
        }
        if (!silent || !update || string.IsNullOrEmpty(target)) return 10;
        string resources = Path.Combine(target, "resources");
        Directory.CreateDirectory(resources);
        File.WriteAllText(Path.Combine(resources, "mailwave-version.txt"), "9.9.9\n");
        File.WriteAllText(Path.Combine(target, "setup-args.txt"), string.Join("|", args));
#else
        File.WriteAllText(Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "launch-ok.txt"), "started");
#endif
        return 0;
    }
}
