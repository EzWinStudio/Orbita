using System;
using System.Reflection;
using Microsoft.Win32;

namespace Ezwin.Hub.Tray
{
    internal static class NativeSettings
    {
        private const string SettingsKey = "Software\\Orbita\\Tray";
        private const string LegacySettingsKey = "Software\\EZWIN\\HUB Tray";
        private const string RunKey = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
        private const string RunValue = "Orbita";
        private const string LegacyRunValue = "EZWIN HUB Tray";

        public static bool Notifications
        {
            get { return ReadDword("Notifications", 1) != 0; }
            set { WriteDword("Notifications", value ? 1 : 0); }
        }

        public static bool HideHintShown
        {
            get { return ReadDword("HideHintShown", 0) != 0; }
            set { WriteDword("HideHintShown", value ? 1 : 0); }
        }

        public static bool AutoStart
        {
            get
            {
                try
                {
                    using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RunKey, false))
                    {
                        if (key == null) return false;
                        string value = key.GetValue(RunValue) as string;
                        if (string.IsNullOrWhiteSpace(value))
                            value = key.GetValue(LegacyRunValue) as string;
                        return !string.IsNullOrWhiteSpace(value);
                    }
                }
                catch
                {
                    return false;
                }
            }
        }

        public static void SetAutoStart(bool enabled)
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(RunKey))
                {
                    if (key == null) return;
                    if (enabled)
                    {
                        string exe = Assembly.GetExecutingAssembly().Location;
                        key.SetValue(RunValue, "\"" + exe + "\" --background", RegistryValueKind.String);
                    }
                    else
                    {
                        key.DeleteValue(RunValue, false);
                    }
                    key.DeleteValue(LegacyRunValue, false);
                }
            }
            catch (Exception error)
            {
                TrayPaths.Log("autostart failed: " + error.Message);
            }
        }

        private static int ReadDword(string name, int fallback)
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.OpenSubKey(SettingsKey, false))
                {
                    object value = key == null ? null : key.GetValue(name);
                    if (value is int) return (int)value;
                }
                using (RegistryKey legacy = Registry.CurrentUser.OpenSubKey(LegacySettingsKey, false))
                {
                    object value = legacy == null ? null : legacy.GetValue(name);
                    return value is int ? (int)value : fallback;
                }
            }
            catch
            {
                return fallback;
            }
        }

        private static void WriteDword(string name, int value)
        {
            try
            {
                using (RegistryKey key = Registry.CurrentUser.CreateSubKey(SettingsKey))
                {
                    if (key != null) key.SetValue(name, value, RegistryValueKind.DWord);
                }
                TrayPaths.Log("setting saved: " + name + "=" + value);
            }
            catch (Exception error)
            {
                TrayPaths.Log("setting write failed: " + error.Message);
            }
        }
    }
}
