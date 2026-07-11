import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Load release signing credentials from android/key.properties (not committed to git)
val keyPropertiesFile = rootProject.file("key.properties")
val keyProperties = Properties()
if (keyPropertiesFile.exists()) {
    keyProperties.load(keyPropertiesFile.inputStream())
}

android {
    namespace = "mw.mpc.mpc_mobile"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }

    signingConfigs {
        create("release") {
            keyAlias = keyProperties["keyAlias"] as String? ?: System.getenv("KEY_ALIAS") ?: ""
            keyPassword = keyProperties["keyPassword"] as String? ?: System.getenv("KEY_PASSWORD") ?: ""
            storeFile = (keyProperties["storeFile"] as String? ?: System.getenv("STORE_FILE") ?: "").let {
                if (it.isNotEmpty()) file(it) else null
            }
            storePassword = keyProperties["storePassword"] as String? ?: System.getenv("STORE_PASSWORD") ?: ""
        }
    }

    defaultConfig {
        applicationId = "mw.mpc.mpc_mobile"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            signingConfig = if (keyPropertiesFile.exists() || System.getenv("KEY_ALIAS") != null)
                signingConfigs.getByName("release")
            else
                signingConfigs.getByName("debug") // dev builds only; never ship this to Play Store
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
}

flutter {
    source = "../.."
}
