"use client";

import dynamic from "next/dynamic";

const ProjectPageClient = dynamic(() => import("./ProjectPageClient"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1e1e1e",
        color: "#808080",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      Loading editor...
    </div>
  ),
});

export default function ProjectPage({ params }: { params: { projectId: string } }) {
  return <ProjectPageClient params={params} />;
}
