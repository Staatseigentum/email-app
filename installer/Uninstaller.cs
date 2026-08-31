// MailWave – Deinstallation
// -----------------------------------------------------------------------------
// Wird als Uninstall.exe in den Installationsordner gelegt und im
// Windows-Uninstall-Registry-Eintrag als UninstallString hinterlegt.
//
//   Uninstall.exe            interaktiv (Rückfrage)
//   Uninstall.exe /S         still
//   Uninstall.exe --finish "<dir>" "<pid>"   interner Aufräumschritt
//
// Kompiliert mit csc.exe.

using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class Uninstaller
{
    private const string Product = "MailWave";
    private const string UninstallKey =
        @"Software\Microsoft\Windows\CurrentVersion\Uninstall\MailWave";
    private const string AppKey = @"Software\MailWave";

    [STAThread]
    private static int Main(string[] args)
    {
        if (args.Length >= 2 && args[0] == "--finish")
        {
            Finish(args[1], args.Length > 2 ? args[2] : null);
            return 0;
        }

        bool silent = Array.Exists(args, a =>
            a.Equals("/S", StringComparison.OrdinalIgnoreCase) ||
            a.Equals("--silent", StringComparison.OrdinalIgnoreCase));

        string installDir = ReadInstallDir()
            ?? Path.GetDirectoryName(Application.ExecutablePath);

        bool removeData = false;
        if (!silent)
        {
            Application.EnableVisualStyles();
            using (var dlg = new ConfirmForm(installDir))
            {
                if (dlg.ShowDialog() != DialogResult.OK) return 1;
                removeData = dlg.RemoveData;
            }
        }

        RemoveShortcuts();
        RemoveRegistry();
        if (removeData) RemoveUserData();

        // Sich selbst + Ordner löschen: Kopie in %TEMP% starten, die den Ordner wegräumt.
        string temp = Path.Combine(Path.GetTempPath(),
            "mailwave-uninstall-" + Guid.NewGuid().ToString("N").Substring(0, 8));
        Directory.CreateDirectory(temp);
        string helper = Path.Combine(temp, "Uninstall.exe");
        File.Copy(Application.ExecutablePath, helper, true);
        Process.Start(new ProcessStartInfo(helper,
            "--finish \"" + installDir + "\" " + Process.GetCurrentProcess().Id)
        {
            UseShellExecute = true,
            WindowStyle = ProcessWindowStyle.Hidden
        });

        if (!silent)
        {
            MessageBox.Show(Product + " wurde entfernt.", Product,
                MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
        return 0;
    }

    private static void Finish(string dir, string pid)
    {
        int id;
        if (int.TryParse(pid, out id))
        {
            try { Process.GetProcessById(id).WaitForExit(10000); } catch { }
        }
        for (int attempt = 0; attempt < 20; attempt++)
        {
            try
            {
                if (Directory.Exists(dir)) Directory.Delete(dir, true);
                break;
            }
            catch { Thread.Sleep(400); }
        }
    }

    private static string ReadInstallDir()
    {
        try
        {
            using (var k = Registry.CurrentUser.OpenSubKey(AppKey))
                return k != null ? k.GetValue("InstallDir") as string : null;
        }
        catch { return null; }
    }

    private static void RemoveRegistry()
    {
        try { Registry.CurrentUser.DeleteSubKeyTree(UninstallKey, false); } catch { }
        try { Registry.CurrentUser.DeleteSubKeyTree(AppKey, false); } catch { }
    }

    private static void RemoveShortcuts()
    {
        string[] targets =
        {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), Product + ".lnk"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), Product + ".lnk")
        };
        foreach (var lnk in targets)
        {
            try { if (File.Exists(lnk)) File.Delete(lnk); } catch { }
        }
    }

    private static void RemoveUserData()
    {
        try
        {
            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            string dir = Path.Combine(appData, "mailwave");
            if (Directory.Exists(dir)) Directory.Delete(dir, true);
        }
        catch { }
    }

    private sealed class ConfirmForm : Form
    {
        private readonly CheckBox _data;
        public bool RemoveData { get { return _data.Checked; } }

        public ConfirmForm(string installDir)
        {
            Text = Product + " deinstallieren";
            FormBorderStyle = FormBorderStyle.FixedDialog;
            StartPosition = FormStartPosition.CenterScreen;
            MaximizeBox = false;
            MinimizeBox = false;
            ClientSize = new System.Drawing.Size(420, 170);

            var label = new Label
            {
                Text = Product + " wird aus\n" + installDir + "\nentfernt.",
                Location = new System.Drawing.Point(16, 16),
                Size = new System.Drawing.Size(388, 60)
            };
            _data = new CheckBox
            {
                Text = "Einstellungen und Konten ebenfalls löschen",
                Location = new System.Drawing.Point(16, 82),
                Size = new System.Drawing.Size(388, 24)
            };
            var ok = new Button
            {
                Text = "Deinstallieren",
                DialogResult = DialogResult.OK,
                Location = new System.Drawing.Point(212, 122),
                Size = new System.Drawing.Size(110, 30)
            };
            var cancel = new Button
            {
                Text = "Abbrechen",
                DialogResult = DialogResult.Cancel,
                Location = new System.Drawing.Point(328, 122),
                Size = new System.Drawing.Size(76, 30)
            };
            Controls.Add(label);
            Controls.Add(_data);
            Controls.Add(ok);
            Controls.Add(cancel);
            AcceptButton = ok;
            CancelButton = cancel;
        }
    }
}
