#pragma once
#include <stdint.h>
#include <string>
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdarg>
#include <deque>
static uint32_t fakeNow=1000;
inline uint32_t millis(){return fakeNow;}
inline void delay(int n){fakeNow+=n;}
constexpr int D3=3,D4=4,D5=5,D6=6,D7=7,LOW=0,INPUT_PULLUP=2,SERIAL_8N1=0;
constexpr float RAD_TO_DEG=57.2957795F;
inline void pinMode(int,int){}
inline int digitalRead(int){return 0;}
inline float sq(float x){return x*x;}
template<class T> T constrain(T x,T a,T b){return std::max(a,std::min(x,b));}
class String:public std::string {
public:
 using std::string::string;
 String& operator=(const char* s){std::string::operator=(s);return *this;}
 void trim(){ auto b=find_first_not_of(" \t\r\n"); if(b==npos){clear();return;} auto e=find_last_not_of(" \t\r\n"); std::string::operator=(substr(b,e-b+1)); }
};
struct FakeSerial {
 std::string output; std::deque<char> input;
 void begin(int,int=0,int=0,int=0){}
 int available(){return input.size();}
 int read(){char c=input.front();input.pop_front();return c;}
 void printf(const char* fmt,...){char b[1024];va_list a;va_start(a,fmt);vsnprintf(b,sizeof(b),fmt,a);va_end(a);output+=b;}
};
static FakeSerial Serial,Serial1;
