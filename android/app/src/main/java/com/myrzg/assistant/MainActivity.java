package com.myrzg.assistant;

import android.content.Intent;
import android.graphics.Color;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.view.ViewTreeObserver;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

import java.util.Collections;
import java.util.List;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MYRZG_MainActivity";
    private static final int OVERLAY_PERMISSION_REQUEST_CODE = 1234;

    /**
     * 屏幕左右两侧「不接受系统返回手势」的宽度（dp）。
     *
     * 为什么需要：安卓手势导航会在系统层拦截屏幕边缘的横向滑动，被拦截时
     * **WebView 完全收不到 touch 事件**。带来两个实际问题：
     *   1. 详情弹窗里靠近边缘的控件（等级滑条等）拖不动——手指一动就被判成系统返回；
     *   2. 从边缘向内滑会触发系统返回，直接把弹窗关掉，容易误触。
     * 用 `setSystemGestureExclusionRects` 把这两条边缘让给应用，系统不再在此区域抢手势。
     *
     * 代价（刻意选择，非副作用）：这两条边缘内**系统返回手势失效**。
     * 这是需求本身要求的——用户明确不希望边缘滑动关闭页面。
     * 返回仍可用：系统返回键 / 三大金刚键 / 应用内返回按钮。
     *
     * 上限：安卓对每个边缘的排除区有 200dp 上限（超出的部分会被系统忽略），24dp 远低于该限制。
     */
    private static final int GESTURE_EXCLUSION_EDGE_DP = 24;

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

        // 把左右边缘从系统返回手势中排除，避免误关弹窗与滑条拖不动
        setupGestureExclusion();
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

    /**
     * 在 WebView 左右两侧各排除一条 {@link #GESTURE_EXCLUSION_EDGE_DP} dp 的系统手势区。
     *
     * 为什么挂在 WebView 上而不是 decorView：排除矩形是**按视图**生效的，
     * 系统只在该视图范围内遵守排除声明；WebView 就是实际接收触摸的视图。
     *
     * 为什么用 OnPreDrawListener 逐帧设置：排除区会随窗口尺寸/旋转/分屏/系统栏显隐变化，
     * 逐帧重算最稳妥（`View.getRootWindowInsets()` 每帧调用开销很低）。
     * API 29 以下没有该能力，直接跳过（minSdk 24）。
     */
    private void setupGestureExclusion() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return;

        getWindow().getDecorView().postOnAnimation(() -> {
            final WebView wv = (bridge != null) ? bridge.getWebView() : null;
            if (wv == null) {
                Log.w(TAG, "WebView 未就绪，跳过手势排除设置");
                return;
            }
            final float density = getResources().getDisplayMetrics().density;
            final int edgePx = Math.round(GESTURE_EXCLUSION_EDGE_DP * density);
            final Rect left = new Rect();
            final Rect right = new Rect();

            wv.getViewTreeObserver().addOnPreDrawListener(new ViewTreeObserver.OnPreDrawListener() {
                @Override
                public boolean onPreDraw() {
                    int width = wv.getWidth();
                    int height = wv.getHeight();
                    if (width <= 0 || height <= 0) return true;

                    // 手势导航才有系统边缘手势；三键导航下无需排除（避免无谓地占用排除额度）
                    boolean gestureNav = false;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        WindowInsetsCompat insets =
                                WindowInsetsCompat.toWindowInsetsCompat(wv.getRootWindowInsets(), wv);
                        if (insets != null) {
                            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemGestures());
                            gestureNav = bars.left > 0 || bars.right > 0;
                        }
                    } else {
                        // API 29：WindowInsetsCompat 拿不到 systemGestures 类型，按「可能有」处理
                        gestureNav = true;
                    }

                    List<Rect> rects;
                    if (gestureNav) {
                        left.set(0, 0, Math.min(edgePx, width), height);
                        right.set(Math.max(0, width - edgePx), 0, width, height);
                        rects = java.util.Arrays.asList(left, right);
                    } else {
                        rects = Collections.emptyList();
                    }
                    if (!rects.equals(wv.getSystemGestureExclusionRects())) {
                        wv.setSystemGestureExclusionRects(rects);
                    }
                    return true;
                }
            });
        });
    }
}
