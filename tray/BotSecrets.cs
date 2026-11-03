using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Web.Script.Serialization;

namespace Ezwin.Hub.Tray
{
    internal static class BotSecrets
    {
        private static readonly object sync = new object();
        private static readonly JavaScriptSerializer json = new JavaScriptSerializer();

        private static string FilePath
        {
            get { return Path.Combine(TrayPaths.DataRoot, "bot-secrets.json"); }
        }

        public static Dictionary<string, string> Hints()
        {
            lock (sync)
            {
                Dictionary<string, Dictionary<string, string>> store = Load();
                Dictionary<string, string> hints = new Dictionary<string, string>();
                foreach (KeyValuePair<string, Dictionary<string, string>> pair in store)
                {
                    string hint = EntryValue(pair.Value, "hint");
                    if (!string.IsNullOrWhiteSpace(hint)) hints[pair.Key] = hint;
                }
                return hints;
            }
        }

        public static string HintFor(string id)
        {
            lock (sync)
            {
                Dictionary<string, Dictionary<string, string>> store = Load();
                Dictionary<string, string> entry;
                if (!store.TryGetValue(id, out entry)) return null;
                string hint = EntryValue(entry, "hint");
                return string.IsNullOrWhiteSpace(hint) ? null : hint;
            }
        }

        public static string Set(string id, string token)
        {
            if (string.IsNullOrWhiteSpace(id) || id.Length > 80)
            {
                throw new ArgumentException("Geçersiz bot kimliği.");
            }
            string clean = (token ?? string.Empty).Trim();
            if (
                clean.Length < 20 ||
                clean.Length > 200 ||
                clean.IndexOf(' ') >= 0 ||
                clean.IndexOf('\n') >= 0 ||
                clean.IndexOf('\r') >= 0 ||
                clean.IndexOf('\t') >= 0)
            {
                throw new ArgumentException("Bot tokenı geçersiz görünüyor.");
            }

            lock (sync)
            {
                Dictionary<string, Dictionary<string, string>> store = Load();
                byte[] encrypted = ProtectedData.Protect(
                    Encoding.UTF8.GetBytes(clean),
                    null,
                    DataProtectionScope.CurrentUser);
                Dictionary<string, string> entry = new Dictionary<string, string>();
                entry["enc"] = Convert.ToBase64String(encrypted);
                entry["hint"] = "••••" + clean.Substring(clean.Length - 4);
                store[id] = entry;
                Save(store);
                TrayPaths.Log("bot secret saved: " + id);
                return entry["hint"];
            }
        }

        public static bool Clear(string id)
        {
            lock (sync)
            {
                Dictionary<string, Dictionary<string, string>> store = Load();
                bool removed = store.Remove(id);
                if (removed) Save(store);
                TrayPaths.Log("bot secret cleared: " + id + " (" + removed + ")");
                return removed;
            }
        }

        public static string Get(string id)
        {
            lock (sync)
            {
                Dictionary<string, Dictionary<string, string>> store = Load();
                Dictionary<string, string> entry;
                if (!store.TryGetValue(id, out entry)) return null;
                string encoded = EntryValue(entry, "enc");
                if (string.IsNullOrEmpty(encoded)) return null;
                try
                {
                    byte[] raw = Convert.FromBase64String(encoded);
                    byte[] plain = ProtectedData.Unprotect(
                        raw,
                        null,
                        DataProtectionScope.CurrentUser);
                    string token = Encoding.UTF8.GetString(plain).Trim();
                    return token.Length > 0 ? token : null;
                }
                catch (Exception error)
                {
                    TrayPaths.Log(
                        "bot secret decrypt failed: " + id + " (" + error.GetType().Name + ")");
                    return null;
                }
            }
        }

        private static string EntryValue(Dictionary<string, string> entry, string key)
        {
            if (entry == null) return string.Empty;
            string value;
            return entry.TryGetValue(key, out value) ? value : string.Empty;
        }

        private static Dictionary<string, Dictionary<string, string>> Load()
        {
            try
            {
                if (!File.Exists(FilePath))
                {
                    return new Dictionary<string, Dictionary<string, string>>();
                }
                string raw = File.ReadAllText(FilePath, Encoding.UTF8);
                if (string.IsNullOrWhiteSpace(raw))
                {
                    return new Dictionary<string, Dictionary<string, string>>();
                }
                Dictionary<string, Dictionary<string, string>> parsed =
                    json.Deserialize<Dictionary<string, Dictionary<string, string>>>(raw);
                return parsed ?? new Dictionary<string, Dictionary<string, string>>();
            }
            catch (Exception error)
            {
                TrayPaths.Log("bot secrets load failed: " + error.GetType().Name);
                return new Dictionary<string, Dictionary<string, string>>();
            }
        }

        private static void Save(Dictionary<string, Dictionary<string, string>> store)
        {
            TrayPaths.Ensure();
            string temp = FilePath + ".tmp";
            File.WriteAllText(temp, json.Serialize(store), new UTF8Encoding(false));
            File.Copy(temp, FilePath, true);
            File.Delete(temp);
        }
    }
}
