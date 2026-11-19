import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, Bebas_Neue } from "next/font/google";
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
      </body>
    </html>
  );
}
