import type { Meta, StoryObj } from "@storybook/react";
import { ToastProvider, useToast } from "./Toast";

function ToastDemo() {
  const { toast } = useToast();
  return (
    <div className="flex gap-2 p-8">
      <button
        onClick={() => toast("Operation completed successfully!", "success")}
        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm"
      >
        Success
      </button>
      <button
        onClick={() => toast("Something went wrong.", "error")}
        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
      >
        Error
      </button>
      <button
        onClick={() => toast("Here is some information.", "info")}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
      >
        Info
      </button>
      <button
        onClick={() => toast("Be careful with this action!", "warning")}
        className="px-4 py-2 bg-yellow-600 text-white rounded-lg text-sm"
      >
        Warning
      </button>
    </div>
  );
}

const meta: Meta = {
  title: "UI/Toast",
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
};

export default meta;

export const AllTypes: StoryObj = {
  render: () => <ToastDemo />,
};
