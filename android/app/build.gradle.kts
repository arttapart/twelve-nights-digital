plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
android {
    namespace = "ir.twelvenights.game"
    compileSdk = 34
    defaultConfig {
        applicationId = "ir.twelvenights.game"
        minSdk = 24
        targetSdk = 34
        versionCode = (System.getenv("VERSION_CODE") ?: "1").toInt()
        versionName = System.getenv("VERSION_NAME") ?: "1.0"
    }
    signingConfigs {
        create("release") {
            storeFile = file("../keystore/twelvenights.jks")
            storePassword = System.getenv("KEYSTORE_PASSWORD")?.ifBlank { null } ?: "12nights"
            keyAlias = "twelvenights"
            keyPassword = System.getenv("KEYSTORE_PASSWORD")?.ifBlank { null } ?: "12nights"
        }
    }
    buildTypes { release { isMinifyEnabled = false; signingConfig = signingConfigs.getByName("release") } }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
}
