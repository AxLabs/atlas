import { Input as InputPrimitive } from "@base-ui/react/input";
import * as React from "react";

import { controlClasses } from "../../lib/control-styles";
import { cn } from "../../lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        controlClasses(
          "file:text-foreground py-1 text-base file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium"
        ),
        className
      )}
      {...props}
    />
  );
}

export { Input };
