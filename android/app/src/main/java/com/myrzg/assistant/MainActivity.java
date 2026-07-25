package com.myrzg.assistant;

import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MYRZG_MainActivity";
    private static final int OVERLAY_PERMISSION_REQUEST_CODE = 1234;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 设置沉浸式状态栏与浅色系统 UI 标志
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
            );
        }

        // 设定 WebView 文字大小缩放锁定 (防系统字体变大打乱页面)
        setupWebViewSettings();
    }

    /**
     * 配置 WebView 基础属性与字体锁定
     */
    private void setupWebViewSettings() {
        getWindow().getDecorView().postOnAnimation(() -> {
            WebView wv = (bridge != null) ? bridge.getWebView() : null;
            if (wv != null) {
                WebSettings settings = wv.getSettings();
                settings.setTextZoom(100); // 锁定网页字体不被系统字体放大
                settings.setAllowFileAccess(true);
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setAllowContentAccess(true);
            }
        });
    }
}
