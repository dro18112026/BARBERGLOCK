import type { Metadata } from "next";

/**
 * Wraps every /admin page, including the login. Installing the site from any
 * of them (Android "Install app" / iPhone "Add to Home Screen") gives the
 * barber a separate "Panel" app that opens on the agenda, not on the
 * customers' home page.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  manifest: "/panel.webmanifest",
  appleWebApp: { title: "Panel", capable: true, statusBarStyle: "black" },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
