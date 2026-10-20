package com.shippingpulse.app

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.webkit.GeolocationPermissions
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.widget.Button
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.widget.LinearLayout
import android.view.View
import android.webkit.CookieManager
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : Activity() {
    private lateinit var browser: WebView
    private lateinit var trackingButton: Button
    private var isDriver = false
    private var sharing = false
    private var pendingOrigin: String? = null
    private var pendingGeoCallback: GeolocationPermissions.Callback? = null
    private val base = "https://shipping-erp.pages.dev/"
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        browser = WebView(this)
        val layout = LinearLayout(this)
        layout.orientation = LinearLayout.VERTICAL
        trackingButton = Button(this)
        trackingButton.text = "📍 بدء مشاركة الموقع"
        trackingButton.textSize = 13f
        trackingButton.isAllCaps = false
        trackingButton.setTextColor(Color.rgb(39, 25, 65))
        trackingButton.setTypeface(null, Typeface.BOLD)
        trackingButton.background = GradientDrawable().apply {
            setColor(Color.rgb(210, 236, 109))
            cornerRadius = 26f
        }
        trackingButton.setPadding(18, 8, 18, 8)
        trackingButton.visibility = View.GONE
        trackingButton.setOnClickListener {
            if (!isDriver) return@setOnClickListener
            if (sharing) {
                startService(Intent(this, TrackingService::class.java).setAction(TrackingService.STOP))
                sharing = false
                trackingButton.text = "📍 بدء مشاركة الموقع"
            } else if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                startForegroundService(Intent(this, TrackingService::class.java).setAction(TrackingService.START))
                sharing = true
                trackingButton.text = "■ إيقاف مشاركة الموقع"
            } else {
                requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), 7)
            }
        }
        val trackingRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setBackgroundColor(Color.rgb(37, 23, 65))
            setPadding(12, 5, 12, 5)
            gravity = android.view.Gravity.CENTER
        }
        trackingRow.addView(trackingButton, LinearLayout.LayoutParams(-2, -2))
        trackingRow.visibility = View.GONE
        layout.addView(trackingRow)
        layout.addView(browser, LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(layout)
        browser.settings.javaScriptEnabled = true
        browser.settings.domStorageEnabled = true
        browser.settings.setGeolocationEnabled(true)
        browser.settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        browser.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                Thread {
                    try {
                        val cookie = CookieManager.getInstance().getCookie(base) ?: ""
                        val conn = URL(base + "api/auth/me").openConnection() as HttpURLConnection
                        conn.setRequestProperty("Cookie", cookie)
                        conn.connectTimeout = 10000
                        conn.readTimeout = 10000
                        val body = conn.inputStream.bufferedReader().use { it.readText() }
                        conn.disconnect()
                        val obj = JSONObject(body)
                        val role = obj.optJSONObject("user")?.optString("role") ?: ""
                        runOnUiThread {
                            isDriver = role == "driver"
                            trackingButton.visibility = if (isDriver) View.VISIBLE else View.GONE
                            trackingRow.visibility = if (isDriver) View.VISIBLE else View.GONE
                            if (!isDriver && sharing) {
                                startService(Intent(this@MainActivity, TrackingService::class.java).setAction(TrackingService.STOP))
                                sharing = false
                            }
                        }
                    } catch (_: Exception) {
                        runOnUiThread { isDriver = false; trackingButton.visibility = View.GONE; trackingRow.visibility = View.GONE }
                    }
                }.start()
            }
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url ?: return false
                if (url.scheme == "https" && url.host == "shipping-erp.pages.dev") return false
                startActivity(Intent(Intent.ACTION_VIEW, url))
                return true
            }
        }
        browser.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(origin: String?, callback: GeolocationPermissions.Callback?) {
                if (origin == null || Uri.parse(origin).host != "shipping-erp.pages.dev" || Uri.parse(origin).scheme != "https" || callback == null) { callback?.invoke(origin, false, false); return }
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                    checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false)
                } else {
                    pendingOrigin = origin
                    pendingGeoCallback = callback
                    requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), 7)
                }
            }
        }
        browser.loadUrl(base)
    }
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 7) {
            val allowed = grantResults.any { it == PackageManager.PERMISSION_GRANTED }
            pendingGeoCallback?.invoke(pendingOrigin, allowed, false)
            pendingOrigin = null
            pendingGeoCallback = null
        }
    }
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { if (browser.canGoBack()) browser.goBack() else super.onBackPressed() }
    override fun onDestroy() { browser.destroy(); super.onDestroy() }
}
