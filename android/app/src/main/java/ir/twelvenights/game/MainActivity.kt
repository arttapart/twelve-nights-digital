package ir.twelvenights.game

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.net.wifi.WifiManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import org.json.JSONObject
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetSocketAddress
import java.net.NetworkInterface

/**
 * 12 Nights phone app: a WebView shell. It finds the Windows host on the local network (UDP beacon "12SHAB <url>" on
 * port 47131) or by QR scan, then shows the host's phone page. All game logic runs on the host.
 */
class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private val main = Handler(Looper.getMainLooper())
    @Volatile private var listening = false
    private var sock: DatagramSocket? = null
    private var mlock: WifiManager.MulticastLock? = null
    private var lastBack = 0L

    private val askCamera = registerForActivityResult(ActivityResultContracts.RequestPermission()) { ok -> if (ok) startScan() }
    private val scanner = registerForActivityResult(ScanContract()) { r ->
        js("onScan", JSONObject().put("text", r.contents ?: JSONObject.NULL).toString())
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        web = WebView(this)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.mediaPlaybackRequiresUserGesture = false
        web.webChromeClient = WebChromeClient()
        web.webViewClient = object : WebViewClient() {
            override fun onReceivedError(view: WebView, req: WebResourceRequest, err: WebResourceError) {
                if (req.isForMainFrame && req.url.scheme == "http") main.post { finder("نشد به مانیتور وصل شوم. برنامهٔ ۱۲ شب روی کامپیوتر باز است؟") }
            }
        }
        web.setBackgroundColor(0xFF0B0C1D.toInt())
        web.addJavascriptInterface(Bridge(), "Android")
        setContentView(web)
        finder("")
    }

    private fun finder(msg: String) {
        web.loadUrl("file:///android_asset/finder.html#" + android.net.Uri.encode(msg))
    }

    override fun onDestroy() { stopListen(); super.onDestroy() }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        val u = web.url ?: ""
        if (u.startsWith("http")) {
            val now = System.currentTimeMillis()
            if (now - lastBack < 2000) { finder(""); return }
            lastBack = now
            Toast.makeText(this, "برای برگشتن به صفحهٔ اتصال دوباره بزن", Toast.LENGTH_SHORT).show()
            return
        }
        @Suppress("DEPRECATION") super.onBackPressed()
    }

    fun js(fn: String, json: String) {
        val q = JSONObject.quote(json)
        main.post { web.evaluateJavascript("window.$fn && window.$fn(JSON.parse($q))", null) }
    }

    private fun startScan() {
        val o = ScanOptions()
        o.setDesiredBarcodeFormats(ScanOptions.QR_CODE)
        o.setPrompt("QR روی مانیتور را اسکن کن")
        o.setBeepEnabled(false)
        o.setOrientationLocked(true)
        scanner.launch(o)
    }

    private fun startListen() {
        if (listening) return
        listening = true
        try {
            val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
            mlock = wm.createMulticastLock("12shab").also { it.setReferenceCounted(false); it.acquire() }
        } catch (_: Exception) {}
        Thread {
            try {
                val s = DatagramSocket(null)
                s.reuseAddress = true
                s.broadcast = true
                s.bind(InetSocketAddress(47131))
                s.soTimeout = 1500
                sock = s
                val buf = ByteArray(512)
                val seen = HashSet<String>()
                while (listening) {
                    try {
                        val p = DatagramPacket(buf, buf.size)
                        s.receive(p)
                        val t = String(p.data, 0, p.length, Charsets.UTF_8)
                        if (t.startsWith("12SHAB ")) {
                            val url = t.substring(7).trim()
                            if (seen.add(url)) js("onFound", JSONObject().put("url", url).toString())
                        }
                    } catch (_: java.net.SocketTimeoutException) {}
                }
                s.close()
            } catch (e: Exception) {
                js("onFindError", JSONObject().put("err", e.toString()).toString())
            }
        }.start()
    }

    private fun stopListen() {
        listening = false
        try { sock?.close() } catch (_: Exception) {}
        sock = null
        try { mlock?.release() } catch (_: Exception) {}
    }

    private fun myIps(): String {
        val res = ArrayList<String>()
        try {
            for (ni in NetworkInterface.getNetworkInterfaces()) for (a in ni.inetAddresses) {
                val h = a.hostAddress ?: continue
                if (!a.isLoopbackAddress && h.indexOf(':') < 0) res.add(h)
            }
        } catch (_: Exception) {}
        return res.joinToString(",")
    }

    inner class Bridge {
        @JavascriptInterface fun find(on: Boolean) = main.post { if (on) startListen() else stopListen() }
        @JavascriptInterface fun open(url: String) = main.post {
            stopListen()
            getSharedPreferences("p", MODE_PRIVATE).edit().putString("last", url).apply()
            web.loadUrl(url)
        }
        @JavascriptInterface fun last(): String = getSharedPreferences("p", MODE_PRIVATE).getString("last", "") ?: ""
        @JavascriptInterface fun ips(): String = myIps()
        @JavascriptInterface fun scan() = main.post {
            if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) askCamera.launch(Manifest.permission.CAMERA)
            else startScan()
        }
        @JavascriptInterface fun vibrate(ms: Int) {
            try { @Suppress("DEPRECATION") (getSystemService(VIBRATOR_SERVICE) as android.os.Vibrator).vibrate(ms.toLong()) } catch (_: Exception) {}
        }
    }
}
