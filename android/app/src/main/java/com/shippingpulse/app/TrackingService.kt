package com.shippingpulse.app

import android.Manifest
import android.app.*
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.*
import android.webkit.CookieManager
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Explicit, user-initiated foreground location sharing. No background-start or hidden tracking.
 * The session cookie is read from the same WebView origin and never stored in source code.
 */
class TrackingService : Service(), LocationListener {
    companion object {
        const val START = "com.shippingpulse.app.START_TRACKING"
        const val STOP = "com.shippingpulse.app.STOP_TRACKING"
        const val CHANNEL = "driver_location"
        const val BASE = "https://shipping-erp.pages.dev"
    }
    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var locations: LocationManager
    private var running = false
    private var lastSent = 0L
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onCreate() {
        super.onCreate()
        locations = getSystemService(LOCATION_SERVICE) as LocationManager
        val channel = NotificationChannel(CHANNEL, "مشاركة موقع المندوب", NotificationManager.IMPORTANCE_LOW)
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }
    private fun notification(): Notification {
        val stopIntent = Intent(this, TrackingService::class.java).setAction(STOP)
        val stop = PendingIntent.getService(this, 1, stopIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        return Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("Shipping Pulse — مشاركة الموقع مفعلة")
            .setContentText("يتم مشاركة موقعك مع الإدارة أثناء الوردية. اضغط للإيقاف.")
            .setOngoing(true)
            .addAction(android.R.drawable.ic_media_pause, "إيقاف المشاركة", stop)
            .build()
    }
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == STOP) {
            stopSharing()
            return START_NOT_STICKY
        }
        if (intent?.action != START || running) return START_NOT_STICKY
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            stopSelf()
            return START_NOT_STICKY
        }
        try {
            if (Build.VERSION.SDK_INT >= 29) startForeground(41, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
            else startForeground(41, notification())
            running = true
            locations.requestLocationUpdates(LocationManager.GPS_PROVIDER, 15000L, 15f, this, Looper.getMainLooper())
            if (locations.isProviderEnabled(LocationManager.NETWORK_PROVIDER))
                locations.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 15000L, 15f, this, Looper.getMainLooper())
        } catch (e: Exception) { stopSharing() }
        return START_NOT_STICKY
    }
    override fun onLocationChanged(location: Location) {
        if (!running || System.currentTimeMillis() - lastSent < 15000) return
        lastSent = System.currentTimeMillis()
        send("{\"sharing\":true,\"latitude\":${location.latitude},\"longitude\":${location.longitude},\"accuracy\":${location.accuracy}}")
    }
    private fun send(json: String) {
        executor.execute {
            try {
                val cookie = CookieManager.getInstance().getCookie(BASE) ?: return@execute
                val connection = URL("$BASE/api/driver-live-location").openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.connectTimeout = 10000
                connection.readTimeout = 10000
                connection.setRequestProperty("Content-Type", "application/json")
                connection.setRequestProperty("Origin", BASE)
                connection.setRequestProperty("Cookie", cookie)
                connection.doOutput = true
                connection.outputStream.use { it.write(json.toByteArray(Charsets.UTF_8)) }
                connection.inputStream.close()
                connection.disconnect()
            } catch (_: Exception) { /* Offline or session expired; no location is queued. */ }
        }
    }
    private fun stopSharing() {
        running = false
        try { locations.removeUpdates(this) } catch (_: Exception) {}
        send("{\"sharing\":false}")
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }
    override fun onDestroy() {
        if (running) stopSharing()
        executor.shutdown()
        super.onDestroy()
    }
}
