package com.vortex.app;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.yausername.youtubedl_android.YoutubeDL;

import java.util.concurrent.Executors;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VortexDownloaderPlugin.class);
        super.onCreate(savedInstanceState);

        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                YoutubeDL.getInstance().init(getApplicationContext());
                Log.i(TAG, "YoutubeDL pre-initialized successfully");

                try {
                    com.yausername.ffmpeg.FFmpeg.getInstance().init(getApplicationContext());
                    Log.i(TAG, "FFmpeg pre-initialized successfully");
                } catch (Exception fe) {
                    Log.w(TAG, "FFmpeg pre-init warning: " + fe.getMessage());
                }

                try {
                    YoutubeDL.getInstance().updateYoutubeDL(getApplicationContext(), YoutubeDL.UpdateChannel.NIGHTLY.INSTANCE);
                    Log.i(TAG, "YoutubeDL updated to latest NIGHTLY release");
                } catch (Exception ue) {
                    Log.w(TAG, "YoutubeDL background update warning: " + ue.getMessage());
                }
            } catch (Exception e) {
                Log.e(TAG, "Pre-init error: " + e.getMessage());
            }
        });
    }
}
