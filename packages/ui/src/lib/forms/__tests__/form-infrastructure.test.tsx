import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";

import { FormField } from "../../../components/forms/FormField";
import { useZodForm } from "../../../hooks/use-zod-form";
import { getFieldErrorMessage } from "../errors";
import { applyServerFieldErrors, getFormErrorMessage } from "../server-errors";

const schema = z.object({
  email: z.string().email("Invalid email"),
  profile: z.object({
    name: z.string().min(1, "Name is required"),
  }),
});

function ProbeForm({
  onSubmit,
}: {
  onSubmit: (data: z.infer<typeof schema>) => Promise<void> | void;
}) {
  const form = useZodForm(schema, {
    defaultValues: { email: "", profile: { name: "" } },
  });

  return (
    <form
      onSubmit={form.handleSubmit(async (data) => {
        try {
          await onSubmit(data);
        } catch (error) {
          if (!applyServerFieldErrors(form, error)) {
            form.setError("root", { type: "server", message: getFormErrorMessage(error) });
          }
        }
      })}
    >
      <FormField
        name="email"
        label="Email"
        required
        error={form.formState.errors.email?.message}
        helpText="Work email"
      >
        {(a11y) => <input {...a11y} {...form.register("email")} />}
      </FormField>
      <FormField
        name="profile.name"
        label="Name"
        error={getFieldErrorMessage(form.formState.errors, "profile.name")}
      >
        {(a11y) => <input {...a11y} {...form.register("profile.name")} />}
      </FormField>
      {form.formState.errors.root?.message ? (
        <p role="alert">{form.formState.errors.root.message}</p>
      ) : null}
      <button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Saving" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => {
          form.reset();
        }}
      >
        Reset
      </button>
    </form>
  );
}

describe("form infrastructure", () => {
  it("associates labels, help, and errors accessibly", () => {
    render(
      <FormField name="email" label="Email" required error="Invalid email" helpText="Work email">
        {(a11y) => <input {...a11y} />}
      </FormField>
    );

    const input = screen.getByRole("textbox");
    expect(screen.getByText("Email")).toHaveAttribute("for", "field-email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input.getAttribute("aria-describedby")).toBe("field-email-error");
    expect(screen.getByRole("alert")).toHaveTextContent("Invalid email");
  });

  it("validates on the client and supports reset", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    render(<ProbeForm onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Invalid email")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/Name/i), "Ada");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalledWith({
      email: "ada@example.com",
      profile: { name: "Ada" },
    });

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText(/Email/i)).toHaveValue("");
  });

  it("maps nested server field errors and keeps unknown errors global", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn(async () => {
      throw {
        shape: {
          code: "VALIDATION_FAILED",
          message: "invalid",
          details: { fieldErrors: { email: ["taken"], "profile.name": ["too short"] } },
        },
      };
    });
    render(<ProbeForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/Email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/Name/i), "Ada");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("taken")).toBeInTheDocument();
    expect(screen.getByText("too short")).toBeInTheDocument();
  });

  it("surfaces an unknown server error as a safe global message", async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn(async () => {
      throw {
        shape: {
          code: "INTERNAL",
          message: "stack dump",
          userMessage: "Please try again.",
        },
      };
    });
    render(<ProbeForm onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/Email/i), "ada@example.com");
    await user.type(screen.getByLabelText(/Name/i), "Ada");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again.");
    expect(screen.queryByText("stack dump")).not.toBeInTheDocument();
  });

  it("applies legacy fields maps and ignores non-validation errors", () => {
    const form = { setError: jest.fn() };
    expect(
      applyServerFieldErrors(form as never, {
        shape: { code: "VALIDATION_ERROR", details: { fields: { email: ["legacy"] } } },
      })
    ).toBe(true);
    expect(form.setError).toHaveBeenCalledWith("email", { type: "server", message: "legacy" });
    expect(applyServerFieldErrors(form as never, new Error("nope"))).toBe(false);
  });
});
