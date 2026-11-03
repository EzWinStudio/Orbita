using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Net.Http;
using System.Security.Authentication;
using System.Threading.Tasks;

namespace Ezwin.Hub.Tray
{
    internal static class SiteChecker
    {
        private static readonly HttpClient client = CreateClient();

        private static HttpClient CreateClient()
        {
            System.Net.ServicePointManager.SecurityProtocol |= System.Net.SecurityProtocolType.Tls12;
            HttpClientHandler handler = new HttpClientHandler();
            handler.AllowAutoRedirect = true;
            handler.UseCookies = false;
            handler.SslProtocols = SslProtocols.Tls12;
            handler.AutomaticDecompression = System.Net.DecompressionMethods.GZip | System.Net.DecompressionMethods.Deflate;
            HttpClient created = new HttpClient(handler);
            created.Timeout = TimeSpan.FromSeconds(12);
            return created;
        }

        public static Dictionary<string, object> Check(string id, string url)
        {
            Dictionary<string, object> first = CheckOnce(id, url);
            if (string.Equals(Convert.ToString(first["state"]), "offline", StringComparison.Ordinal))
            {
                System.Threading.Thread.Sleep(1500);
                return CheckOnce(id, url);
            }
            return first;
        }

        private static Dictionary<string, object> CheckOnce(string id, string url)
        {
            Stopwatch watch = Stopwatch.StartNew();
            Dictionary<string, object> result = new Dictionary<string, object>();
            result["id"] = id;
            result["checkedAt"] = NowMs();
            result["statusCode"] = null;
            result["latencyMs"] = null;
            result["error"] = null;
            result["state"] = "offline";

            try
            {
                using (HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Get, url))
                {
                    request.Headers.UserAgent.ParseAdd("Orbita/2.0");
                    using (HttpResponseMessage response = client.SendAsync(
                        request,
                        HttpCompletionOption.ResponseHeadersRead).GetAwaiter().GetResult())
                    {
                        watch.Stop();
                        int code = (int)response.StatusCode;
                        result["statusCode"] = code;
                        result["latencyMs"] = (int)watch.ElapsedMilliseconds;
                        if (code >= 200 && code < 400)
                        {
                            result["state"] = "online";
                        }
                        else if (code >= 400 && code < 500)
                        {
                            result["state"] = "degraded";
                        }
                        else
                        {
                            result["state"] = "offline";
                        }
                    }
                }
            }
            catch (Exception error)
            {
                watch.Stop();
                result["latencyMs"] = (int)watch.ElapsedMilliseconds;
                result["error"] = Describe(error);
                result["state"] = "offline";
            }

            return result;
        }

        public static long NowMs()
        {
            return (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;
        }

        private static string Describe(Exception error)
        {
            if (error is TaskCanceledException || error is OperationCanceledException)
            {
                return "Zaman aşımı (12 sn)";
            }
            if (HasInner<AuthenticationException>(error))
            {
                return "SSL sertifika hatası";
            }
            string message = error.Message;
            if (error.InnerException != null && !string.IsNullOrWhiteSpace(error.InnerException.Message))
            {
                message = error.InnerException.Message;
            }
            message = message.Replace("\r", " ").Replace("\n", " ").Trim();
            if (message.Length > 140) message = message.Substring(0, 140) + "…";
            return "Bağlantı hatası: " + message;
        }

        private static bool HasInner<T>(Exception error) where T : Exception
        {
            Exception current = error;
            while (current != null)
            {
                if (current is T) return true;
                current = current.InnerException;
            }
            return false;
        }
    }
}
