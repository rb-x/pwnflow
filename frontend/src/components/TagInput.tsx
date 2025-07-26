import { useState, useEffect, useRef } from "react";
import { X, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  className?: string;
}

export function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Add a tag...",
  className,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredSuggestions = suggestions.filter(
    (suggestion) =>
      suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
      !value.some((tag) => tag.toLowerCase() === suggestion.toLowerCase())
  );

  const handleAddTag = (tag: string) => {
    const trimmedTag = tag.trim();
    // Case-insensitive duplicate check
    const isDuplicate = value.some(
      (existingTag) => existingTag.toLowerCase() === trimmedTag.toLowerCase()
    );

    if (trimmedTag && !isDuplicate) {
      onChange([...value, trimmedTag]);
      setInputValue("");
      setOpen(false);
      inputRef.current?.focus();
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChange(value.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (filteredSuggestions.length > 0 && inputValue) {
        // Select first suggestion on Enter if available
        handleAddTag(filteredSuggestions[0]);
      } else if (inputValue) {
        // Add new tag if no suggestions
        handleAddTag(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
      // Remove last tag on backspace if input is empty
      handleRemoveTag(value[value.length - 1]);
    }
  };

  useEffect(() => {
    setOpen(inputValue.length > 0 && filteredSuggestions.length > 0);
  }, [inputValue, filteredSuggestions.length]);

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                value.length === 0 ? placeholder : "Add another tag..."
              }
              className="pr-20"
            />
            {inputValue && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2"
                onClick={() => handleAddTag(inputValue)}
              >
                Add
              </Button>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandList>
              <CommandEmpty>Press Enter to create "{inputValue}"</CommandEmpty>
              <CommandGroup heading="Suggestions">
                {filteredSuggestions.map((suggestion) => (
                  <CommandItem
                    key={suggestion}
                    value={suggestion}
                    onSelect={() => handleAddTag(suggestion)}
                  >
                    <Check
                      className={cn(
                        " h-4 w-4",
                        value.includes(suggestion) ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {suggestion}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="flex items-center gap-1 pr-1"
            >
              <span>{tag}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRemoveTag(tag);
                }}
                className="ml-1 rounded-sm hover:bg-destructive/20 focus:outline-none focus:ring-1 focus:ring-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
