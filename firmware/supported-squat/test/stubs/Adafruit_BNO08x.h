#pragma once
#include <stdint.h>
constexpr int SH2_ARVR_STABILIZED_RV=1;
struct sh2_SensorValue_t {int sensorId=1;uint8_t accuracy=3;struct {struct {float real=1,i=0,j=0,k=0;uint8_t accuracy=3;} arvrStabilizedRV;} un;};
struct Adafruit_BNO08x {
 bool events=true,reset=false;
 explicit Adafruit_BNO08x(int){}
 bool wasReset(){bool r=reset;reset=false;return r;}
 bool enableReport(int,int){return true;}
 bool getSensorEvent(sh2_SensorValue_t*){return events;}
 bool begin_I2C(int,void*){return true;}
};
