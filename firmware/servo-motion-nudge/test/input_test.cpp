#include "../src/main.cpp"
#include <cassert>
#include <cstdio>
void feed(const std::string& value){for(char c:value)Serial.input.push_back(c);readInput();}
int main(){
 // An ARM suffix on a rejected line must not arm the servo.
 feed(std::string(41,'x')+"ARM ID11\r\nMOVE OUTWARD\n");assert(!armed&&servo.writes.empty());
 assert(Serial.output.find("motion_command_overflow_rejected")!=std::string::npos);
 // Already armed: an overlong MOVE suffix must not move and must disarm.
 feed("ARM ID11\n");assert(armed);
 feed(std::string(41,'x')+"MOVE OUTWARD\nMOVE INWARD\n");assert(!armed&&servo.writes.empty());
 // Overflow persists across reads; CRLF recovery permits a new valid command.
 feed(std::string(10000,'x'));assert(overflow&&line.empty());
 feed("ARM ID11\n");assert(!armed&&servo.writes.empty());
 feed("ARM ID11\nMOVE OUTWARD\n");assert(!armed&&servo.motors[11].goal==877);
 puts("Nudge input: overflow suffixes rejected, disarmed, bounded and recovered");
}
