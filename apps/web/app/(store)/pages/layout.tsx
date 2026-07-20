import React from "react";

// Legal/content pages are fetched on the server and change rarely;
// re-render them at most once an hour.
export const revalidate = 3600;

function ContentLayout({children}: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
      {children}
    </div>
  );
}

export default ContentLayout;