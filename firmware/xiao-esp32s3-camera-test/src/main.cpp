// main.cpp
// カメラ初期化 → 1枚撮影 → サイズをシリアル出力。
// （中身は次のステップでチャットで説明・承認してから書き込みます）

// カメラの設定ファイル import
  #include <Arduino.h>
  #include "esp_camera.h"
  #include "camera_pins.h"


void setup() {
    Serial.begin(115200);
    delay(1000);  // シリアルが立ち上がるのを少し待つ

    // ① カメラの設定書を作る（構造体に詰める）
    camera_config_t config;
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer   = LEDC_TIMER_0;

    // ピンの割り当て（camera_pins.h の定義を渡す）
    config.pin_d0       = Y2_GPIO_NUM;
    config.pin_d1       = Y3_GPIO_NUM;
    config.pin_d2       = Y4_GPIO_NUM;
    config.pin_d3       = Y5_GPIO_NUM;
    config.pin_d4       = Y6_GPIO_NUM;
    config.pin_d5       = Y7_GPIO_NUM;
    config.pin_d6       = Y8_GPIO_NUM;
    config.pin_d7       = Y9_GPIO_NUM;
    config.pin_xclk     = XCLK_GPIO_NUM;
    config.pin_pclk     = PCLK_GPIO_NUM;
    config.pin_vsync    = VSYNC_GPIO_NUM;
    config.pin_href     = HREF_GPIO_NUM;
    config.pin_sccb_sda = SIOD_GPIO_NUM;
    config.pin_sccb_scl = SIOC_GPIO_NUM;
    config.pin_pwdn     = PWDN_GPIO_NUM;
    config.pin_reset    = RESET_GPIO_NUM;

    // ② 画質・動作の設定
    config.xclk_freq_hz = 20000000;            // カメラへのクロック 20MHz
    config.pixel_format = PIXFORMAT_JPEG;      // JPEG形式で受け取る
    config.frame_size   = FRAMESIZE_QVGA;      // まず低解像度 320x240 で安全に
    config.jpeg_quality = 12;                  // 数字が小さいほど高画質（0-63）
    config.fb_count     = 1;                    // フレームバッファ1枚
    config.fb_location  = CAMERA_FB_IN_PSRAM;  // バッファをPSRAMに置く
    config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;

    // ③ 初期化を実行
    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
      Serial.printf("Camera init failed: 0x%x\n", err);
      return;  // 失敗したらここで止める
    }
    Serial.println("Camera init success");
  }

  void loop() {
    camera_fb_t *fb = esp_camera_fb_get();   // 撮影。画像の入れ物のアドレスが返る
    if (!fb) {                               // 失敗時は中身が無い(NULL)
      Serial.println("Capture failed");
      delay(1000);
      return;
    }

    // 撮れた画像の情報を表示
    Serial.printf("Captured: %dx%d, %u bytes\n", fb->width, fb->height, fb->len);

    esp_camera_fb_return(fb);   // 入れ物を返す（メモリ解放）。これ重要！
    delay(5000);                // 5秒待って次の撮影
  }