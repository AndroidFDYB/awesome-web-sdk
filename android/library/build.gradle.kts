plugins {
    alias(libs.plugins.android.library)
    `maven-publish`
}

android {
    namespace = "com.github.lzyzsd.library"

    compileSdk {
        version = release(36) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        minSdk = 24

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        consumerProguardFiles("consumer-rules.pro")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
    publishing {
        singleVariant("release") {
            withSourcesJar()
        }
    }
}

// ========================================
// GitHub Packages (Maven) 发布配置
// ========================================
// 坐标：com.sharknade:jsbridge（and_web_library 的 Maven 传递依赖坐标）
// 版本：CI 由 tag 提取后经 -Pversion 注入；本地缺省 0.0.0-SNAPSHOT
afterEvaluate {
    publishing {
        publications {
            create<MavenPublication>("release") {
                groupId = "com.sharknade"
                artifactId = "jsbridge"
                version = (project.findProperty("version") as String?) ?: "0.0.0-SNAPSHOT"
                from(components["release"])
            }
        }
        repositories {
            maven {
                name = "GitHubPackages"
                url = uri("https://maven.pkg.github.com/AndroidFDYB/awesome-web-sdk")
                credentials {
                    username = (project.findProperty("gpr.user") as String?) ?: System.getenv("GITHUB_ACTOR") ?: ""
                    password = (project.findProperty("gpr.key") as String?) ?: System.getenv("GITHUB_TOKEN") ?: ""
                }
            }
        }
    }
}

dependencies {
    implementation(libs.androidx.appcompat)
    implementation(libs.gson)
}
