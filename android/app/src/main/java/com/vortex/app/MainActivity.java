package com.vortex.app;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.yausername.youtubedl_android.YoutubeDL;

import java.lang.reflect.Method;
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
                    for (Method m : YoutubeDL.getInstance().getClass().getMethods()) {
                        if (m.getName().equals("updateYoutubeDL")) {
                            Class<?>[] pTypes = m.getParameterTypes();
                            if (pTypes.length == 2 && pTypes[1].isEnum()) {
                                Object[] constants = pTypes[1].getEnumConstants();
                                if (constants != null && constants.length > 0) {
                                    m.invoke(YoutubeDL.getInstance(), getApplicationContext(), constants[0]);
                                    Log.i(TAG, "YoutubeDL updated to latest stable version");
                                    break;
                                }
                            }
                        }
                    }
                } catch (Exception ue) {
                    Log.w(TAG, "YoutubeDL background update warning: " + ue.getMessage());
                }
            } catch (Exception e) {
                Log.e(TAG, "Pre-init error: " + e.getMessage());
            }
        });
    }
}
