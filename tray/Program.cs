using System;
using System.Threading;
using System.Windows.Forms;

namespace Ezwin.Hub.Tray
{
    internal static class Program
    {
        private static Mutex mutex;

        [STAThread]
        private static void Main(string[] args)
        {
            bool created;
            mutex = new Mutex(true, "Local\\EZWINHUBTray", out created);
            if (!created)
            {
                TrayPaths.Log("second instance: requesting show");
                try
                {
                    using (EventWaitHandle show = EventWaitHandle.OpenExisting("Local\\EZWINHUBTrayShow"))
                    {
                        show.Set();
                        TrayPaths.Log("second instance: show requested");
                    }
                }
                catch (Exception error)
                {
                    TrayPaths.Log("second instance: signal failed: " + error.Message);
                }
                return;
            }

            bool background = false;
            foreach (string arg in args)
            {
                if (string.Equals(arg, "--background", StringComparison.OrdinalIgnoreCase))
                {
                    background = true;
                }
            }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            using (EventWaitHandle showEvent = new EventWaitHandle(false, EventResetMode.AutoReset, "Local\\EZWINHUBTrayShow"))
            using (TrayContext context = new TrayContext(showEvent, background))
            {
                Application.Run(context);
            }
        }
    }
}
