// main.cpp (camera stream experiment)
// Step 1: Wi-Fi に接続して IP を表示
// Step 2: Webサーバーを立て、/jpg で1枚だけJPEGを返す

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include "esp_camera.h"
#include "secrets.h"     // WIFI_SSID, WIFI_PASSWORD
#include "camera_pins.h"

WebServer server(80);    // 80番ポートでHTTPサーバーを動かす

// カメラ初期化（camera-test と同じ設定をまとめた関数）
void startCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;

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

  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size   = FRAMESIZE_QVGA;      // まず320x240で軽く
  config.jpeg_quality = 12;
  config.fb_count     = 1;
  config.fb_location  = CAMERA_FB_IN_PSRAM;
  config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    return;
  }
  Serial.println("Camera init success");
}

// /jpg にアクセスが来たら、1枚撮ってJPEGを返す
void handleJpg() {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    server.send(500, "text/plain", "Camera capture failed");
    return;
  }
  server.setContentLength(fb->len);          // ① 本文の長さ(バイト数)を先に伝える
  server.send(200, "image/jpeg", "");        // ② ヘッダだけ送る
  server.client().write(fb->buf, fb->len);   // ③ JPEG本体を送る
  esp_camera_fb_return(fb);                  // バッファ返却（おなじみ）
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  startCamera();

  // --- Step 1: Wi-Fi接続 ---
  Serial.printf("Connecting to %s ...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("WiFi connected. IP: ");
  Serial.println(WiFi.localIP());

  // --- Step 2: Webサーバー開始 ---
  server.on("/jpg", handleJpg);   // /jpg のリクエストは handleJpg が処理
  server.begin();
  Serial.print("Open  http://");
  Serial.print(WiFi.localIP());
  Serial.println("/jpg  in your browser");
}

void loop() {
  server.handleClient();   // 来たリクエストを処理し続ける
}
