package com.vortex.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VortexDownloaderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
