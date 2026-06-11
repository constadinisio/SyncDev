import type { Meta, StoryObj } from "@storybook/react";
import { StatusBar } from "./StatusBar";

const meta: Meta<typeof StatusBar> = {
  title: "Editor/StatusBar",
  component: StatusBar,
};

export default meta;
type Story = StoryObj<typeof StatusBar>;

export const Connected: Story = {
  args: {
    language: "typescript",
    cursorPosition: { line: 42, column: 12 },
    connectionStatus: "connected",
  },
};

export const Connecting: Story = {
  args: {
    language: "javascript",
    cursorPosition: { line: 1, column: 1 },
    connectionStatus: "connecting",
  },
};

export const Disconnected: Story = {
  args: {
    language: "python",
    cursorPosition: null,
    connectionStatus: "disconnected",
  },
};
