package et.gov.ethio.transport;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

public class MainActivity extends AppCompatActivity {
    private WebView web;
    private WebView startupOverlay;
    private static final String START_URL =
            "https://ethio-transport.vercel.app/?app_version=1.0.8&native_recovery=1";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);

        web = new WebView(this);
        web.clearCache(true);
        web.clearHistory();
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        startupOverlay = new WebView(this);
        startupOverlay.setBackgroundColor(Color.WHITE);
        WebSettings splashSettings = startupOverlay.getSettings();
        splashSettings.setJavaScriptEnabled(false);
        splashSettings.setAllowFileAccess(true);
        splashSettings.setAllowContentAccess(false);
        startupOverlay.setVerticalScrollBarEnabled(false);
        startupOverlay.setHorizontalScrollBarEnabled(false);
        startupOverlay.loadUrl("file:///android_asset/ethio_transport_logo.svg");

        root.addView(startupOverlay, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));

        setContentView(root);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
            WebSettingsCompat.setForceDark(settings, WebSettingsCompat.FORCE_DARK_OFF);
        }

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                if (startupOverlay != null) {
                    startupOverlay.setVisibility(android.view.View.GONE);
                }
            }
        });

        web.loadUrl(START_URL);
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (startupOverlay != null) {
            startupOverlay.stopLoading();
            startupOverlay.destroy();
            startupOverlay = null;
        }
        if (web != null) {
            web.stopLoading();
            web.setWebViewClient(null);
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
