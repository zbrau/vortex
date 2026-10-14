package com.vortex.app;

import android.os.Environment;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLRequest;
import com.yausername.youtubedl_android.YoutubeDLResponse;
import com.yausername.youtubedl_android.YoutubeDLException;
import kotlin.Unit;

import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "VortexDownloader")
public class VortexDownloaderPlugin extends Plugin {
    private static final String TAG = "VortexDownloader";
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private boolean isInitialized = false;

    @PluginMethod
    public void initEngine(PluginCall call) {
        executor.execute(() -> {
            try {
                if (!isInitialized) {
                    YoutubeDL.getInstance().init(getContext());
                    isInitialized = true;
                }
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("version", YoutubeDL.getInstance().version(getContext()));
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "Failed to initialize YoutubeDL engine", e);
                call.reject("Initialization error: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("isReady", isInitialized);
        try {
            if (isInitialized) {
                ret.put("version", YoutubeDL.getInstance().version(getContext()));
            }
        } catch (Exception ignored) {}
        call.resolve(ret);
    }

    @PluginMethod
    public void startDownload(PluginCall call) {
        String url = call.getString("url");
        String format = call.getString("format", "video_best");
        String id = call.getString("id", String.valueOf(System.currentTimeMillis()));

        if (url == null || url.isEmpty()) {
            call.reject("URL cannot be empty");
            return;
        }

        executor.execute(() -> {
            try {
                if (!isInitialized) {
                    YoutubeDL.getInstance().init(getContext());
                    isInitialized = true;
                }

                File downloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                File vortexFolder = new File(downloadDir, "Vortex");
                if (!vortexFolder.exists()) {
                    vortexFolder.mkdirs();
                }

                YoutubeDLRequest request = new YoutubeDLRequest(url);
                request.addOption("-o", vortexFolder.getAbsolutePath() + "/%(title)s.%(ext)s");
                request.addOption("--no-mtime");

                if ("audio_mp3".equals(format)) {
                    request.addOption("-x");
                    request.addOption("--audio-format", "mp3");
                    request.addOption("--audio-quality", "0");
                } else if ("video_1080p".equals(format)) {
                    request.addOption("-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best");
                    request.addOption("--merge-output-format", "mp4");
                } else if ("video_4k".equals(format)) {
                    request.addOption("-f", "bestvideo[height<=2160]+bestaudio/best");
                    request.addOption("--merge-output-format", "mp4");
                } else {
                    request.addOption("-f", "bestvideo+bestaudio/best");
                    request.addOption("--merge-output-format", "mp4");
                }

                YoutubeDLResponse response = YoutubeDL.getInstance().execute(request, id, (progress, etaInSeconds, line) -> {
                    JSObject progressData = new JSObject();
                    progressData.put("id", id);
                    progressData.put("status", "downloading");
                    progressData.put("percent", (double) progress);
                    progressData.put("eta", etaInSeconds + "s");
                    notifyListeners("onProgress", progressData);
                    return Unit.INSTANCE;
                });

                JSObject finishData = new JSObject();
                finishData.put("id", id);
                finishData.put("status", "completed");
                finishData.put("percent", 100.0);
                finishData.put("path", vortexFolder.getAbsolutePath());
                finishData.put("output", response.getOut());
                notifyListeners("onProgress", finishData);

                JSObject result = new JSObject();
                result.put("success", true);
                result.put("id", id);
                result.put("downloadDir", vortexFolder.getAbsolutePath());
                call.resolve(result);

            } catch (Exception e) {
                Log.e(TAG, "Download error for URL: " + url, e);
                JSObject errorData = new JSObject();
                errorData.put("id", id);
                errorData.put("status", "error");
                errorData.put("error", e.getMessage());
                notifyListeners("onProgress", errorData);
                call.reject("Download failed: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void updateEngine(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("status", "READY");
        call.resolve(ret);
    }
}
