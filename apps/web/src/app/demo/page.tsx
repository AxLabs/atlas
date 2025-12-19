"use client";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Checkbox,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
  Input,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Slider,
  Spinner,
  Switch,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@atlas/ui";
import {
  Archive,
  ArrowLeft,
  ArrowUp,
  AtSign,
  BadgeCheck,
  CalendarPlus,
  ChevronRight,
  Clock,
  Github,
  Info,
  ListFilter,
  MailCheck,
  Minus,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

// ============================================================================
// Payment Method Form (Column 1)
// ============================================================================
function PaymentMethodForm() {
  return (
    <div className="w-full rounded-lg border p-6">
      <form>
        <FieldGroup>
          <FieldSet>
            <FieldLegend>Payment Method</FieldLegend>
            <FieldDescription>All transactions are secure and encrypted</FieldDescription>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="card-name">Name on Card</FieldLabel>
                <Input id="card-name" placeholder="John Doe" required />
              </Field>
              <div className="grid grid-cols-3 gap-4">
                <Field className="col-span-2">
                  <FieldLabel htmlFor="card-number">Card Number</FieldLabel>
                  <Input id="card-number" placeholder="1234 5678 9012 3456" required />
                  <FieldDescription>Enter your 16-digit number.</FieldDescription>
                </Field>
                <Field className="col-span-1">
                  <FieldLabel htmlFor="cvv">CVV</FieldLabel>
                  <Input id="cvv" placeholder="123" required />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="exp-month">Month</FieldLabel>
                  <Select defaultValue="">
                    <SelectTrigger id="exp-month">
                      <SelectValue placeholder="MM" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1).padStart(2, "0")}>
                          {String(i + 1).padStart(2, "0")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="exp-year">Year</FieldLabel>
                  <Select defaultValue="">
                    <SelectTrigger id="exp-year">
                      <SelectValue placeholder="YYYY" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 6 }, (_, i) => (
                        <SelectItem key={i} value={String(2024 + i)}>
                          {2024 + i}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>
          <FieldSeparator />
          <FieldSet>
            <FieldLegend>Billing Address</FieldLegend>
            <FieldDescription>
              The billing address associated with your payment method
            </FieldDescription>
            <FieldGroup>
              <Field orientation="horizontal">
                <Checkbox id="same-shipping" defaultChecked />
                <FieldLabel htmlFor="same-shipping" className="font-normal">
                  Same as shipping address
                </FieldLabel>
              </Field>
            </FieldGroup>
          </FieldSet>
          <FieldSeparator />
          <FieldSet>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="comments">Comments</FieldLabel>
                <Textarea id="comments" placeholder="Add any additional comments" />
              </Field>
            </FieldGroup>
          </FieldSet>
          <Field orientation="horizontal">
            <Button type="submit">Submit</Button>
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}

// ============================================================================
// Empty Avatar Group (Column 2)
// ============================================================================
function EmptyAvatarGroup() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border p-6 text-center">
      <div className="flex -space-x-2">
        <Avatar className="ring-background size-12 ring-2 grayscale">
          <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
        <Avatar className="ring-background size-12 ring-2 grayscale">
          <AvatarImage src="https://github.com/maxleiter.png" alt="@maxleiter" />
          <AvatarFallback>LR</AvatarFallback>
        </Avatar>
        <Avatar className="ring-background size-12 ring-2 grayscale">
          <AvatarImage src="https://github.com/evilrabbit.png" alt="@evilrabbit" />
          <AvatarFallback>ER</AvatarFallback>
        </Avatar>
      </div>
      <div className="space-y-1">
        <h4 className="font-medium">No Team Members</h4>
        <p className="text-muted-foreground text-sm">
          Invite your team to collaborate on this project.
        </p>
      </div>
      <Button size="sm">
        <Plus className="mr-1 h-4 w-4" />
        Invite Members
      </Button>
    </div>
  );
}

// ============================================================================
// Spinner Badge (Column 2)
// ============================================================================
function SpinnerBadge() {
  return (
    <div className="flex items-center gap-2">
      <Badge>
        <Spinner className="mr-1" />
        Syncing
      </Badge>
      <Badge variant="secondary">
        <Spinner className="mr-1" />
        Updating
      </Badge>
      <Badge variant="outline">
        <Spinner className="mr-1" />
        Loading
      </Badge>
    </div>
  );
}

