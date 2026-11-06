package com.ezwin.orbita;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OrbitaUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
