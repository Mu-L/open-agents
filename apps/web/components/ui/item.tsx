import * as React from "react";

import { cn } from "@/lib/utils";

function Item({
  className,
  size = "sm",
  ...props
}: React.ComponentProps<"div"> & {
  size?: "xs" | "sm";
}) {
  return (
    <div
      data-slot="item"
      data-size={size}
      className={cn(
        "flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left",
        size === "xs" && "py-0.5",
        className,
      )}
      {...props}
    />
  );
}

function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-content"
      className={cn("flex min-w-0 flex-col", className)}
      {...props}
    />
  );
}

function ItemTitle({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="item-title"
      className={cn("truncate text-sm font-medium", className)}
      {...props}
    />
  );
}

function ItemDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="item-description"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Item, ItemContent, ItemDescription, ItemTitle };
