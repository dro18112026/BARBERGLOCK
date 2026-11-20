import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Bebas_Neue } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteConfig } from "@/config/site";
import "./globals.css";

const bebas = Bebas_Neue({
  variable: "--font-bebas",
  weight: "400",
  subsets: ["latin"],
});

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} · Reserva tu hora`,
    template: `%s · ${siteConfig.name}`,
  },
  description: `${siteConfig.tagline}. Reserva tu hora online en simples pasos.`,
  applicationName: siteConfig.name,
  appleWebApp: { title: siteConfig.shortName, capable: true, statusBarStyle: "black" },
  formatDetection: { telephone: false },
  // Absolute URLs for the link preview (WhatsApp, Facebook…).
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: siteConfig.name,
    title: `${siteConfig.name} · Reserva tu hora`,
    description: `${siteConfig.tagline}. ${siteConfig.address.street}, ${siteConfig.address.city}. Reserva en línea.`,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: siteConfig.logo.alt }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#141414",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-CL"
      className={`${bebas.variable} ${atkinson.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        {children}
        <SiteFooter />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
