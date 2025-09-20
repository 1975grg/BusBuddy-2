import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MapPin, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";

interface AddressSuggestion {
  id: string;
  place_name: string;
  text: string;
  center: [number, number]; // [longitude, latitude]
  properties?: any;
}

interface AddressData {
  address: string;
  placeId: string;
  latitude: number;
  longitude: number;
}

interface AddressAutocompleteProps {
  value?: string;
  onChange?: (address: AddressData | null) => void;
  onNameGenerated?: (name: string) => void;
  placeholder?: string;
  disabled?: boolean;
  "data-testid"?: string;
}

// Generate stop name from address (e.g., "123 Canyon Road" → "123 Canyon")
function generateStopName(address: string): string {
  // Try to extract house number and first street word
  const match = address.match(/^\s*(\d+)\s+([A-Za-z'-]+)/);
  if (match) {
    const [, number, streetWord] = match;
    return `${number} ${streetWord}`;
  }
  
  // Fallback: try to get first few words
  const words = address.split(/\s+/).slice(0, 2);
  return words.join(" ");
}

export function AddressAutocomplete({
  value = "",
  onChange,
  onNameGenerated,
  placeholder = "Search for an address...",
  disabled = false,
  "data-testid": testId,
}: AddressAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  
  const debouncedQuery = useDebounce(inputValue, 300);
  const inputRef = useRef<HTMLInputElement>(null);

  // Search for addresses when query changes
  useEffect(() => {
    if (debouncedQuery.length < 3) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    const searchAddresses = async () => {
      try {
        const response = await fetch(
          `/api/geocode/search?q=${encodeURIComponent(debouncedQuery)}&limit=5`
        );
        
        if (!response.ok) {
          throw new Error("Search failed");
        }
        
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      } catch (error) {
        console.error("Address search error:", error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    searchAddresses();
  }, [debouncedQuery]);

  const handleSelectAddress = (suggestion: AddressSuggestion) => {
    const addressData: AddressData = {
      address: suggestion.place_name,
      placeId: suggestion.id,
      latitude: suggestion.center[1], // Mapbox uses [lng, lat]
      longitude: suggestion.center[0],
    };

    setInputValue(suggestion.place_name);
    setIsOpen(false);
    onChange?.(addressData);

    // Generate and suggest stop name
    const generatedName = generateStopName(suggestion.place_name);
    onNameGenerated?.(generatedName);
  };

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    
    // Clear address data if input is empty or has been manually edited
    if (newValue === "") {
      onChange?.(null);
    } else if (newValue !== value && newValue.length >= 3) {
      // User is typing something different from the selected address
      onChange?.(null);
    }
    
    if (newValue.length >= 3 && !isOpen) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    if (inputValue.length >= 3 && suggestions.length > 0) {
      setIsOpen(true);
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={handleInputFocus}
          onBlur={() => {
            // Delay closing to allow selection clicks
            setTimeout(() => setIsOpen(false), 200);
          }}
          placeholder={placeholder}
          disabled={disabled}
          data-testid={testId}
          className="pr-8"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <MapPin className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Suggestions dropdown */}
      {isOpen && (suggestions.length > 0 || (debouncedQuery.length >= 3 && !isLoading)) && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-md">
          <Command>
            <CommandList>
              {suggestions.length > 0 && (
                <CommandGroup>
                  {suggestions.map((suggestion) => (
                    <CommandItem
                      key={suggestion.id}
                      onSelect={() => handleSelectAddress(suggestion)}
                      className="flex items-start gap-2 p-3 cursor-pointer"
                      data-testid={`address-suggestion-${suggestion.id}`}
                    >
                      <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {suggestion.text}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {suggestion.place_name}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {!isLoading && debouncedQuery.length >= 3 && suggestions.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  No addresses found
                </div>
              )}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}