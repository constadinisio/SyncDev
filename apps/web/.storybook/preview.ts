import type { Preview } from "@storybook/react";
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "dark",
      values: [
        { name: "dark", value: "#111113" },
        { name: "light", value: "#fafafa" },
      ],
    },
  },
};

export default preview;
