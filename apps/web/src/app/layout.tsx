import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Collab Editor",
  description: "Collaborative code editor powered by Yjs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, height: "100vh" }}>
        {children}
      </body>
    </html>
  );
}
