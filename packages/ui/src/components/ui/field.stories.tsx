import { Checkbox } from "./checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "./field";
import { Input } from "./input";

import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta<typeof Field> = {
  title: "UI/Field",
  component: Field,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Field>;

export const Default: Story = {
  render: () => (
    <div style={{ width: "400px" }}>
      <Field>
        <FieldContent>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" placeholder="Enter your email" />
          <FieldDescription>We&apos;ll never share your email.</FieldDescription>
        </FieldContent>
      </Field>
    </div>
  ),
};

export const WithError: Story = {
  render: () => (
    <div style={{ width: "400px" }}>
      <Field data-invalid>
        <FieldContent>
          <FieldLabel htmlFor="email-error">Email</FieldLabel>
          <Input id="email-error" type="email" placeholder="Enter your email" aria-invalid />
          <FieldError>Please enter a valid email address.</FieldError>
        </FieldContent>
      </Field>
    </div>
  ),
};

export const Horizontal: Story = {
  render: () => (
    <div style={{ width: "500px" }}>
      <Field orientation="horizontal">
        <FieldContent className="w-32">
          <FieldTitle>Username</FieldTitle>
          <FieldDescription>Choose a unique username.</FieldDescription>
        </FieldContent>
        <FieldContent>
          <Input placeholder="username" />
        </FieldContent>
      </Field>
    </div>
  ),
};

export const FieldSetExample: Story = {
  render: () => (
    <div style={{ width: "400px" }}>
      <FieldSet>
        <FieldLegend>Personal Information</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldContent>
              <FieldLabel htmlFor="first-name">First Name</FieldLabel>
              <Input id="first-name" placeholder="John" />
            </FieldContent>
          </Field>
          <Field>
            <FieldContent>
              <FieldLabel htmlFor="last-name">Last Name</FieldLabel>
              <Input id="last-name" placeholder="Doe" />
            </FieldContent>
          </Field>
          <Field>
            <FieldContent>
              <FieldLabel htmlFor="field-email">Email</FieldLabel>
              <Input id="field-email" type="email" placeholder="john@example.com" />
            </FieldContent>
          </Field>
        </FieldGroup>
      </FieldSet>
    </div>
  ),
};

export const WithSeparator: Story = {
  render: () => (
    <div style={{ width: "400px" }}>
      <FieldSet>
        <FieldLegend>Account Settings</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldContent>
              <FieldLabel htmlFor="sep-username">Username</FieldLabel>
              <Input id="sep-username" placeholder="username" />
            </FieldContent>
          </Field>
          <FieldSeparator>or</FieldSeparator>
          <Field>
            <FieldContent>
              <FieldLabel htmlFor="sep-email">Email</FieldLabel>
              <Input id="sep-email" type="email" placeholder="email@example.com" />
            </FieldContent>
          </Field>
        </FieldGroup>
      </FieldSet>
    </div>
  ),
};

export const WithCheckbox: Story = {
  render: () => (
    <div style={{ width: "400px" }}>
      <Field>
        <div className="flex items-center gap-2">
          <Checkbox id="terms" />
          <FieldLabel htmlFor="terms">Accept terms and conditions</FieldLabel>
        </div>
        <FieldDescription className="ml-6">
          You agree to our Terms of Service and Privacy Policy.
        </FieldDescription>
      </Field>
    </div>
  ),
};
