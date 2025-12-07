import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Heart, Lightbulb, Users, GraduationCap, Building2, Plane, Hotel, Bus, Home, Theater, TreePine } from "lucide-react";
import busIconUrl from "@assets/bus-buddy-logo.png";
import foundersPhotoUrl from "@assets/Boys_Suit_-_Bus_Buddy_1765140708567.jpg";
import { PublicHeader } from "@/components/PublicHeader";

const industries = [
  { name: "Schools & Universities", icon: GraduationCap, description: "Student transportation tracking" },
  { name: "Hospitals & Healthcare", icon: Building2, description: "Patient and staff shuttles" },
  { name: "Airports", icon: Plane, description: "Terminal and parking shuttles" },
  { name: "Hotels & Resorts", icon: Hotel, description: "Guest transportation services" },
  { name: "Senior Living", icon: Home, description: "Resident activity shuttles" },
  { name: "Corporate Campuses", icon: Building2, description: "Employee shuttle programs" },
  { name: "Public Transit", icon: Bus, description: "City and commuter shuttles" },
  { name: "Theme Parks & Venues", icon: Theater, description: "Guest shuttle services" },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <PublicHeader />
      <div className="container mx-auto px-4 py-8">

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex justify-center mb-6">
              <img 
                src={busIconUrl} 
                alt="Bus Buddy" 
                className="w-20 h-20 rounded-2xl shadow-lg"
              />
            </div>
            <h1 className="text-4xl font-bold mb-4">Our Story</h1>
            <p className="text-lg text-muted-foreground">
              How two students turned frustration into innovation
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <div className="order-2 md:order-1">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Lightbulb className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">The Problem</h3>
                    <p className="text-muted-foreground">
                      One morning, Evan and Ryan Ghorayeb, 15-year-old twins, were left waiting 
                      on the curb—unaware their bus had already come and gone. They ended up 
                      missing school and realized that no kid should be left in the dark like that.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-bus-active/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Heart className="w-5 h-5 text-bus-active" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">The Solution</h3>
                    <p className="text-muted-foreground">
                      Later that day, they teamed up with their family to build a solution. 
                      What started as a simple idea turned into Bus Buddy—an app designed to 
                      make sure no student ever has to wonder where their bus is again.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Users className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Our Mission</h3>
                    <p className="text-muted-foreground">
                      Led by the belief that everyone deserves confidence in their transportation, 
                      we're committed to bringing peace of mind to families, schools, and 
                      organizations everywhere.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 md:order-2">
              <div className="bg-gradient-to-br from-primary/5 to-bus-active/5 rounded-2xl p-8 text-center">
                <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary to-bus-active flex items-center justify-center">
                  <span className="text-5xl font-bold text-white">E&R</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">Evan & Ryan Ghorayeb</h3>
                <p className="text-muted-foreground mb-4">Co-Founders, Age 15</p>
                <p className="text-sm text-muted-foreground italic">
                  "We experienced firsthand how unreliable school transportation tracking could be. 
                  We built Bus Buddy so no one else has to go through that."
                </p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-8 mb-12">
            <h2 className="text-2xl font-bold mb-6 text-center">What We Believe</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">1</span>
                </div>
                <h4 className="font-semibold mb-2">Safety First</h4>
                <p className="text-sm text-muted-foreground">
                  Every parent deserves to know their child is safe and on track
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-bus-active/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">2</span>
                </div>
                <h4 className="font-semibold mb-2">No Guesswork</h4>
                <p className="text-sm text-muted-foreground">
                  Real-time tracking eliminates uncertainty and reduces stress
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">3</span>
                </div>
                <h4 className="font-semibold mb-2">Built for Everyone</h4>
                <p className="text-sm text-muted-foreground">
                  Schools, hospitals, airports, and more—we serve all transportation needs
                </p>
              </div>
            </div>
          </div>

          {/* Industries We Serve */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-2 text-center">Industries We Serve</h2>
            <p className="text-muted-foreground text-center mb-8">
              Trusted by organizations of all sizes across multiple sectors
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {industries.map((industry) => (
                <div 
                  key={industry.name}
                  className="bg-card rounded-xl p-4 text-center hover-elevate"
                  data-testid={`industry-${industry.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <industry.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h4 className="font-semibold text-sm mb-1">{industry.name}</h4>
                  <p className="text-xs text-muted-foreground">{industry.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Meet the Founders */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-8 text-center">Meet the Founders</h2>
            <div className="bg-gradient-to-br from-primary/5 to-bus-active/5 rounded-2xl p-8 max-w-2xl mx-auto">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-shrink-0">
                  <img 
                    src={foundersPhotoUrl} 
                    alt="Evan and Ryan Ghorayeb, Co-Founders of Bus Buddy" 
                    className="w-64 h-64 object-cover rounded-2xl shadow-lg"
                  />
                </div>
                <div className="text-center md:text-left">
                  <h3 className="text-xl font-semibold mb-2">Evan & Ryan Ghorayeb</h3>
                  <p className="text-muted-foreground mb-4">Co-Founders</p>
                  <p className="text-muted-foreground text-sm mb-4">
                    While sitting in on MBA classes at MIT Sloan with their dad, Evan and Ryan learned 
                    a valuable lesson: don't just recognize problems—become a problem solver who creates 
                    real solutions that make a difference.
                  </p>
                  <p className="text-sm text-muted-foreground italic">
                    "We turned a frustrating morning into a mission to help families everywhere feel 
                    confident about their transportation."
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-muted-foreground mb-6">
              Join the growing number of organizations using Bus Buddy to keep their riders safe and informed.
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              <Button asChild data-testid="button-get-started">
                <Link href="/get-started">
                  Get Started
                </Link>
              </Button>
              <Button variant="outline" asChild data-testid="button-contact-us">
                <Link href="/contact">
                  Contact Us
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="text-center mt-16 text-sm text-muted-foreground">
          <p>Operated by Ride Tech LLC</p>
        </div>
      </div>
    </div>
  );
}
