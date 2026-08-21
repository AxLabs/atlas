/**
 * Optional/heavy primitives with large runtime dependencies (recharts, cmdk,
 * react-day-picker, embla-carousel, input-otp, react-resizable-panels).
 *
 * Import from `@atlas/ui/extended` when a feature needs these components.
 * They are intentionally excluded from the default `@atlas/ui` barrel so app
 * bundles do not pay for unused Storybook/catalog primitives.
 */
export { Calendar } from "./components/ui/calendar";
export {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  useCarousel,
} from "./components/ui/carousel";
export type { ChartConfig } from "./components/ui/chart";
export {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
} from "./components/ui/chart";
export {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
  ComboboxValue,
  useComboboxAnchor,
} from "./components/ui/combobox";
export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./components/ui/command";
export {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "./components/ui/input-otp";
export { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "./components/ui/resizable";