// ============================================================================
// Price Range Slider (Column 2)
// ============================================================================
function PriceRangeSlider() {
  const [value, setValue] = useState([200, 800]);
  return (
    <div className="w-full">
      <Field>
        <FieldTitle>Price Range</FieldTitle>
        <FieldDescription>
          Set your budget range ($<span className="font-medium tabular-nums">{value[0]}</span> -{" "}
          <span className="font-medium tabular-nums">{value[1]}</span>).
        </FieldDescription>
        <Slider
          value={value}
          onValueChange={setValue}
          max={1000}
          min={0}
          step={10}
          className="mt-2 w-full"
          aria-label="Price Range"
        />
      </Field>
    </div>
  );
}

// ============================================================================
// Input Group Demo (Column 2)
// ============================================================================
function InputGroupDemo() {
  return (
    <div className="grid w-full gap-4">
      <div className="relative">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input placeholder="Search..." className="pr-20 pl-9" />
        <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-sm">
          12 results
        </span>
      </div>
      <div className="relative">
        <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 text-sm">
          https://
        </span>
        <Input placeholder="example.com" className="pr-10 pl-16" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2 rounded-full"
            >
              <Info className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>This is content in a tooltip.</TooltipContent>
        </Tooltip>
      </div>
      <div className="relative">
        <Input defaultValue="@shadcn" className="pr-8" />
        <div className="bg-primary absolute top-1/2 right-3 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full">
          <svg
            className="text-primary-foreground h-3 w-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Item Demo (Column 3)
// ============================================================================
function ItemDemo() {
  return (
    <div className="flex w-full flex-col gap-4">
      <Item variant="outline">
        <ItemContent>
          <ItemTitle>Two-factor authentication</ItemTitle>
          <ItemDescription>Verify via email or phone number.</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button size="sm">Enable</Button>
        </ItemActions>
      </Item>
      <Item variant="outline" size="sm">
        <ItemMedia>
          <BadgeCheck className="h-5 w-5" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Your profile has been verified.</ItemTitle>
        </ItemContent>
        <ItemActions>
          <ChevronRight className="h-4 w-4" />
        </ItemActions>
      </Item>
    </div>
  );
}

// ============================================================================
// Appearance Settings (Column 3)
// ============================================================================
function AppearanceSettings() {
  const [gpuCount, setGpuCount] = useState(8);

  return (
    <FieldSet>
      <FieldGroup>
        <FieldSet>
          <FieldLegend>Compute Environment</FieldLegend>
          <FieldDescription>Select the compute environment for your cluster.</FieldDescription>
          <RadioGroup defaultValue="kubernetes">
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="kubernetes" id="kubernetes" />
              <FieldLabel htmlFor="kubernetes" className="space-y-1">
                <FieldTitle>Kubernetes</FieldTitle>
                <FieldDescription>
                  Run GPU workloads on a K8s configured cluster. This is the default.
                </FieldDescription>
              </FieldLabel>
            </div>
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="vm" id="vm" />
              <FieldLabel htmlFor="vm" className="space-y-1">
                <FieldTitle>Virtual Machine</FieldTitle>
                <FieldDescription>
                  Access a VM configured cluster to run workloads. (Coming soon)
                </FieldDescription>
              </FieldLabel>
            </div>
          </RadioGroup>
        </FieldSet>
        <FieldSeparator />
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="gpu-count">Number of GPUs</FieldLabel>
            <FieldDescription>You can add more later.</FieldDescription>
          </FieldContent>
          <ButtonGroup>
            <Input
              id="gpu-count"
              value={gpuCount}
              onChange={(e) => setGpuCount(parseInt(e.target.value) || 0)}
              className="h-8 w-14 font-mono"
              maxLength={3}
            />
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setGpuCount((c) => Math.max(1, c - 1))}
              disabled={gpuCount <= 1}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setGpuCount((c) => Math.min(99, c + 1))}
              disabled={gpuCount >= 99}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </ButtonGroup>
        </Field>
        <FieldSeparator />
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="tinting">Wallpaper Tinting</FieldLabel>
            <FieldDescription>Allow the wallpaper to be tinted.</FieldDescription>
          </FieldContent>
          <Switch id="tinting" defaultChecked />
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}

// ============================================================================
// Prompt Form (Column 4)
// ============================================================================
function PromptForm() {
  const [mentions, setMentions] = useState<string[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);

  const pages = [
    { title: "Meeting Notes", emoji: "📝" },
    { title: "Project Dashboard", emoji: "📊" },
    { title: "Ideas & Brainstorming", emoji: "💡" },
    { title: "Calendar & Events", emoji: "📅" },
  ];

  const availablePages = pages.filter((p) => !mentions.includes(p.title));

  return (
    <form className="rounded-2xl border p-4">
      <Field>
        <FieldLabel htmlFor="prompt" className="sr-only">
          Prompt
        </FieldLabel>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Popover open={mentionOpen} onOpenChange={setMentionOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-full">
                      <AtSign className="mr-1 h-4 w-4" />
                      {mentions.length === 0 && "Add context"}
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Mention a person, page, or date</TooltipContent>
              </Tooltip>
              <PopoverContent className="p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search pages..." />
                  <CommandList>
                    <CommandEmpty>No pages found</CommandEmpty>
                    <CommandGroup heading="Pages">
                      {availablePages.map((page) => (
                        <CommandItem
                          key={page.title}
                          value={page.title}
                          onSelect={(value) => {
                            setMentions((prev) => [...prev, value]);
                            setMentionOpen(false);
                          }}
                        >
                          <span className="mr-2">{page.emoji}</span>
                          {page.title}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {mentions.map((mention) => {
              const page = pages.find((p) => p.title === mention);
              return (
                <Button
                  key={mention}
                  size="sm"
                  variant="secondary"
                  className="rounded-full pl-2"
                  onClick={() => setMentions((prev) => prev.filter((m) => m !== mention))}
                >
                  <span className="mr-1">{page?.emoji}</span>
                  {mention}
                  <X className="ml-1 h-3 w-3" />
                </Button>
              );
            })}
          </div>
          <Textarea
            id="prompt"
            placeholder="Ask, search, or make anything..."
            className="min-h-20 resize-none"
          />
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full">
                  <Paperclip className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Attach file</TooltipContent>
            </Tooltip>
            <Button variant="ghost" size="sm" className="rounded-full">
              Auto
            </Button>
            <span className="text-muted-foreground ml-auto text-sm">52% used</span>
            <Separator orientation="vertical" className="h-4" />
            <Button size="icon" className="h-8 w-8 rounded-full">
              <ArrowUp className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </div>
      </Field>
    </form>
  );
}

// ============================================================================
// Button Group Demo (Column 4)
// ============================================================================
function ButtonGroupDemo() {
  const [label, setLabel] = useState("personal");

  return (
    <ButtonGroup>
      <ButtonGroup className="hidden sm:flex">
        <Button variant="outline" size="icon" className="h-8 w-8" aria-label="Go Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </ButtonGroup>
      <ButtonGroup>
        <Button variant="outline" size="sm">
          Archive
        </Button>
        <Button variant="outline" size="sm">
          Report
        </Button>
      </ButtonGroup>
      <ButtonGroup>
        <Button variant="outline" size="sm">
          Snooze
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8" aria-label="More Options">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <MailCheck className="mr-2 h-4 w-4" />
                Mark as Read
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <Clock className="mr-2 h-4 w-4" />
                Snooze
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CalendarPlus className="mr-2 h-4 w-4" />
                Add to Calendar
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ListFilter className="mr-2 h-4 w-4" />
                Add to List
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Tag className="mr-2 h-4 w-4" />
                  Label As...
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup value={label} onValueChange={setLabel}>
                    <DropdownMenuRadioItem value="personal">Personal</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="work">Work</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="other">Other</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Trash
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
    </ButtonGroup>
  );
}

// ============================================================================
// Field Checkbox (Column 4)
// ============================================================================
function FieldCheckbox() {
  return (
    <FieldLabel htmlFor="terms-checkbox">
      <Field orientation="horizontal">
        <Checkbox id="terms-checkbox" defaultChecked />
        <FieldLabel htmlFor="terms-checkbox" className="line-clamp-1">
          I agree to the terms and conditions
        </FieldLabel>
      </Field>
    </FieldLabel>
  );
}

// ============================================================================
// How Did You Hear (Column 4)
// ============================================================================
function HowDidYouHear() {
  const options = [
    { label: "Social Media", value: "social-media" },
    { label: "Search Engine", value: "search-engine" },
    { label: "Referral", value: "referral" },
    { label: "Other", value: "other" },
  ];

  return (
    <Card className="py-4 shadow-none">
      <CardContent className="px-4">
        <form>
          <FieldGroup>
            <FieldSet className="gap-4">
              <FieldLegend>How did you hear about us?</FieldLegend>
              <FieldDescription className="line-clamp-1">
                Select the option that best describes how you heard about us.
              </FieldDescription>
              <FieldGroup className="flex flex-row flex-wrap gap-2">
                {options.map((option) => (
                  <FieldLabel htmlFor={option.value} key={option.value} className="w-fit">
                    <Field
                      orientation="horizontal"
                      className="gap-1.5 overflow-hidden px-3 py-1.5 transition-all duration-100"
                    >
                      <Checkbox
                        value={option.value}
                        id={option.value}
                        defaultChecked={option.value === "social-media"}
                        className="rounded-full"
                      />
                      <FieldTitle>{option.label}</FieldTitle>
                    </Field>
                  </FieldLabel>
                ))}
              </FieldGroup>
            </FieldSet>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Processing Empty State (Column 4)
// ============================================================================
function ProcessingEmpty() {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-4 rounded-lg border p-6 text-center">
      <Spinner className="h-8 w-8" />
      <div className="space-y-1">
        <h4 className="font-medium">Processing your request</h4>
        <p className="text-muted-foreground text-sm">
          Please wait while we process your request. Do not refresh the page.
        </p>
      </div>
      <Button variant="outline" size="sm">
        Cancel
      </Button>
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================
export default function DemoPage() {
  return (
    <TooltipProvider>
      <div className="bg-background min-h-screen">
        {/* Hero Section */}
        <header className="container mx-auto px-4 py-12 text-center md:py-16">
          <div className="mx-auto max-w-4xl space-y-6">
            <Badge variant="secondary" className="mb-4 bg-transparent">
              Atlas UI Components
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              The Foundation for your Design System
            </h1>
            <p className="text-muted-foreground mx-auto max-w-2xl text-lg md:text-xl">
              A set of beautifully designed components that you can customize, extend, and build on.
              Start here then make it your own. Open Source. Open Code.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/">
                <Button size="sm" className="rounded-lg">
                  <Plus className="mr-1 h-4 w-4" />
                  New Project
                </Button>
              </Link>
              <Link href="/components">
                <Button variant="ghost" size="sm" className="rounded-lg">
                  View Components
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Examples Navigation */}
        <nav className="container mx-auto hidden px-4 pb-6 md:block">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex gap-6 text-sm">
              <span className="text-primary font-medium">Examples</span>
              <Link href="/demo" className="text-muted-foreground hover:text-foreground">
                Dashboard
              </Link>
              <Link href="/demo" className="text-muted-foreground hover:text-foreground">
                Tasks
              </Link>
              <Link href="/demo" className="text-muted-foreground hover:text-foreground">
                Playground
              </Link>
              <Link href="/demo" className="text-muted-foreground hover:text-foreground">
                Authentication
              </Link>
            </div>
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <span>Theme</span>
              <Badge variant="outline">Cyan</Badge>
            </div>
          </div>
        </nav>

        {/* Component Grid */}
        <section className="container mx-auto px-4 pb-12">
          <div className="mx-auto grid gap-6 py-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
            {/* Column 1: Payment Form */}
            <div className="flex flex-col gap-6">
              <PaymentMethodForm />
            </div>

            {/* Column 2: Various Components */}
            <div className="flex flex-col gap-6">
              <EmptyAvatarGroup />
              <SpinnerBadge />
              <PriceRangeSlider />
              <InputGroupDemo />
            </div>

            {/* Column 3: Item & Settings */}
            <div className="flex flex-col gap-6">
              <ItemDemo />
              <FieldSeparator className="my-4">Appearance Settings</FieldSeparator>
              <AppearanceSettings />
            </div>

            {/* Column 4: Prompt & More */}
            <div className="order-first flex flex-col gap-6 lg:hidden xl:order-last xl:flex">
              <PromptForm />
              <ButtonGroupDemo />
              <FieldCheckbox />
              <HowDidYouHear />
              <ProcessingEmpty />
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t">
          <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 py-8 md:flex-row">
            <p className="text-muted-foreground text-sm">
              Built with Atlas UI. The source code is available on GitHub.
            </p>
            <div className="flex gap-4">
              <Button variant="ghost" size="icon">
                <Github className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
