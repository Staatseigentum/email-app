// MailWave – Bootstrap-Updater
// -----------------------------------------------------------------------------
// Liegt neben MailWave.exe im Installationsordner. Die App lädt bei einem
// Update das neue Setup herunter, kopiert diesen Updater in einen Temp-Ordner
// und startet ihn dort:
//
//   Updater.exe --setup "<neues Setup>.exe" --wait <pid> --launch "<MailWave.exe>" --version x.y.z
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
        string expectedVersion = Get(args, "version");
        int waitPid = -1;
        int.TryParse(Get(args, "wait"), out waitPid);

        if (string.IsNullOrEmpty(setup) || !File.Exists(setup) ||
            string.IsNullOrEmpty(launch) || !File.Exists(launch))
        {
            Fail("Aktualisierungspaket oder installierte MailWave-App wurde nicht gefunden.");
            return 2;
        }

        if (!WaitForExit(waitPid, TimeSpan.FromSeconds(90)))
        {
            Fail("MailWave konnte nicht beendet werden. Die Aktualisierung wurde abgebrochen.");
            return 4;
        }

        // Kurzer Puffer, damit Dateisperren wirklich frei sind.
        Thread.Sleep(800);

        try
        {
            string installDir = Path.GetDirectoryName(Path.GetFullPath(launch));
            var psi = new ProcessStartInfo(setup, "/S /update /D=\"" + installDir + "\"")
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden,
                WorkingDirectory = Path.GetDirectoryName(setup)
            };
            using (var p = Process.Start(psi))
            {
                if (p == null) throw new InvalidOperationException("Setup konnte nicht gestartet werden.");
                p.WaitForExit();
                if (p.ExitCode != 0)
                {
                    Fail("Die Aktualisierung ist fehlgeschlagen (Code " + p.ExitCode + ").");
                    TryLaunch(launch);
                    return p.ExitCode;
                }
            }

            if (!string.IsNullOrEmpty(expectedVersion))
            {
                string versionFile = Path.Combine(installDir, "resources", "mailwave-version.txt");
                string installedVersion = File.Exists(versionFile)
                    ? File.ReadAllText(versionFile).Trim() : "";
                if (!expectedVersion.Equals(installedVersion, StringComparison.OrdinalIgnoreCase))
                {
                    Fail("Die Installation wurde nicht am erwarteten Ort abgeschlossen. " +
                         "MailWave bitte manuell aktualisieren.");
                    TryLaunch(launch);
                    return 6;
                }
            }
        }
        catch (Exception ex)
        {
            Fail("Die Aktualisierung ist fehlgeschlagen:\n" + ex.Message);
            TryLaunch(launch);
            return 3;
        }

        if (!TryLaunch(launch))
        {
            Fail("Die Aktualisierung wurde installiert, aber MailWave konnte nicht neu " +
                 "gestartet werden. Bitte die App manuell öffnen.");
            return 5;
        }

        TryCleanup(setup);
        return 0;
    }

    private static bool WaitForExit(int pid, TimeSpan timeout)
    {
        if (pid <= 0) return false;
        try
        {
            using (var proc = Process.GetProcessById(pid))
                return proc.WaitForExit((int)timeout.TotalMilliseconds);
        }
        catch (ArgumentException) { return true; /* schon beendet */ }
        catch { return false; }
    }

    private static bool TryLaunch(string launch)
    {
        try
        {
            if (!File.Exists(launch)) return false;
            var psi = new ProcessStartInfo(launch)
            {
                UseShellExecute = true,
                WorkingDirectory = Path.GetDirectoryName(Path.GetFullPath(launch))
            };
            return Process.Start(psi) != null;
        }
        catch { return false; }
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
