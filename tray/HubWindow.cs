using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Ezwin.Hub.Tray
{
    internal sealed class HubWindow : Form
    {
        [DllImport("dwmapi.dll")]
        private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attribute, ref int value, int size);

        [DllImport("uxtheme.dll", CharSet = CharSet.Unicode)]
        private static extern int SetWindowTheme(IntPtr hwnd, string subAppName, string subIdList);

        private readonly WebView2 web;
        private readonly JavaScriptSerializer json = new JavaScriptSerializer();
        private readonly bool startHidden;
        private bool initialized;
        private bool pageReady;
        private bool allowClose;
        private bool checkRunning;
        private bool botCheckRunning;

        public event Action<string, string> StatusChanged;
        public event Action<string> BackupStatusChanged;
        public event Action<string, string> NotificationRequested;
        public event Action HiddenToTray;

        public HubWindow(bool hidden)
        {
            startHidden = hidden;
            Text = "EZWIN HUB";
            AutoScaleMode = AutoScaleMode.None;
            Rectangle work = Screen.PrimaryScreen.WorkingArea;
            Width = Math.Max(980, Math.Min(1600, work.Width - 80));
            Height = Math.Max(640, Math.Min(1000, work.Height - 40));
            MinimumSize = new Size(980, 640);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = Color.FromArgb(5, 8, 7);
            try
            {
                string iconPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ezwin.ico");
                if (File.Exists(iconPath)) Icon = new Icon(iconPath, 32, 32);
            }
            catch
            {
                /* default icon is acceptable */
            }

            web = new WebView2();
            web.Dock = DockStyle.Fill;
            Controls.Add(web);
        }

        public void Prepare()
        {
            if (startHidden)
            {
                Opacity = 0;
                Show();
                Hide();
                Opacity = 1;
                TrayPaths.Log("window prepared hidden");
            }
            else
            {
                Show();
            }
        }

        public void AllowClose()
        {
            allowClose = true;
        }

        public void ShowFromTray()
        {
            if (!Visible) Show();
            if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
            ApplyDarkTitleBar();
            Activate();
            BringToFront();
            TrayPaths.Log("show from tray requested (disposed=" + IsDisposed + ")");
            try
            {
                web.Focus();
            }
            catch
            {
                /* focus is best effort */
            }
        }

        public void RunBackgroundTick(bool force)
        {
            if (!pageReady || web.CoreWebView2 == null) return;
            string options = force
                ? "{force:true,source:'tray'}"
                : "{force:false,source:'timer'}";
            string script = "(function(){var f=window.__ezwinTrayTick;if(f){f(" + options + ");}})();";
            try
            {
                web.CoreWebView2.ExecuteScriptAsync(script);
            }
            catch (Exception error)
            {
                TrayPaths.Log("tick failed: " + error.Message);
            }
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            ApplyDarkTitleBar();
            BeginInitialization();
        }

        protected override void OnShown(EventArgs e)
        {
            base.OnShown(e);
            ApplyDarkTitleBar();
        }

        private void ApplyDarkTitleBar()
        {
            try
            {
                int dark = 1;
                int result = DwmSetWindowAttribute(Handle, 20, ref dark, sizeof(int));
                if (result != 0)
                {
                    result = DwmSetWindowAttribute(Handle, 19, ref dark, sizeof(int));
                }
                SetWindowTheme(Handle, "DarkMode_Explorer", null);
                int caption = 0x000D0F0A;
                int text = 0x00F4F7F2;
                DwmSetWindowAttribute(Handle, 35, ref caption, sizeof(int));
                DwmSetWindowAttribute(Handle, 36, ref text, sizeof(int));
                TrayPaths.Log("dark title bar: " + result);
            }
            catch (Exception error)
            {
                TrayPaths.Log("dark title bar failed: " + error.Message);
            }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            TrayPaths.Log("close requested: reason=" + e.CloseReason + " allow=" + allowClose);
            if (
                !allowClose &&
                e.CloseReason != CloseReason.WindowsShutDown &&
                e.CloseReason != CloseReason.ApplicationExitCall)
            {
                e.Cancel = true;
                Hide();
                TrayPaths.Log("window hidden");
                if (HiddenToTray != null) HiddenToTray();
                return;
            }
            base.OnFormClosing(e);
        }

        private async void BeginInitialization()
        {
            if (initialized) return;
            initialized = true;
            try
            {
                string webRoot = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "web");
                if (!File.Exists(Path.Combine(webRoot, "index.html")))
                {
                    throw new FileNotFoundException("web/index.html bulunamadı.");
                }
                string dataFolder = Path.Combine(TrayPaths.DataRoot, "WebView2");
                Directory.CreateDirectory(dataFolder);
                CoreWebView2EnvironmentOptions options = new CoreWebView2EnvironmentOptions();
                options.AdditionalBrowserArguments =
                    "--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows";
                CoreWebView2Environment environment = await CoreWebView2Environment.CreateAsync(
                    null, dataFolder, options);
                await web.EnsureCoreWebView2Async(environment);

                CoreWebView2 core = web.CoreWebView2;
                core.Settings.AreDefaultContextMenusEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.AreDevToolsEnabled =
                    string.Equals(Environment.GetEnvironmentVariable("EZWIN_TRAY_DEV"), "1", StringComparison.Ordinal);
                core.SetVirtualHostNameToFolderMapping(
                    "ezwin.local", webRoot, CoreWebView2HostResourceAccessKind.Allow);
                core.WebMessageReceived += OnWebMessage;
                core.NavigationStarting += OnNavigationStarting;
                core.NewWindowRequested += OnNewWindowRequested;
                core.NavigationCompleted += OnNavigationCompleted;
                core.Navigate("https://ezwin.local/index.html");
                TrayPaths.Log("webview initialized");
            }
            catch (Exception error)
            {
                TrayPaths.Log("init failed: " + error);
                MessageBox.Show(
                    "EZWIN HUB arayüzü başlatılamadı.\r\n\r\n" + error.Message +
                    "\r\n\r\nMicrosoft Edge WebView2 Runtime gerekli olabilir. Windows Update veya Microsoft'un WebView2 indirme sayfasından kurabilirsin.",
                    "EZWIN HUB Tray",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
            }
        }

        private void OnNavigationStarting(object sender, CoreWebView2NavigationStartingEventArgs e)
        {
            Uri target;
            if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out target)) return;
            if (target.Scheme == Uri.UriSchemeHttps && target.Host == "ezwin.local") return;
            e.Cancel = true;
            OpenExternal(e.Uri);
        }

        private void OnNewWindowRequested(object sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            e.Handled = true;
            OpenExternal(e.Uri);
        }

        private void OnNavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            pageReady = e.IsSuccess;
            if (!pageReady)
            {
                TrayPaths.Log("navigation failed: " + e.WebErrorStatus);
                return;
            }
            TrayPaths.Log("page ready");
            Dictionary<string, object> ready = new Dictionary<string, object>();
            ready["kind"] = "host-ready";
            PostJson(ready);
        }

        private static void OpenExternal(string url)
        {
            Uri target;
            if (!Uri.TryCreate(url, UriKind.Absolute, out target)) return;
            if (target.Scheme != Uri.UriSchemeHttp && target.Scheme != Uri.UriSchemeHttps) return;
            try
            {
                Process.Start(new ProcessStartInfo(target.AbsoluteUri) { UseShellExecute = true });
            }
            catch (Exception error)
            {
                TrayPaths.Log("open external failed: " + error.Message);
            }
        }

        private void OnWebMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            string raw;
            try
            {
                raw = e.TryGetWebMessageAsString();
            }
            catch
            {
                return;
            }
            if (string.IsNullOrWhiteSpace(raw) || raw.Length > 9 * 1024 * 1024) return;

            Dictionary<string, object> message;
            try
            {
                message = json.Deserialize<Dictionary<string, object>>(raw);
            }
            catch
            {
                return;
            }
            if (message == null) return;

            string kind = Value(message, "kind");
            TrayPaths.Log("web message: " + kind);
            if (kind == "notify")
            {
                string title = Limit(Value(message, "title"), 120);
                string body = Limit(Value(message, "body"), 500);
                if (title.Length == 0) return;
                TrayPaths.Log("notification: " + title);
                if (NotificationRequested != null) NotificationRequested(title, body);
                return;
            }
            if (kind == "status")
            {
                string primary = Limit(Value(message, "primary"), 100);
                string secondary = Limit(Value(message, "secondary"), 100);
                if (StatusChanged != null) StatusChanged(primary, secondary);
                return;
            }
            if (kind == "backup-status")
            {
                string text = Limit(Value(message, "text"), 100);
                if (BackupStatusChanged != null) BackupStatusChanged(text);
                return;
            }
            if (kind == "check-sites")
            {
                StartSiteChecks(message);
                return;
            }
            if (kind == "check-bots")
            {
                StartBotChecks(message);
                return;
            }
            if (kind == "bot-secret-save")
            {
                SaveBotSecret(message);
                return;
            }
            if (kind == "bot-secret-clear")
            {
                ClearBotSecret(message);
                return;
            }
            if (kind == "bot-secret-status")
            {
                PostBotSecretStatus();
                return;
            }
            if (kind == "backup")
            {
                StartBackup(message);
            }
        }

        private void SaveBotSecret(Dictionary<string, object> message)
        {
            string id = Value(message, "id");
            string token = Value(message, "token");
            string requestId = Value(message, "requestId");
            Dictionary<string, object> payload = new Dictionary<string, object>();
            payload["kind"] = "bot-secret-saved";
            payload["id"] = id;
            if (requestId.Length > 0) payload["requestId"] = requestId;
            try
            {
                string hint = BotSecrets.Set(id, token);
                payload["ok"] = true;
                payload["hint"] = hint;
            }
            catch (Exception error)
            {
                payload["ok"] = false;
                payload["error"] = Limit(error.Message, 200);
                TrayPaths.Log("bot secret save failed: " + id + " (" + error.GetType().Name + ")");
            }
            PostJson(payload);
        }

        private void ClearBotSecret(Dictionary<string, object> message)
        {
            string id = Value(message, "id");
            string requestId = Value(message, "requestId");
            Dictionary<string, object> payload = new Dictionary<string, object>();
            payload["kind"] = "bot-secret-saved";
            payload["id"] = id;
            if (requestId.Length > 0) payload["requestId"] = requestId;
            try
            {
                BotSecrets.Clear(id);
                payload["ok"] = true;
                payload["hint"] = null;
            }
            catch (Exception error)
            {
                payload["ok"] = false;
                payload["error"] = Limit(error.Message, 200);
                TrayPaths.Log("bot secret clear failed: " + id + " (" + error.GetType().Name + ")");
            }
            PostJson(payload);
        }

        private void PostBotSecretStatus()
        {
            Dictionary<string, object> payload = new Dictionary<string, object>();
            payload["kind"] = "bot-secret-status";
            payload["hints"] = BotSecrets.Hints();
            PostJson(payload);
        }

        private void StartBotChecks(Dictionary<string, object> message)
        {
            if (botCheckRunning)
            {
                TrayPaths.Log("bot check ignored: already running");
                return;
            }
            object rawBots = message.ContainsKey("bots") ? message["bots"] : null;
            System.Collections.IEnumerable bots = rawBots as System.Collections.IEnumerable;
            if (bots == null)
            {
                TrayPaths.Log("bot check ignored: bots missing");
                return;
            }

            List<BotJob> jobs = new List<BotJob>();
            foreach (object item in bots)
            {
                Dictionary<string, object> bot = item as Dictionary<string, object>;
                if (bot == null) continue;
                string id = Value(bot, "id");
                if (id.Length == 0 || id.Length > 80) continue;
                string token = BotSecrets.Get(id);
                string hint = BotSecrets.HintFor(id);
                jobs.Add(new BotJob(id, token, hint));
                if (jobs.Count >= 40) break;
            }
            if (jobs.Count == 0)
            {
                TrayPaths.Log("bot check ignored: no bots");
                return;
            }

            botCheckRunning = true;
            TrayPaths.Log("bot check started: " + jobs.Count);
            Task.Run(delegate
            {
                List<Dictionary<string, object>> results = new List<Dictionary<string, object>>();
                foreach (BotJob job in jobs)
                {
                    Dictionary<string, object> result;
                    if (job.Token == null)
                    {
                        result = new Dictionary<string, object>();
                        result["assetId"] = job.Id;
                        result["checkedAt"] = SiteChecker.NowMs();
                        result["configured"] = job.Hint != null;
                        result["hint"] = job.Hint;
                        if (job.Hint != null)
                        {
                            result["state"] = "offline";
                            result["latencyMs"] = null;
                            result["summary"] = "Anahtar çözülemedi";
                            result["error"] = "Kayıtlı bot tokenı çözülemedi. Yeniden bağla.";
                        }
                    }
                    else
                    {
                        result = BotChecker.Check(job.Id, job.Token);
                        result["configured"] = true;
                        result["hint"] = job.Hint;
                    }
                    results.Add(result);
                }

                Dictionary<string, object> payload = new Dictionary<string, object>();
                payload["kind"] = "bot-results";
                payload["results"] = results;
                payload["checkedAt"] = SiteChecker.NowMs();
                try
                {
                    BeginInvoke(new Action(delegate
                    {
                        PostJson(payload);
                        botCheckRunning = false;
                        TrayPaths.Log("bot check done: " + results.Count);
                    }));
                }
                catch
                {
                    botCheckRunning = false;
                }
            });
        }

        private void StartSiteChecks(Dictionary<string, object> message)
        {
            if (checkRunning)
            {
                TrayPaths.Log("site check ignored: already running");
                return;
            }
            object rawSites = message.ContainsKey("sites") ? message["sites"] : null;
            System.Collections.IEnumerable sites = rawSites as System.Collections.IEnumerable;
            if (sites == null)
            {
                TrayPaths.Log("site check ignored: sites missing");
                return;
            }

            List<SiteJob> jobs = new List<SiteJob>();
            foreach (object item in sites)
            {
                Dictionary<string, object> site = item as Dictionary<string, object>;
                if (site == null) continue;
                string id = Value(site, "id");
                string url = Value(site, "url");
                Uri target;
                if (id.Length == 0 || url.Length == 0) continue;
                if (!Uri.TryCreate(url, UriKind.Absolute, out target)) continue;
                if (target.Scheme != Uri.UriSchemeHttp && target.Scheme != Uri.UriSchemeHttps) continue;
                jobs.Add(new SiteJob(id, target.AbsoluteUri));
                if (jobs.Count >= 40) break;
            }
            if (jobs.Count == 0)
            {
                TrayPaths.Log("site check ignored: no valid sites");
                return;
            }

            checkRunning = true;
            TrayPaths.Log("site check started: " + jobs.Count);
            Task.Run(delegate
            {
                Task<Dictionary<string, object>>[] tasks =
                    new Task<Dictionary<string, object>>[jobs.Count];
                for (int index = 0; index < jobs.Count; index++)
                {
                    SiteJob job = jobs[index];
                    tasks[index] = Task.Run(delegate
                    {
                        return SiteChecker.Check(job.Id, job.Url);
                    });
                }
                try
                {
                    Task.WaitAll(tasks);
                }
                catch
                {
                    /* each job carries its own error result */
                }

                List<Dictionary<string, object>> results = new List<Dictionary<string, object>>();
                foreach (Task<Dictionary<string, object>> task in tasks)
                {
                    if (task.Status == TaskStatus.RanToCompletion)
                    {
                        results.Add(task.Result);
                    }
                }
                Dictionary<string, object> payload = new Dictionary<string, object>();
                payload["kind"] = "site-results";
                payload["results"] = results;
                payload["checkedAt"] = SiteChecker.NowMs();
                try
                {
                    BeginInvoke(new Action(delegate
                    {
                        PostJson(payload);
                        checkRunning = false;
                        TrayPaths.Log("site check done: " + results.Count);
                    }));
                }
                catch
                {
                    checkRunning = false;
                }
            });
        }

        private void StartBackup(Dictionary<string, object> message)
        {
            string payload = Value(message, "json");
            string date = Value(message, "date");
            DateTime parsed;
            if (
                payload.Length == 0 ||
                payload.Length > 8 * 1024 * 1024 ||
                !DateTime.TryParseExact(
                    date,
                    "yyyy-MM-dd",
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out parsed))
            {
                PostBackupResult(false, date, null, "Geçersiz yedek isteği");
                return;
            }

            Task.Run(delegate
            {
                string path = null;
                string error = null;
                try
                {
                    TrayPaths.EnsureBackupRoot();
                    path = Path.Combine(TrayPaths.BackupRoot, "ezwin-hub-yedek-" + date + ".json");
                    File.WriteAllText(path, payload, new UTF8Encoding(false));
                    PruneBackups();
                    TrayPaths.Log("backup saved: " + date + " " + payload.Length + " bytes");
                }
                catch (Exception failure)
                {
                    error = failure.Message;
                    path = null;
                    TrayPaths.Log("backup failed: " + failure.Message);
                }
                try
                {
                    BeginInvoke(new Action(delegate
                    {
                        PostBackupResult(error == null, date, path, error);
                    }));
                }
                catch
                {
                    /* app is closing */
                }
            });
        }

        private void PostBackupResult(bool ok, string date, string path, string error)
        {
            Dictionary<string, object> payload = new Dictionary<string, object>();
            payload["kind"] = "backup-saved";
            payload["ok"] = ok;
            payload["date"] = date;
            if (path != null) payload["path"] = path;
            if (error != null) payload["error"] = Limit(error, 300);
            PostJson(payload);
        }

        private static void PruneBackups()
        {
            string[] files = Directory.GetFiles(TrayPaths.BackupRoot, "ezwin-hub-yedek-*.json");
            Array.Sort(files, delegate(string left, string right)
            {
                return File.GetLastWriteTimeUtc(right).CompareTo(File.GetLastWriteTimeUtc(left));
            });
            for (int index = 14; index < files.Length; index++)
            {
                try
                {
                    File.Delete(files[index]);
                }
                catch
                {
                    /* a locked old backup is harmless */
                }
            }
        }

        private void PostJson(Dictionary<string, object> payload)
        {
            if (web.CoreWebView2 == null) return;
            try
            {
                web.CoreWebView2.PostWebMessageAsString(json.Serialize(payload));
            }
            catch (Exception error)
            {
                TrayPaths.Log("host message failed: " + error.Message);
            }
        }

        private static string Value(Dictionary<string, object> message, string key)
        {
            if (message == null || !message.ContainsKey(key)) return string.Empty;
            object value = message[key];
            return value == null ? string.Empty : Convert.ToString(value, CultureInfo.InvariantCulture);
        }

        private static string Limit(string value, int max)
        {
            if (string.IsNullOrEmpty(value)) return string.Empty;
            string clean = value.Replace("\r", " ").Replace("\n", " ").Trim();
            return clean.Length <= max ? clean : clean.Substring(0, max);
        }

        private sealed class SiteJob
        {
            public readonly string Id;
            public readonly string Url;

            public SiteJob(string id, string url)
            {
                Id = id;
                Url = url;
            }
        }

        private sealed class BotJob
        {
            public readonly string Id;
            public readonly string Token;
            public readonly string Hint;

            public BotJob(string id, string token, string hint)
            {
                Id = id;
                Token = token;
                Hint = hint;
            }
        }
    }
}
