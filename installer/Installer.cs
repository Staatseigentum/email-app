// MailWave – Setup
// -----------------------------------------------------------------------------
// Eigenständiger Installer ohne electron-builder / NSIS / Inno.
// In die EXE eingebettet:  payload.zip  (die gepackte App),  icon.ico,  Uninstall.exe
//
//   MailWave-Setup-x.y.z.exe            grafische Installation (pro Benutzer, ohne Admin)
//   MailWave-Setup-x.y.z.exe /S         stille Installation (vom Bootstrap-Updater)
//   MailWave-Setup-x.y.z.exe /S /update stille Aktualisierung (kein Autostart der App)
//   MailWave-Setup-x.y.z.exe /D=C:\Pfad Zielordner vorgeben
//
// Kompiliert mit csc.exe (.NET Framework, auf jedem Windows vorhanden).

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class Installer
{
    private const string Product = "MailWave";
    private const string Publisher = "Marco Ebner";
    private const string AppId = "de.marcoebner.mailwave";
    private const string AboutUrl = "https://staatseigentum.github.io/email-app/";
    private const string Version = "__VERSION__"; // wird beim Build ersetzt

    private static bool _silent;
    private static bool _updateMode;

    [STAThread]
    private static int Main(string[] args)
    {
        string forcedDir = null;
        foreach (var a in args)
        {
            if (a.Equals("/S", StringComparison.OrdinalIgnoreCase)) _silent = true;
            else if (a.Equals("/update", StringComparison.OrdinalIgnoreCase)) _updateMode = true;
            else if (a.StartsWith("/D=", StringComparison.OrdinalIgnoreCase)) forcedDir = a.Substring(3);
        }

        string defaultDir = forcedDir ?? DefaultInstallDir();

        if (_silent)
        {
            try
            {
                RunInstall(defaultDir, desktopShortcut: File.Exists(DesktopLnk()), report: null);
                return 0;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine(ex);
                return 1;
            }
        }

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        Application.Run(new SetupForm(defaultDir));
        return 0;
    }

    // ---------------------------------------------------------------- Installation

    public static void RunInstall(string targetDir, bool desktopShortcut, Action<int, string> report)
    {
        Report(report, 0, "Vorbereiten …");
        CloseRunningApp();

        Directory.CreateDirectory(targetDir);

        // 1) Payload entpacken
        var asm = Assembly.GetExecutingAssembly();
        using (var zipStream = asm.GetManifestResourceStream("payload.zip"))
        using (var archive = new ZipArchive(zipStream, ZipArchiveMode.Read))
        {
            var entries = archive.Entries.Where(e => e.Length > 0 || !e.FullName.EndsWith("/")).ToList();
            int done = 0;
            foreach (var entry in entries)
            {
                string dest = Path.Combine(targetDir, entry.FullName.Replace('/', Path.DirectorySeparatorChar));
                Directory.CreateDirectory(Path.GetDirectoryName(dest));
                if (!entry.FullName.EndsWith("/"))
                {
                    ExtractWithRetry(entry, dest);
                }
                done++;
                if ((done & 15) == 0 || done == entries.Count)
                    Report(report, 5 + (int)(80.0 * done / entries.Count),
                        "Dateien werden kopiert … (" + done + "/" + entries.Count + ")");
            }
        }

        // 2) Icon + Uninstaller ablegen
        Report(report, 88, "Verknüpfungen werden erstellt …");
        string icoPath = Path.Combine(targetDir, "app.ico");
        WriteResource("icon.ico", icoPath);
        string uninstall = Path.Combine(targetDir, "Uninstall.exe");
        WriteResource("Uninstall.exe", uninstall);

        string exePath = Path.Combine(targetDir, Product + ".exe");

        // 3) Verknüpfungen
        CreateShortcut(StartMenuLnk(), exePath, targetDir, icoPath, "Moderner E-Mail-Client");
        if (desktopShortcut) CreateShortcut(DesktopLnk(), exePath, targetDir, icoPath, "Moderner E-Mail-Client");
        else TryDelete(DesktopLnk());

        // 4) Registry: Uninstall-Eintrag + App-Info
        Report(report, 94, "Registrierung …");
        long sizeKb = DirectorySize(targetDir) / 1024;
        using (var k = Registry.CurrentUser.CreateSubKey(
            @"Software\Microsoft\Windows\CurrentVersion\Uninstall\MailWave"))
        {
            k.SetValue("DisplayName", Product);
            k.SetValue("DisplayVersion", Version);
            k.SetValue("Publisher", Publisher);
            k.SetValue("DisplayIcon", icoPath);
            k.SetValue("InstallLocation", targetDir);
            k.SetValue("UninstallString", "\"" + uninstall + "\"");
            k.SetValue("QuietUninstallString", "\"" + uninstall + "\" /S");
            k.SetValue("URLInfoAbout", AboutUrl);
            k.SetValue("NoModify", 1, RegistryValueKind.DWord);
            k.SetValue("NoRepair", 1, RegistryValueKind.DWord);
            k.SetValue("EstimatedSize", (int)sizeKb, RegistryValueKind.DWord);
        }
        using (var k = Registry.CurrentUser.CreateSubKey(@"Software\MailWave"))
        {
            k.SetValue("InstallDir", targetDir);
            k.SetValue("Version", Version);
            k.SetValue("AppUserModelId", AppId);
        }

        Report(report, 100, "Fertig.");
    }

    private static void ExtractWithRetry(ZipArchiveEntry entry, string dest)
    {
        for (int attempt = 0; ; attempt++)
        {
            try
            {
                using (var src = entry.Open())
                using (var outFile = new FileStream(dest, FileMode.Create, FileAccess.Write, FileShare.None))
                    src.CopyTo(outFile);
                return;
            }
            catch (IOException)
            {
                if (attempt >= 15) throw;
                Thread.Sleep(300); // Datei evtl. noch gesperrt (App fährt herunter)
            }
        }
    }

    // ---------------------------------------------------------------- Helfer

    private static void Report(Action<int, string> report, int pct, string msg)
    {
        if (report != null) report(pct, msg);
    }

    private static string DefaultInstallDir()
    {
        string existing = null;
        try
        {
            using (var k = Registry.CurrentUser.OpenSubKey(@"Software\MailWave"))
                if (k != null) existing = k.GetValue("InstallDir") as string;
        }
        catch { }
        if (!string.IsNullOrEmpty(existing)) return existing;

        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        return Path.Combine(local, "Programs", Product);
    }

    private static string StartMenuLnk()
    {
        return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), Product + ".lnk");
    }

    private static string DesktopLnk()
    {
        return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), Product + ".lnk");
    }

    private static void WriteResource(string name, string dest)
    {
        var asm = Assembly.GetExecutingAssembly();
        using (var s = asm.GetManifestResourceStream(name))
        {
            if (s == null) throw new InvalidOperationException("Ressource fehlt: " + name);
            for (int attempt = 0; ; attempt++)
            {
                try
                {
                    using (var f = new FileStream(dest, FileMode.Create, FileAccess.Write, FileShare.None))
                        s.CopyTo(f);
                    return;
                }
                catch (IOException)
                {
                    if (attempt >= 15) throw;
                    s.Position = 0;
                    Thread.Sleep(300);
                }
            }
        }
    }

    private static void CreateShortcut(string lnkPath, string target, string workDir, string icon, string desc)
    {
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(lnkPath));
            Type shellType = Type.GetTypeFromProgID("WScript.Shell");
            object shell = Activator.CreateInstance(shellType);
            object lnk = shellType.InvokeMember("CreateShortcut",
                BindingFlags.InvokeMethod, null, shell, new object[] { lnkPath });
            Type lnkType = lnk.GetType();
            SetProp(lnkType, lnk, "TargetPath", target);
            SetProp(lnkType, lnk, "WorkingDirectory", workDir);
            SetProp(lnkType, lnk, "IconLocation", icon + ",0");
            SetProp(lnkType, lnk, "Description", desc);
            lnkType.InvokeMember("Save", BindingFlags.InvokeMethod, null, lnk, null);
        }
        catch { /* Verknüpfung ist nice-to-have */ }
    }

    private static void SetProp(Type t, object o, string name, object value)
    {
        t.InvokeMember(name, BindingFlags.SetProperty, null, o, new[] { value });
    }

    private static void CloseRunningApp()
    {
        foreach (var name in new[] { Product, "MailWave" })
        {
            try
            {
                foreach (var p in Process.GetProcessesByName(name))
                {
                    try { p.CloseMainWindow(); } catch { }
                    if (!p.WaitForExit(4000)) { try { p.Kill(); } catch { } }
                }
            }
            catch { }
        }
    }

    private static long DirectorySize(string dir)
    {
        long total = 0;
        foreach (var f in Directory.GetFiles(dir, "*", SearchOption.AllDirectories))
        {
            try { total += new FileInfo(f).Length; } catch { }
        }
        return total;
    }

    private static void TryDelete(string path)
    {
        try { if (File.Exists(path)) File.Delete(path); } catch { }
    }

    public static string LaunchTargetFor(string dir)
    {
        return Path.Combine(dir, Product + ".exe");
    }

    public static bool UpdateMode { get { return _updateMode; } }

    // ---------------------------------------------------------------- UI

    private sealed class SetupForm : Form
    {
        private readonly TextBox _path;
        private readonly CheckBox _desktop;
        private readonly CheckBox _launch;
        private readonly ProgressBar _bar;
        private readonly Label _status;
        private readonly Button _action;
        private bool _installed;

        public SetupForm(string defaultDir)
        {
            Text = Product + " einrichten";
            FormBorderStyle = FormBorderStyle.FixedDialog;
            StartPosition = FormStartPosition.CenterScreen;
            MaximizeBox = false;
            MinimizeBox = false;
            ClientSize = new Size(500, 300);
            BackColor = Color.White;
            Font = new Font("Segoe UI", 9f);

            try
            {
                using (var s = Assembly.GetExecutingAssembly().GetManifestResourceStream("icon.ico"))
                    if (s != null) Icon = new Icon(s);
            }
            catch { }

            var header = new PictureBox
            {
                Location = new Point(24, 22),
                Size = new Size(48, 48),
                SizeMode = PictureBoxSizeMode.Zoom
            };
            try
            {
                using (var s = Assembly.GetExecutingAssembly().GetManifestResourceStream("icon.ico"))
                    if (s != null) header.Image = new Icon(s, 48, 48).ToBitmap();
            }
            catch { }

            var title = new Label
            {
                Text = Product,
                Location = new Point(84, 24),
                Size = new Size(390, 24),
                Font = new Font("Segoe UI Semibold", 13f)
            };
            var sub = new Label
            {
                Text = "Version " + Version + "  ·  Installation für den aktuellen Benutzer (ohne Administrator)",
                Location = new Point(86, 50),
                Size = new Size(400, 18),
                ForeColor = Color.Gray
            };

            var pathLabel = new Label
            {
                Text = "Installationsordner",
                Location = new Point(24, 96),
                Size = new Size(300, 18),
                ForeColor = Color.DimGray
            };
            _path = new TextBox
            {
                Text = defaultDir,
                Location = new Point(24, 116),
                Size = new Size(360, 24)
            };
            var browse = new Button
            {
                Text = "Durchsuchen …",
                Location = new Point(392, 115),
                Size = new Size(84, 26)
            };
            browse.Click += (s, e) =>
            {
                using (var d = new FolderBrowserDialog())
                {
                    d.Description = "Installationsordner wählen";
                    d.SelectedPath = _path.Text;
                    if (d.ShowDialog() == DialogResult.OK)
                        _path.Text = Path.Combine(d.SelectedPath, Product);
                }
            };

            _desktop = new CheckBox
            {
                Text = "Verknüpfung auf dem Desktop anlegen",
                Location = new Point(24, 154),
                Size = new Size(400, 22),
                Checked = true
            };
            _launch = new CheckBox
            {
                Text = Product + " nach der Installation starten",
                Location = new Point(24, 178),
                Size = new Size(400, 22),
                Checked = true
            };

            _bar = new ProgressBar
            {
                Location = new Point(24, 214),
                Size = new Size(452, 16),
                Style = ProgressBarStyle.Continuous
            };
            _status = new Label
            {
                Text = "",
                Location = new Point(24, 234),
                Size = new Size(452, 18),
                ForeColor = Color.Gray
            };

            _action = new Button
            {
                Text = "Installieren",
                Location = new Point(366, 258),
                Size = new Size(110, 30),
                DialogResult = DialogResult.None
            };
            _action.Click += OnAction;

            var cancel = new Button
            {
                Text = "Abbrechen",
                Location = new Point(280, 258),
                Size = new Size(80, 30)
            };
            cancel.Click += (s, e) => Close();

            Controls.AddRange(new Control[]
            {
                header, title, sub, pathLabel, _path, browse,
                _desktop, _launch, _bar, _status, _action, cancel
            });
            AcceptButton = _action;
        }

        private void OnAction(object sender, EventArgs e)
        {
            if (_installed)
            {
                if (_launch.Checked) LaunchApp();
                Close();
                return;
            }

            _action.Enabled = false;
            _path.Enabled = false;
            string target = _path.Text.Trim();
            bool desktop = _desktop.Checked;

            var worker = new Thread(() =>
            {
                try
                {
                    RunInstall(target, desktop, (pct, msg) =>
                        BeginInvoke((Action)(() => { _bar.Value = Math.Min(100, pct); _status.Text = msg; })));
                    BeginInvoke((Action)(() =>
                    {
                        _installed = true;
                        _status.Text = Product + " wurde installiert.";
                        _action.Text = _launch.Checked ? "Starten" : "Fertig";
                        _action.Enabled = true;
                        _action.DialogResult = DialogResult.OK;
                    }));
                }
                catch (Exception ex)
                {
                    BeginInvoke((Action)(() =>
                    {
                        _status.ForeColor = Color.Firebrick;
                        _status.Text = "Fehler: " + ex.Message;
                        _action.Text = "Installieren";
                        _action.Enabled = true;
                        _path.Enabled = true;
                    }));
                }
            });
            worker.IsBackground = true;
            worker.SetApartmentState(ApartmentState.STA);
            worker.Start();
        }

        private void LaunchApp()
        {
            try
            {
                Process.Start(new ProcessStartInfo(LaunchTargetFor(_path.Text.Trim()))
                {
                    UseShellExecute = true
                });
            }
            catch { }
        }
    }
}
