// MailWave – Bootstrap-Updater
// -----------------------------------------------------------------------------
// Liegt neben MailWave.exe im Installationsordner. Die App lädt bei einem
// Update das neue Setup herunter, kopiert diesen Updater in einen Temp-Ordner
// und startet ihn dort:
//
//   Updater.exe --setup "<neues Setup>.exe" --wait <pid> --launch "<MailWave.exe>"
//
// Ablauf: auf Beenden der App warten -> Setup still ausführen (/S /update)
//         -> App neu starten -> Setup-Datei aufräumen.
//
// Kompiliert mit csc.exe (im .NET Framework auf jedem Windows enthalten).

using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Windows.Forms;

internal static class Updater
{
    [STAThread]
    private static int Main(string[] rawArgs)
    {
        var args = ParseArgs(rawArgs);
        string setup = Get(args, "setup");
        string launch = Get(args, "launch");
        int waitPid = -1;
        int.TryParse(Get(args, "wait"), out waitPid);

        if (string.IsNullOrEmpty(setup) || !File.Exists(setup))
        {
            Fail("Aktualisierungspaket wurde nicht gefunden.");
            return 2;
        }

        WaitForExit(waitPid, TimeSpan.FromSeconds(30));

        // Kurzer Puffer, damit Dateisperren wirklich frei sind.
        Thread.Sleep(800);

        try
        {
            var psi = new ProcessStartInfo(setup, "/S /update")
            {
                UseShellExecute = true,
                WindowStyle = ProcessWindowStyle.Hidden
            };
            var p = Process.Start(psi);
            p.WaitForExit();
            if (p.ExitCode != 0)
            {
                Fail("Die Aktualisierung ist fehlgeschlagen (Code " + p.ExitCode + ").");
                return p.ExitCode;
            }
        }
        catch (Exception ex)
        {
            Fail("Die Aktualisierung ist fehlgeschlagen:\n" + ex.Message);
            return 3;
        }

        if (!string.IsNullOrEmpty(launch) && File.Exists(launch))
        {
            try
            {
                Process.Start(new ProcessStartInfo(launch) { UseShellExecute = true });
            }
            catch { /* Neustart ist optional */ }
        }

        TryCleanup(setup);
        return 0;
    }

    private static void WaitForExit(int pid, TimeSpan timeout)
    {
        if (pid <= 0) return;
        try
        {
            var proc = Process.GetProcessById(pid);
            proc.WaitForExit((int)timeout.TotalMilliseconds);
        }
        catch (ArgumentException) { /* schon beendet */ }
        catch { /* egal – wir versuchen es trotzdem */ }
    }

    private static void TryCleanup(string setup)
    {
        try
        {
            File.Delete(setup);
            string dir = Path.GetDirectoryName(setup);
            if (!string.IsNullOrEmpty(dir) &&
                dir.IndexOf("mailwave-update", StringComparison.OrdinalIgnoreCase) >= 0 &&
                Directory.Exists(dir) && Directory.GetFileSystemEntries(dir).Length == 0)
            {
                Directory.Delete(dir);
            }
        }
        catch { /* Temp wird ohnehin irgendwann aufgeräumt */ }
    }

    private static void Fail(string message)
    {
        MessageBox.Show(message, "MailWave – Aktualisierung",
            MessageBoxButtons.OK, MessageBoxIcon.Warning);
    }

    private static System.Collections.Generic.Dictionary<string, string> ParseArgs(string[] a)
    {
        var map = new System.Collections.Generic.Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < a.Length; i++)
        {
            if (!a[i].StartsWith("--")) continue;
            string key = a[i].Substring(2);
            string val = (i + 1 < a.Length && !a[i + 1].StartsWith("--")) ? a[++i] : "true";
            map[key] = val;
        }
        return map;
    }

    private static string Get(System.Collections.Generic.Dictionary<string, string> m, string k)
    {
        string v;
        return m.TryGetValue(k, out v) ? v : null;
    }
}
