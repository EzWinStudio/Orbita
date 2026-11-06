package com.ezwin.orbita;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "OrbitaUpdater")
public class OrbitaUpdaterPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void getVersion(PluginCall call) {
        try {
            PackageManager manager = getContext().getPackageManager();
            PackageInfo info = manager.getPackageInfo(getContext().getPackageName(), 0);
            long code = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? info.getLongVersionCode()
                : info.versionCode;
            JSObject result = new JSObject();
            result.put("versionName", info.versionName == null ? "" : info.versionName);
            result.put("versionCode", code);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("version_unavailable");
        }
    }

    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject result = new JSObject();
        result.put("allowed", canInstallPackages());
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        try {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("settings_unavailable");
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String sha256 = call.getString("sha256", "");
        String version = call.getString("version", "new");

        if (url == null || !url.startsWith("https://")) {
            call.reject("invalid_url");
            return;
        }
        if (sha256 == null || !sha256.matches("^[a-fA-F0-9]{64}$")) {
            call.reject("invalid_checksum");
            return;
        }
        if (!canInstallPackages()) {
            call.reject("install_permission_required");
            return;
        }

        final String expected = sha256.toLowerCase(Locale.US);
        final String safeVersion = version == null ? "new" : version.replaceAll("[^0-9A-Za-z._-]", "-");
        executor.execute(() -> download(call, url, expected, safeVersion));
    }

    private void download(PluginCall call, String url, String expected, String version) {
        File temp = null;
        HttpURLConnection connection = null;
        try {
            File dir = new File(getContext().getCacheDir(), "updates");
            if (!dir.exists() && !dir.mkdirs()) {
                call.reject("cache_unavailable");
                return;
            }
            File target = new File(dir, "Orbita-Android-" + version + ".apk");
            temp = new File(dir, target.getName() + ".part");
            File[] stale = dir.listFiles();
            if (stale != null) {
                for (File old : stale) {
                    if (!old.equals(target) && !old.equals(temp)) old.delete();
                }
            }
            if (temp.exists()) temp.delete();

            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setInstanceFollowRedirects(true);
            connection.setConnectTimeout(20000);
            connection.setReadTimeout(60000);
            connection.setRequestProperty("User-Agent", "Orbita-Android");
            connection.connect();
            int status = connection.getResponseCode();
            if (status != HttpURLConnection.HTTP_OK) {
                call.reject("download_failed: HTTP " + status);
                return;
            }

            long total = connection.getContentLengthLong();
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long received = 0;
            int lastPercent = -1;
            try (InputStream input = connection.getInputStream();
                 FileOutputStream output = new FileOutputStream(temp)) {
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = input.read(buffer)) > 0) {
                    output.write(buffer, 0, read);
                    digest.update(buffer, 0, read);
                    received += read;
                    if (received > 300L * 1024L * 1024L) {
                        throw new IllegalStateException("package_too_large");
                    }
                    if (total > 0) {
                        int percent = (int) Math.min(100, (received * 100) / total);
                        if (percent != lastPercent) {
                            lastPercent = percent;
                            JSObject progress = new JSObject();
                            progress.put("percent", percent);
                            progress.put("received", received);
                            progress.put("total", total);
                            notifyProgress(progress);
                        }
                    }
                }
            }

            String actual = toHex(digest.digest());
            if (!actual.equals(expected)) {
                temp.delete();
                call.reject("checksum_mismatch");
                return;
            }

            if (target.exists()) target.delete();
            if (!temp.renameTo(target)) {
                temp.delete();
                call.reject("install_failed: rename");
                return;
            }

            openInstaller(target);

            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("sha256", actual);
            result.put("size", target.length());
            call.resolve(result);
        } catch (Exception error) {
            if (temp != null) temp.delete();
            String message = error.getMessage();
            call.reject("install_failed: " + (message == null ? error.getClass().getSimpleName() : message));
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private void openInstaller(File file) {
        Uri uri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            file
        );
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
    }

    private void notifyProgress(JSObject progress) {
        if (getActivity() == null) return;
        getActivity().runOnUiThread(() -> notifyListeners("downloadProgress", progress));
    }

    private boolean canInstallPackages() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return getContext().getPackageManager().canRequestPackageInstalls();
        }
        return true;
    }

    private static String toHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            builder.append(String.format(Locale.US, "%02x", value));
        }
        return builder.toString();
    }
}
