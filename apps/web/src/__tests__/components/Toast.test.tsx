import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastProvider, useToast } from "@/components/ui/Toast";

function TestComponent() {
  const { toast } = useToast();
  return (
    <div>
      <button onClick={() => toast("Test message", "success")}>Show Toast</button>
      <button onClick={() => toast("Error!", "error")}>Show Error</button>
    </div>
  );
}

describe("Toast", () => {
  it("should render toast when triggered", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    await user.click(screen.getByText("Show Toast"));
    expect(screen.getByText("Test message")).toBeInTheDocument();
  });

  it("should auto-dismiss after duration", async () => {
    vi.useFakeTimers();

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );

    await act(async () => {
      screen.getByText("Show Toast").click();
    });

    expect(screen.getByText("Test message")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.queryByText("Test message")).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
