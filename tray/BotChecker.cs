using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Net.Http;
using System.Security.Authentication;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace Ezwin.Hub.Tray
{
    internal static class BotChecker
    {
        private const string DiscordApi = "https://discord.com/api/v10";
        private static readonly HttpClient client = CreateClient();
        private static readonly JavaScriptSerializer json = new JavaScriptSerializer();

        private static HttpClient CreateClient()
        {
            System.Net.ServicePointManager.SecurityProtocol |= System.Net.SecurityProtocolType.Tls12;
            HttpClientHandler handler = new HttpClientHandler();
            handler.AllowAutoRedirect = false;
            handler.UseCookies = false;
            handler.SslProtocols = SslProtocols.Tls12;
            handler.AutomaticDecompression =
                System.Net.DecompressionMethods.GZip | System.Net.DecompressionMethods.Deflate;
            HttpClient created = new HttpClient(handler);
            created.Timeout = TimeSpan.FromSeconds(12);
            return created;
        }

        public static Dictionary<string, object> Check(string assetId, string token)
        {
            long checkedAt = SiteChecker.NowMs();
            Stopwatch watch = Stopwatch.StartNew();
            Dictionary<string, object> result = BaseResult(assetId, checkedAt);

            HttpResponseMessage meResponse;
            try
            {
                meResponse = Send("/users/@me", token);
            }
            catch (Exception error)
            {
                watch.Stop();
                result["latencyMs"] = (int)watch.ElapsedMilliseconds;
                result["state"] = "offline";
                result["summary"] = "Discord API erişilemedi";
                result["error"] = Describe(error);
                return result;
            }

            using (meResponse)
            {
                watch.Stop();
                result["latencyMs"] = (int)watch.ElapsedMilliseconds;
                int code = (int)meResponse.StatusCode;

                if (code == 401)
                {
                    result["state"] = "offline";
                    result["summary"] = "Token geçersiz";
                    result["error"] = "Discord tokenı reddedildi (401). Bot tokenını yenile.";
                    return result;
                }
                if (code == 429)
                {
                    result["state"] = "degraded";
                    result["summary"] = "Discord rate limit";
                    result["error"] = "Discord API rate limit uyguladı, sonraki kontrolde tekrar denenecek.";
                    return result;
                }
                if (!meResponse.IsSuccessStatusCode)
                {
                    result["state"] = "offline";
                    result["summary"] = "Discord API hatası (" + code + ")";
                    result["error"] = "Discord API HTTP " + code + " döndü.";
                    return result;
                }

                Dictionary<string, object> me;
                try
                {
                    me = json.Deserialize<Dictionary<string, object>>(
                        meResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult());
                }
                catch
                {
                    result["state"] = "degraded";
                    result["summary"] = "Bot doğrulandı, yanıt okunamadı";
                    result["error"] = "Discord yanıtı ayrıştırılamadı.";
                    return result;
                }

                string username = DictionaryText(me, "username");
                string botId = DictionaryText(me, "id");
                if (username.Length == 0) username = "Bot";

                long applicationGuilds = 0;
                try
                {
                    using (HttpResponseMessage appResponse = Send("/oauth2/applications/@me", token))
                    {
                        if (appResponse.IsSuccessStatusCode)
                        {
                            Dictionary<string, object> application =
                                json.Deserialize<Dictionary<string, object>>(
                                    appResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult());
                            applicationGuilds = DictionaryLong(application, "approximate_guild_count");
                        }
                    }
                }
                catch
                {
                    /* application metadata is optional */
                }

                List<Dictionary<string, object>> guilds = new List<Dictionary<string, object>>();
                bool guildsOk = true;
                try
                {
                    using (HttpResponseMessage guildResponse = Send("/users/@me/guilds?limit=200", token))
                    {
                        if (guildResponse.IsSuccessStatusCode)
                        {
                            object[] parsed = json.Deserialize<object[]>(
                                guildResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult());
                            if (parsed != null)
                            {
                                for (int index = 0; index < parsed.Length && index < 200; index++)
                                {
                                    Dictionary<string, object> guild =
                                        parsed[index] as Dictionary<string, object>;
                                    if (guild == null) continue;
                                    string guildId = DictionaryText(guild, "id");
                                    string guildName = DictionaryText(guild, "name");
                                    if (guildId.Length == 0) continue;
                                    Dictionary<string, object> item = new Dictionary<string, object>();
                                    item["id"] = guildId;
                                    item["name"] = guildName.Length > 0 ? guildName : guildId;
                                    guilds.Add(item);
                                }
                            }
                        }
                        else
                        {
                            guildsOk = false;
                        }
                    }
                }
                catch
                {
                    guildsOk = false;
                }

                long guildCount = applicationGuilds > 0 ? applicationGuilds : guilds.Count;
                result["state"] = guildsOk ? "online" : "degraded";
                result["summary"] = guildsOk
                    ? username + " · " + guildCount + " sunucu"
                    : "Bot doğrulandı, sunucu listesi alınamadı";
                result["error"] = guildsOk
                    ? null
                    : "Bot tokenı geçerli ama sunucu listesi çekilemedi.";

                Dictionary<string, object> discord = new Dictionary<string, object>();
                discord["botId"] = botId;
                discord["username"] = username;
                discord["guildCount"] = guildCount;
                discord["guilds"] = guilds;
                result["discord"] = discord;
                return result;
            }
        }

        private static HttpResponseMessage Send(string path, string token)
        {
            HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Get, DiscordApi + path);
            request.Headers.TryAddWithoutValidation("Authorization", "Bot " + token);
            request.Headers.TryAddWithoutValidation("Accept", "application/json");
            request.Headers.TryAddWithoutValidation("User-Agent", "DiscordBot (https://github.com/EzWinStudio/Orbita, 2.0)");
            return client.SendAsync(request, HttpCompletionOption.ResponseContentRead)
                .GetAwaiter()
                .GetResult();
        }

        private static Dictionary<string, object> BaseResult(string assetId, long checkedAt)
        {
            Dictionary<string, object> result = new Dictionary<string, object>();
            result["assetId"] = assetId;
            result["checkedAt"] = checkedAt;
            result["state"] = "offline";
            result["latencyMs"] = null;
            result["summary"] = "Kontrol edilemedi";
            result["error"] = null;
            return result;
        }

        private static string DictionaryText(Dictionary<string, object> source, string key)
        {
            if (source == null || !source.ContainsKey(key) || source[key] == null) return string.Empty;
            return Convert.ToString(source[key], System.Globalization.CultureInfo.InvariantCulture);
        }

        private static long DictionaryLong(Dictionary<string, object> source, string key)
        {
            if (source == null || !source.ContainsKey(key) || source[key] == null) return 0;
            long value;
            if (long.TryParse(
                Convert.ToString(source[key], System.Globalization.CultureInfo.InvariantCulture),
                out value))
            {
                return value;
            }
            return 0;
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
