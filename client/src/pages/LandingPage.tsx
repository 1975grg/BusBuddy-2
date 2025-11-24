import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MapPin, Settings, ArrowRight, Bus, Shield, Bell } from "lucide-react";
import busIconUrl from "@assets/generated_images/Bus_Buddy_app_icon_a37f6bcb.png";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <img 
              src={busIconUrl} 
              alt="Bus Buddy" 
              className="w-24 h-24 rounded-2xl shadow-lg"
            />
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-bus-active bg-clip-text text-transparent">
            Bus Buddy
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-2">
            Real-time transportation tracking for schools, hospitals, airports, hotels, and public transportation
          </p>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Keep everyone connected with live GPS tracking, automatic notifications, and seamless communication between drivers, administrators, and riders.
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="grid md:grid-cols-3 gap-6 mb-16 max-w-4xl mx-auto">
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">Live GPS Tracking</h3>
            <p className="text-sm text-muted-foreground">Real-time location updates with geofenced proximity notifications</p>
          </div>
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-12 h-12 rounded-full bg-bus-active/10 flex items-center justify-center mb-3">
              <Bell className="w-6 h-6 text-bus-active" />
            </div>
            <h3 className="font-semibold mb-2">Smart Notifications</h3>
            <p className="text-sm text-muted-foreground">Automatic SMS alerts when buses approach stops</p>
          </div>
          <div className="flex flex-col items-center text-center p-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
              <Shield className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="font-semibold mb-2">Secure & Reliable</h3>
            <p className="text-sm text-muted-foreground">Multi-organization support with role-based access control</p>
          </div>
        </div>

        {/* Portal Cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Parents & Students Portal */}
          <Card className="hover-elevate transition-all">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-white" />
              </div>
              <CardTitle>Parents & Students</CardTitle>
              <CardDescription className="text-base">
                Track your bus in real-time and receive arrival notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Live bus location on map</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                  <span>5-minute approach warnings</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Arrival notifications at your stop</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Direct messaging with admins</span>
                </li>
              </ul>
              <div className="pt-4 space-y-2">
                <Button className="w-full" asChild data-testid="button-rider-login">
                  <Link href="/login">
                    Access Bus Tracker
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Use QR code or magic link from your school
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Driver Portal */}
          <Card className="hover-elevate transition-all">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center mb-4">
                <Bus className="w-6 h-6 text-white" />
              </div>
              <CardTitle>Driver Portal</CardTitle>
              <CardDescription className="text-base">
                Manage routes and communicate with dispatch
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Start and manage route trips</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Automatic stop progression</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                  <span>GPS tracking enabled automatically</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Message administrators directly</span>
                </li>
              </ul>
              <div className="pt-4 space-y-2">
                <Button className="w-full" variant="default" asChild data-testid="button-driver-login">
                  <Link href="/driver">
                    Driver Login
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Use magic link or QR code from admin
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Admin Portal */}
          <Card className="hover-elevate transition-all">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center mb-4">
                <Settings className="w-6 h-6 text-white" />
              </div>
              <CardTitle>Admin Portal</CardTitle>
              <CardDescription className="text-base">
                Manage routes, access, and communications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Configure routes and stops</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Manage rider and driver access</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Monitor all active routes</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
                  <span>Support center for messages</span>
                </li>
              </ul>
              <div className="pt-4 space-y-2">
                <Button className="w-full" variant="default" asChild data-testid="button-admin-login">
                  <Link href="/admin">
                    Admin Login
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Organization administrators only
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="text-center mt-16 text-sm text-muted-foreground">
          <p>Operated by Ride Tech LLC</p>
          <p className="mt-2">Serving schools, hospitals, airports, hotels, and public transportation with reliable tracking</p>
        </div>
      </div>
    </div>
  );
}
