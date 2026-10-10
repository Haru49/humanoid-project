#pragma once
struct FakeWire {void beginTransmission(int){} int endTransmission(){return 0;} void begin(int,int,int){} void setTimeOut(int){} };
static FakeWire Wire;
