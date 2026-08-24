import * as React from "react";

import { controlClasses } from "../../lib/control-styles";
import { cn } from "../../lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(controlClasses("field-sizing-content h-auto min-h-16 w-full py-2"), className)}
      {...props}
    />
  );
}

export { Textarea };
