import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, CheckCircle, School, Hospital, Plane, Hotel, Bus, Home, Theater } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import busIconUrl from "@assets/bus-buddy-logo.png";
import { PublicHeader } from "@/components/PublicHeader";

const organizationTypes = [
  { value: "school", label: "School / University", icon: School },
  { value: "hospital", label: "Hospital / Medical", icon: Hospital },
  { value: "airport", label: "Airport / Aviation", icon: Plane },
  { value: "hotel", label: "Hotel / Hospitality", icon: Hotel },
  { value: "senior_living", label: "Senior Living / Care", icon: Home },
  { value: "corporate", label: "Corporate Campus", icon: Building2 },
  { value: "transit", label: "Public Transit", icon: Bus },
  { value: "theme_park", label: "Theme Park / Venue", icon: Theater },
  { value: "other", label: "Other", icon: Building2 },
];

export default function GetStartedPage() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    organizationName: "",
    organizationType: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    estimatedFleetSize: "",
    message: "",
  });

  const inquiryMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/organization-inquiries", data);
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Request Submitted",
        description: "We'll be in touch within 1-2 business days.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.organizationName || !formData.organizationType || !formData.contactName || !formData.contactEmail) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    inquiryMutation.mutate(formData);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <PublicHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto text-center py-16">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Request Received!</h1>
            <p className="text-muted-foreground mb-4">
              Thank you for your interest in Bus Buddy. We've received your organization's information.
            </p>
            <p className="text-muted-foreground mb-8">
              Our team will review your request and reach out within <strong>1-2 business days</strong> to 
              discuss how we can help your organization.
            </p>
            <div className="flex justify-center gap-4">
              <Button asChild data-testid="button-return-home">
                <Link href="/">Return Home</Link>
              </Button>
              <Button variant="outline" asChild data-testid="button-learn-more">
                <Link href="/about">Learn More About Us</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            <h1 className="text-4xl font-bold mb-4">Get Started with Bus Buddy</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Bring real-time transportation tracking to your organization. 
              Tell us about yourself and we'll help you get set up.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {organizationTypes.slice(0, 3).map((type) => (
              <Card 
                key={type.value} 
                className={`cursor-pointer transition-all ${formData.organizationType === type.value ? 'ring-2 ring-primary' : 'hover-elevate'}`}
                onClick={() => setFormData({ ...formData, organizationType: type.value })}
                data-testid={`card-org-type-${type.value}`}
              >
                <CardContent className="pt-6 text-center">
                  <type.icon className="w-10 h-10 mx-auto mb-3 text-primary" />
                  <p className="font-medium">{type.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Organization Details</CardTitle>
              <CardDescription>
                Tell us about your organization and we'll create a custom setup for you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="organizationName">Organization Name *</Label>
                    <Input
                      id="organizationName"
                      placeholder="e.g., Lincoln High School"
                      value={formData.organizationName}
                      onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                      required
                      data-testid="input-org-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="organizationType">Organization Type *</Label>
                    <Select 
                      value={formData.organizationType}
                      onValueChange={(value) => setFormData({ ...formData, organizationType: value })}
                    >
                      <SelectTrigger data-testid="select-org-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizationTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Your Name *</Label>
                    <Input
                      id="contactName"
                      placeholder="Your full name"
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      required
                      data-testid="input-contact-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">Email Address *</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      placeholder="you@organization.com"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      required
                      data-testid="input-contact-email"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Phone Number</Label>
                    <Input
                      id="contactPhone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      data-testid="input-contact-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estimatedFleetSize">Estimated Fleet Size</Label>
                    <Select 
                      value={formData.estimatedFleetSize}
                      onValueChange={(value) => setFormData({ ...formData, estimatedFleetSize: value })}
                    >
                      <SelectTrigger data-testid="select-fleet-size">
                        <SelectValue placeholder="Number of vehicles" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-5">1-5 vehicles</SelectItem>
                        <SelectItem value="6-15">6-15 vehicles</SelectItem>
                        <SelectItem value="16-30">16-30 vehicles</SelectItem>
                        <SelectItem value="31-50">31-50 vehicles</SelectItem>
                        <SelectItem value="50+">50+ vehicles</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Additional Information</Label>
                  <Textarea
                    id="message"
                    placeholder="Tell us about your transportation needs, current challenges, or any questions you have..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={4}
                    data-testid="input-message"
                  />
                </div>

                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">What happens next?</h4>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Our team reviews your request (1-2 business days)</li>
                    <li>We'll reach out to discuss your needs and pricing</li>
                    <li>We set up your organization and create your admin account</li>
                    <li>You add your routes, drivers, and start inviting riders</li>
                  </ol>
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={inquiryMutation.isPending}
                  data-testid="button-submit-inquiry"
                >
                  {inquiryMutation.isPending ? "Submitting..." : "Submit Request"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="text-center mt-8">
            <p className="text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Log in here
              </Link>
            </p>
          </div>
        </div>

        <div className="text-center mt-16 text-sm text-muted-foreground">
          <p>Operated by Ride Tech LLC</p>
        </div>
      </div>
    </div>
  );
}
