import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldClasses } from "./input";

export function Textarea({ className, rows = 4, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      rows={rows}
      className={cn(fieldClasses, "min-h-20 resize-y px-3 py-2.5", className)}
      {...props}
    />
  );
}

export default Textarea;
