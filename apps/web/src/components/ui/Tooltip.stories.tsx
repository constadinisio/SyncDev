import type { Meta, StoryObj } from "@storybook/react";
import { Tooltip } from "./Tooltip";

const meta: Meta<typeof Tooltip> = {
  title: "UI/Tooltip",
  component: Tooltip,
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Top: Story = {
  args: {
    content: "This is a tooltip",
    side: "top",
    children: (
      <button className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm">
        Hover me (top)
      </button>
    ),
  },
  decorators: [
    (Story) => (
      <div className="p-16 flex justify-center">
        <Story />
      </div>
    ),
  ],
};

export const Bottom: Story = {
  args: {
    content: "Bottom tooltip",
    side: "bottom",
    children: (
      <button className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm">
        Hover me (bottom)
      </button>
    ),
  },
  decorators: [
    (Story) => (
      <div className="p-16 flex justify-center">
        <Story />
      </div>
    ),
  ],
};
