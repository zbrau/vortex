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
import com.yausername.youtubedl_android.mapper.VideoInfo;
import kotlin.Unit;

import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "VortexDownloader")
public class VortexDownloaderPlugin extends Plugin {
    private static final String TAG = "VortexDownloader";
    private final ExecutorService executor = Executors.newCachedThreadPool();
    private boolean isInitialized = false;
    private static volatile boolean engineUpdateTriggered = false;

    private void ensureEngineUpdated() {
        if (!engineUpdateTriggered) {
            synchronized (VortexDownloaderPlugin.class) {
                if (!engineUpdateTriggered) {
                    engineUpdateTriggered = true;
                    try {
                        YoutubeDL.getInstance().updateYoutubeDL(getContext(), YoutubeDL.UpdateChannel.NIGHTLY.INSTANCE);
                        Log.i(TAG, "YoutubeDL engine updated to NIGHTLY");
                    } catch (Exception e) {
                        Log.w(TAG, "Engine update warning: " + e.getMessage());
                    }
                }
            }
        }
    }

    private synchronized void ensureInitialized() throws YoutubeDLException {
        if (!isInitialized) {
            YoutubeDL.getInstance().init(getContext());
            try {
                com.yausername.ffmpeg.FFmpeg.getInstance().init(getContext());
                Log.i(TAG, "FFmpeg initialized successfully");
            } catch (Exception e) {
                Log.w(TAG, "FFmpeg initialization warning: " + e.getMessage());
            }
            isInitialized = true;
        }
    }

