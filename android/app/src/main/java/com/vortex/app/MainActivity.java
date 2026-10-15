package com.vortex.app;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.yausername.youtubedl_android.FFmpeg;
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
                try {
                    FFmpeg.getInstance().init(getApplicationContext());
                } catch (Exception fe) {
                    Log.w(TAG, "FFmpeg pre-init: " + fe.getMessage());
                }
                Log.i(TAG, "YoutubeDL and FFmpeg pre-initialized successfully");
            } catch (Exception e) {
                Log.e(TAG, "Pre-init error: " + e.getMessage());
            }
        });
    }
}
