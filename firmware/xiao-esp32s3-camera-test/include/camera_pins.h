#pragma once

// XIAO ESP32S3 Sense カメラピン定義
#define PWDN_GPIO_NUM   -1   // 電源制御。未使用なので -1
#define RESET_GPIO_NUM  -1   // リセット。未使用なので -1
#define XCLK_GPIO_NUM   10   // カメラへ送るクロック
#define SIOD_GPIO_NUM   40   // I2C(SCCB) データ … センサ設定用
#define SIOC_GPIO_NUM   39   // I2C(SCCB) クロック

// 画像データ線（8bit パラレル）Y2〜Y9
#define Y9_GPIO_NUM     48
#define Y8_GPIO_NUM     11
#define Y7_GPIO_NUM     12
#define Y6_GPIO_NUM     14
#define Y5_GPIO_NUM     16
#define Y4_GPIO_NUM     18
#define Y3_GPIO_NUM     17
#define Y2_GPIO_NUM     15

#define VSYNC_GPIO_NUM  38   // 垂直同期（フレームの区切り）
#define HREF_GPIO_NUM   47   // 水平同期（行の区切り）
#define PCLK_GPIO_NUM   13   // ピクセルクロック（1画素ごとのタイミング）
