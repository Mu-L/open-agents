"use client";

import * as React from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type ComboboxContextValue<T> = {
  disabled: boolean;
  items: T[];
  filteredItems: T[];
  itemToStringValue: (item: T) => string;
  open: boolean;
  search: string;
  selectedItem: T | null;
  triggerPlaceholder: string;
  setOpen: (open: boolean) => void;
  setSearch: (value: string) => void;
  setSelectedItem: (item: T) => void;
  setTriggerPlaceholder: (value: string) => void;
};

const ComboboxContext =
  React.createContext<ComboboxContextValue<unknown> | null>(null);

function useComboboxContext<T>() {
  const context = React.useContext(ComboboxContext);
  if (!context) {
    throw new Error("Combobox components must be used within <Combobox>");
  }
  return context as ComboboxContextValue<T>;
}

interface ComboboxProps<T> {
  items: T[];
  itemToStringValue: (item: T) => string;
  value?: T | null;
  disabled?: boolean;
  onValueChange?: (item: T) => void;
  children: React.ReactNode;
}

function Combobox<T>({
  items,
  itemToStringValue,
  value,
  disabled = false,
  onValueChange,
  children,
}: ComboboxProps<T>) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [internalSelectedItem, setInternalSelectedItem] =
    React.useState<T | null>(null);
  const [triggerPlaceholder, setTriggerPlaceholder] =
    React.useState("Select...");

  const selectedItem = value === undefined ? internalSelectedItem : value;

  const filteredItems = React.useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return items;
    }

    return items.filter((item) =>
      itemToStringValue(item).toLowerCase().includes(normalizedSearch),
    );
  }, [items, itemToStringValue, search]);

  const setSelectedItem = React.useCallback(
    (item: T) => {
      if (value === undefined) {
        setInternalSelectedItem(item);
      }
      onValueChange?.(item);
      setOpen(false);
      setSearch("");
    },
    [onValueChange, value],
  );

  const contextValue = React.useMemo<ComboboxContextValue<T>>(
    () => ({
      disabled,
      items,
      filteredItems,
      itemToStringValue,
      open,
      search,
      selectedItem,
      triggerPlaceholder,
      setOpen,
      setSearch,
      setSelectedItem,
      setTriggerPlaceholder,
    }),
    [
      disabled,
      items,
      filteredItems,
      itemToStringValue,
      open,
      search,
      selectedItem,
      triggerPlaceholder,
      setSelectedItem,
    ],
  );

  return (
    <ComboboxContext.Provider
      value={contextValue as ComboboxContextValue<unknown>}
    >
      <Popover open={open} onOpenChange={setOpen}>
        {children}
      </Popover>
    </ComboboxContext.Provider>
  );
}

interface ComboboxInputProps extends React.ComponentProps<"button"> {
  placeholder?: string;
}

function ComboboxInput({
  className,
  placeholder = "Select...",
  ...props
}: ComboboxInputProps) {
  const { disabled, selectedItem, itemToStringValue, setTriggerPlaceholder } =
    useComboboxContext<unknown>();

  React.useEffect(() => {
    setTriggerPlaceholder(placeholder);
  }, [placeholder, setTriggerPlaceholder]);

  const displayValue = selectedItem
    ? itemToStringValue(selectedItem)
    : placeholder;

  return (
    <PopoverTrigger asChild>
      <button
        type="button"
        data-placeholder={!selectedItem ? "" : undefined}
        disabled={disabled || props.disabled}
        className={cn(
          "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 flex h-9 w-full max-w-xs items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        <span className="truncate text-left">{displayValue}</span>
        <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
      </button>
    </PopoverTrigger>
  );
}

function ComboboxContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  const { search, setSearch, triggerPlaceholder } =
    useComboboxContext<unknown>();

  return (
    <PopoverContent
      className={cn("w-[--radix-popover-trigger-width] p-0", className)}
      align="start"
      {...props}
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder={triggerPlaceholder}
          value={search}
          onValueChange={setSearch}
        />
        {children}
      </Command>
    </PopoverContent>
  );
}

function ComboboxEmpty({
  ...props
}: React.ComponentProps<typeof CommandEmpty>) {
  return <CommandEmpty {...props} />;
}

interface ComboboxListProps<T>
  extends Omit<React.ComponentProps<typeof CommandList>, "children"> {
  children: (item: T) => React.ReactNode;
}

function ComboboxList<T>({ children, ...props }: ComboboxListProps<T>) {
  const { filteredItems } = useComboboxContext<T>();

  return (
    <CommandList {...props}>
      {filteredItems.map((item) => children(item))}
    </CommandList>
  );
}

interface ComboboxItemProps<T>
  extends Omit<React.ComponentProps<typeof CommandItem>, "value" | "onSelect"> {
  value: T;
}

function ComboboxItem<T>({
  value,
  className,
  children,
  ...props
}: ComboboxItemProps<T>) {
  const { itemToStringValue, selectedItem, setSelectedItem } =
    useComboboxContext<T>();

  const itemValue = itemToStringValue(value);
  const isSelected =
    selectedItem !== null && itemToStringValue(selectedItem) === itemValue;

  return (
    <CommandItem
      value={itemValue}
      className={cn("items-start", className)}
      onSelect={() => setSelectedItem(value)}
      {...props}
    >
      <CheckIcon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          isSelected ? "opacity-100" : "opacity-0",
        )}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </CommandItem>
  );
}

export {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
};
