import { Search, Plus, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface HeaderProps {
  title: string;
  description: string;
  onAddClick?: () => void;
  addButtonText?: string;
  showAddButton?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
}

export default function Header({ 
  title, 
  description, 
  onAddClick, 
  addButtonText = "Add Item",
  showAddButton = true,
  searchPlaceholder = "Search...",
  onSearch
}: HeaderProps) {
  return (
    <header className="bg-card border-b border-border p-6" data-testid="page-header">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="page-title">
            {title}
          </h1>
          <p className="text-muted-foreground" data-testid="page-description">
            {description}
          </p>
        </div>
        
        {/* Search and Actions */}
        <div className="flex items-center space-x-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-3 text-muted-foreground h-4 w-4" />
            <Input
              type="text"
              placeholder={searchPlaceholder}
              className="w-80 pl-10 pr-4"
              onChange={(e) => onSearch?.(e.target.value)}
              data-testid="search-input"
            />
          </div>
          
          {showAddButton && (
            <Button 
              onClick={onAddClick}
              data-testid="add-button"
            >
              <Plus className="mr-2 h-4 w-4" />
              {addButtonText}
            </Button>
          )}
          
          <button 
            className="text-muted-foreground hover:text-foreground relative"
            data-testid="notifications-button"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full"></span>
          </button>
        </div>
      </div>
    </header>
  );
}