    @PluginMethod
    public void initEngine(PluginCall call) {
        executor.execute(() -> {
            try {
                ensureInitialized();
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("version", YoutubeDL.getInstance().version(getContext()));
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "Failed to initialize YoutubeDL engine", e);
                call.reject("Initialization error: " + (e.getMessage() != null ? e.getMessage() : e.toString()));
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

        if (url == null || url.trim().isEmpty()) {
            call.reject("URL cannot be empty");
            return;
        }

        executor.execute(() -> {
            try {
                ensureInitialized();
                ensureEngineUpdated();

                File vortexFolder = null;
                try {
                    File publicDownloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    File publicVortex = new File(publicDownloadDir, "Vortex");
                    if (publicVortex.exists() || publicVortex.mkdirs()) {
                        if (publicVortex.canWrite()) {
                            vortexFolder = publicVortex;
                        }
                    }
                } catch (Exception ignored) {}

                if (vortexFolder == null) {
                    File appExtDir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    vortexFolder = new File(appExtDir != null ? appExtDir : getContext().getFilesDir(), "Vortex");
                    if (!vortexFolder.exists()) {
                        vortexFolder.mkdirs();
                    }
                }

                YoutubeDLRequest request = new YoutubeDLRequest(url.trim());
                request.addOption("-o", vortexFolder.getAbsolutePath() + "/%(title)s.%(ext)s");
                request.addOption("--no-mtime");
                request.addOption("--no-playlist");
                request.addOption("--restrict-filenames");
                request.addOption("--no-check-certificates");
                request.addOption("--no-update");
                request.addOption("--extractor-args", "youtube:player-client=ios,mweb");

                try {
                    File ffmpegDir = new File(new File(getContext().getNoBackupFilesDir(), "youtubedl-android/packages"), "ffmpeg");
                    if (ffmpegDir.exists()) {
                        request.addOption("--ffmpeg-location", ffmpegDir.getAbsolutePath());
                    }
                } catch (Exception ignored) {}

                if ("audio_mp3".equals(format)) {
                    request.addOption("-x");
                    request.addOption("-f", "bestaudio/best");
                    request.addOption("--audio-format", "mp3");
                    request.addOption("--audio-quality", "0");
                } else if ("video_1080p".equals(format)) {
                    request.addOption("-f", "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best");
                    request.addOption("--merge-output-format", "mp4");
                } else if ("video_4k".equals(format)) {
                    request.addOption("-f", "bestvideo[height<=2160]+bestaudio/best");
                    request.addOption("--merge-output-format", "mp4");
                } else {
                    request.addOption("-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best");
                    request.addOption("--merge-output-format", "mp4");
                }

                File finalFolder = vortexFolder;
                long downloadStartTime = System.currentTimeMillis() - 2000;
                YoutubeDLResponse response = YoutubeDL.getInstance().execute(request, id, (progress, etaInSeconds, line) -> {
                    JSObject progressData = new JSObject();
                    progressData.put("id", id);
                    progressData.put("status", "downloading");
                    progressData.put("percent", (double) progress);
                    progressData.put("eta", etaInSeconds + "s");
                    notifyListeners("onProgress", progressData);
                    return Unit.INSTANCE;
                });

                File downloadedFile = null;
                File[] files = finalFolder.listFiles();
                if (files != null && files.length > 0) {
                    long latestTime = 0;
                    for (File f : files) {
                        if (f.isFile() && f.lastModified() >= downloadStartTime && f.lastModified() > latestTime) {
                            latestTime = f.lastModified();
                            downloadedFile = f;
                        }
                    }
                    if (downloadedFile == null) {
                        for (File f : files) {
                            if (f.isFile() && f.lastModified() > latestTime) {
                                latestTime = f.lastModified();
                                downloadedFile = f;
                            }
                        }
                    }
                }

                String actualFilePath = downloadedFile != null ? downloadedFile.getAbsolutePath() : finalFolder.getAbsolutePath();
                String actualFileName = downloadedFile != null ? downloadedFile.getName() : "Vortex_Download_" + id;
                long actualFileSize = downloadedFile != null ? downloadedFile.length() : 0;
                String actualTitle = downloadedFile != null ? downloadedFile.getName().replaceFirst("[.][^.]+$", "") : "";

                try {
                    String mimeType = "audio_mp3".equals(format) ? "audio/mpeg" : "video/mp4";
                    android.media.MediaScannerConnection.scanFile(
                        getContext(),
                        new String[]{ actualFilePath },
                        new String[]{ mimeType },
                        (path, uri) -> Log.i(TAG, "MediaScanner indexed: " + path + " -> " + uri)
                    );
                } catch (Exception ignored) {}

                JSObject finishData = new JSObject();
                finishData.put("id", id);
                finishData.put("status", "completed");
                finishData.put("percent", 100.0);
                finishData.put("path", actualFilePath);
                finishData.put("filename", actualFileName);
                finishData.put("filesize", actualFileSize);
                finishData.put("title", actualTitle);
                finishData.put("output", response.getOut());
                notifyListeners("onProgress", finishData);

                JSObject result = new JSObject();
                result.put("success", true);
                result.put("id", id);
                result.put("filePath", actualFilePath);
                result.put("filename", actualFileName);
                result.put("downloadDir", finalFolder.getAbsolutePath());
                call.resolve(result);

            } catch (Exception e) {
                Log.e(TAG, "Download error for URL: " + url, e);
                String errorMsg = e.getMessage();
                if (errorMsg == null || errorMsg.trim().isEmpty()) {
                    errorMsg = e.toString();
                }
                JSObject errorData = new JSObject();
                errorData.put("id", id);
                errorData.put("status", "error");
                errorData.put("error", errorMsg);
                notifyListeners("onProgress", errorData);
                call.reject("Download failed: " + errorMsg);
            }
        });
    }

    @PluginMethod
    public void updateEngine(PluginCall call) {
        executor.execute(() -> {
            try {
                ensureInitialized();
                YoutubeDL.getInstance().updateYoutubeDL(getContext(), YoutubeDL.UpdateChannel.NIGHTLY.INSTANCE);
                engineUpdateTriggered = true;
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("version", YoutubeDL.getInstance().version(getContext()));
                call.resolve(ret);
            } catch (Exception e) {
                Log.w(TAG, "Update engine warning: " + e.getMessage());
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("error", e.getMessage());
                call.resolve(ret);
            }
        });
    }

    @PluginMethod
    public void fetchMetadata(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("URL cannot be empty");
            return;
        }

        executor.execute(() -> {
            try {
                ensureInitialized();
                YoutubeDLRequest request = new YoutubeDLRequest(url.trim());
                request.addOption("--no-playlist");
                request.addOption("--no-check-certificates");
                request.addOption("--extractor-args", "youtube:player-client=ios,mweb");
                VideoInfo info = YoutubeDL.getInstance().getInfo(request);

                JSObject ret = new JSObject();
                ret.put("title", info.getTitle());
                ret.put("uploader", info.getUploader());
                ret.put("duration", info.getDuration());
                ret.put("thumbnail", info.getThumbnail());
                ret.put("url", url);
                call.resolve(ret);
            } catch (Exception e) {
                Log.w(TAG, "fetchMetadata error: " + e.getMessage());
                call.reject("Failed to fetch metadata: " + e.getMessage());
            }
        });
    }
}
