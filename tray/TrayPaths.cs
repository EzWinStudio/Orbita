using System;
using System.IO;
using System.Text;

namespace Ezwin.Hub.Tray
{
    internal static class TrayPaths
    {
        private static readonly object logLock = new object();

        public static string DataRoot
        {
            get
            {
                return Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "EZWIN HUB Tray");
            }
        }

        public static string BackupRoot
        {
            get
            {
                return Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                    "EZWIN HUB",
                    "Yedekler");
            }
        }

        public static string LogFile
        {
            get { return Path.Combine(DataRoot, "tray.log"); }
        }

        public static void Ensure()
        {
            try
            {
                Directory.CreateDirectory(DataRoot);
            }
            catch
            {
                /* logging stays best effort */
            }
        }

        public static void EnsureBackupRoot()
        {
            Directory.CreateDirectory(BackupRoot);
        }

        public static void Log(string message)
        {
            try
            {
                Ensure();
                lock (logLock)
                {
                    FileInfo info = new FileInfo(LogFile);
                    if (info.Exists && info.Length > 1024 * 1024)
                    {
                        string previous = LogFile + ".old";
                        if (File.Exists(previous)) File.Delete(previous);
                        File.Move(LogFile, previous);
                    }
                    File.AppendAllText(
                        LogFile,
                        DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "  " + message + Environment.NewLine,
                        new UTF8Encoding(false));
                }
            }
            catch
            {
                /* never break the tray for logging */
            }
        }
    }
}
