import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import busIconUrl from "@assets/bus-buddy-logo.png";

export function PublicHeader() {
  return (
    <header className="container mx-auto px-4 py-4">
      <nav className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" data-testid="link-home">
          <img 
            src={busIconUrl} 
            alt="Bus Buddy" 
            className="w-8 h-8 rounded-lg"
          />
          <span className="font-bold text-lg">Bus Buddy</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild data-testid="nav-about">
            <Link href="/about">About</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild data-testid="nav-contact">
            <Link href="/contact">Contact</Link>
          </Button>
          <Button size="sm" asChild data-testid="nav-get-started">
            <Link href="/get-started">Get Started</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
