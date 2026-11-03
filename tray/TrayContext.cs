using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace Ezwin.Hub.Tray
{
    internal sealed class TrayContext : ApplicationContext
    {
        private readonly NotifyIcon tray;
        private readonly ContextMenuStrip menu;
        private readonly ToolStripMenuItem openItem;
        private readonly ToolStripMenuItem checkItem;
        private readonly ToolStripMenuItem notificationsItem;
        private readonly ToolStripMenuItem autostartItem;
        private readonly ToolStripMenuItem statusPrimary;
        private readonly ToolStripMenuItem statusSecondary;
        private readonly ToolStripMenuItem backupStatus;
        private readonly ToolStripMenuItem scheduleItem;
        private readonly ToolStripMenuItem folderItem;
        private readonly ToolStripMenuItem browserItem;
        private readonly ToolStripMenuItem exitItem;
        private readonly HubWindow window;
        private readonly EventWaitHandle showEvent;
        private readonly Thread showListener;
        private readonly System.Windows.Forms.Timer tickTimer;
        private bool exiting;

        public TrayContext(EventWaitHandle showEventHandle, bool startHidden)
        {
            TrayPaths.Ensure();
            showEvent = showEventHandle;

            menu = new ContextMenuStrip();
            openItem = new ToolStripMenuItem("Orbita'yı aç");
            openItem.Font = new Font(openItem.Font, FontStyle.Bold);
            openItem.Click += delegate { ShowWindow(); };

            statusPrimary = new ToolStripMenuItem("Arka plan hazırlanıyor…");
            statusPrimary.Enabled = false;
            statusSecondary = new ToolStripMenuItem("Henüz site kontrolü yapılmadı");
            statusSecondary.Enabled = false;
            backupStatus = new ToolStripMenuItem("Son yedek: —");
            backupStatus.Enabled = false;
            scheduleItem = new ToolStripMenuItem("Site 10 dk · Görev 09:00 · Yedek 03:00");
            scheduleItem.Enabled = false;

            checkItem = new ToolStripMenuItem("Şimdi kontrol et");
            checkItem.Click += delegate
            {
                statusPrimary.Text = "Kontrol ediliyor…";
                window.RunBackgroundTick(true);
            };

            notificationsItem = new ToolStripMenuItem("Bildirimler");
            notificationsItem.CheckOnClick = true;
            notificationsItem.Checked = NativeSettings.Notifications;
            notificationsItem.Click += delegate
            {
                NativeSettings.Notifications = notificationsItem.Checked;
                TrayPaths.Log("notifications: " + (notificationsItem.Checked ? "on" : "off"));
            };

            autostartItem = new ToolStripMenuItem("Windows ile başlat");
            autostartItem.CheckOnClick = true;
            autostartItem.Checked = NativeSettings.AutoStart;
            autostartItem.Click += delegate
            {
                NativeSettings.SetAutoStart(autostartItem.Checked);
                autostartItem.Checked = NativeSettings.AutoStart;
                TrayPaths.Log("autostart: " + (autostartItem.Checked ? "on" : "off"));
            };

            folderItem = new ToolStripMenuItem("Yedek klasörünü aç");
            folderItem.Click += delegate { OpenBackupFolder(); };

            browserItem = new ToolStripMenuItem("Web sürümünü aç");
            browserItem.Click += delegate { OpenBrowserVersion(); };

            exitItem = new ToolStripMenuItem("Çıkış");
            exitItem.Click += delegate { ExitApp(); };

            menu.Items.Add(openItem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(statusPrimary);
            menu.Items.Add(statusSecondary);
            menu.Items.Add(backupStatus);
            menu.Items.Add(scheduleItem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(checkItem);
            menu.Items.Add(notificationsItem);
            menu.Items.Add(autostartItem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(folderItem);
            menu.Items.Add(browserItem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(exitItem);
            menu.Opening += delegate
            {
                notificationsItem.Checked = NativeSettings.Notifications;
                autostartItem.Checked = NativeSettings.AutoStart;
            };

            tray = new NotifyIcon();
            tray.Icon = LoadTrayIcon();
            tray.Text = "Orbita · Arka planda";
            tray.Visible = true;
            tray.ContextMenuStrip = menu;
            tray.DoubleClick += delegate { ShowWindow(); };
            tray.MouseClick += delegate(object sender, MouseEventArgs args)
            {
                if (args.Button == MouseButtons.Left) ShowWindow();
            };
            tray.BalloonTipClicked += delegate { ShowWindow(); };

            window = new HubWindow(startHidden);
            window.StatusChanged += OnStatusChanged;
            window.BackupStatusChanged += OnBackupStatusChanged;
            window.NotificationRequested += OnNotificationRequested;
            window.HiddenToTray += OnHiddenToTray;

            tickTimer = new System.Windows.Forms.Timer();
            tickTimer.Interval = 30000;
            tickTimer.Tick += delegate { window.RunBackgroundTick(false); };
            tickTimer.Start();

            showListener = new Thread(ListenForShow);
            showListener.IsBackground = true;
            showListener.Start();

            window.Prepare();
            TrayPaths.Log("tray started (hidden=" + startHidden + ")");
        }

        private void OnStatusChanged(string primary, string secondary)
        {
            if (exiting) return;
            if (!string.IsNullOrWhiteSpace(primary)) statusPrimary.Text = primary;
            if (!string.IsNullOrWhiteSpace(secondary)) statusSecondary.Text = secondary;
        }

        private void OnBackupStatusChanged(string text)
        {
            if (exiting) return;
            if (!string.IsNullOrWhiteSpace(text)) backupStatus.Text = text;
        }

        private void OnNotificationRequested(string title, string body)
        {
            if (exiting || !NativeSettings.Notifications) return;
            try
            {
                tray.ShowBalloonTip(
                    4000,
                    title,
                    string.IsNullOrWhiteSpace(body) ? title : body,
                    ToolTipIcon.None);
            }
            catch (Exception error)
            {
                TrayPaths.Log("balloon failed: " + error.Message);
            }
        }

        private void OnHiddenToTray()
        {
            if (exiting) return;
            if (NativeSettings.HideHintShown) return;
            NativeSettings.HideHintShown = true;
            try
            {
                tray.ShowBalloonTip(
                    4500,
                    "Orbita arka planda",
                    "Uygulama arka planda çalışmaya devam ediyor. Açmak için simgeye çift tıkla.",
                    ToolTipIcon.None);
            }
            catch
            {
                /* a missing balloon is not fatal */
            }
        }

        private void ListenForShow()
        {
            while (!exiting)
            {
                try
                {
                    showEvent.WaitOne();
                }
                catch
                {
                    return;
                }
                if (exiting) return;
                TrayPaths.Log("show event received");
                try
                {
                    window.BeginInvoke(new Action(ShowWindow));
                }
                catch (Exception error)
                {
                    TrayPaths.Log("show invoke failed: " + error.Message);
                    return;
                }
            }
        }

        private void ShowWindow()
        {
            if (exiting) return;
            try
            {
                window.ShowFromTray();
                TrayPaths.Log("window shown (visible=" + window.Visible + ")");
            }
            catch (Exception error)
            {
                TrayPaths.Log("show failed: " + error.Message);
            }
        }

        private void OpenBackupFolder()
        {
            try
            {
                TrayPaths.EnsureBackupRoot();
                Process.Start(new ProcessStartInfo("explorer.exe", "\"" + TrayPaths.BackupRoot + "\"")
                {
                    UseShellExecute = true,
                });
            }
            catch (Exception error)
            {
                TrayPaths.Log("backup folder failed: " + error.Message);
            }
        }

        private void OpenBrowserVersion()
        {
            try
            {
                Process.Start(new ProcessStartInfo("https://orbita.wasmer.app")
                {
                    UseShellExecute = true,
                });
            }
            catch (Exception error)
            {
                TrayPaths.Log("browser open failed: " + error.Message);
            }
        }

        private void ExitApp()
        {
            if (exiting) return;
            exiting = true;
            tickTimer.Stop();
            tray.Visible = false;
            tray.Dispose();
            window.AllowClose();
            window.Close();
            TrayPaths.Log("tray exiting");
            ExitThread();
        }

        private static Icon LoadTrayIcon()
        {
            try
            {
                string path = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "orbita.ico");
                if (File.Exists(path)) return new Icon(path, 16, 16);
            }
            catch
            {
                /* default icon is acceptable */
            }
            return SystemIcons.Application;
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                exiting = true;
                try
                {
                    tickTimer.Stop();
                    tickTimer.Dispose();
                }
                catch
                {
                    /* already disposed */
                }
                try
                {
                    tray.Visible = false;
                    tray.Dispose();
                }
                catch
                {
                    /* already disposed */
                }
                try
                {
                    menu.Dispose();
                }
                catch
                {
                    /* already disposed */
                }
                try
                {
                    window.Dispose();
                }
                catch
                {
                    /* already disposed */
                }
            }
            base.Dispose(disposing);
        }
    }
}
