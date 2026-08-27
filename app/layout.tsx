import type { Metadata } from "next";

import { ThemeProvider } from "@/components/providers/theme-provider";

import "./globals.css";

const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
const vercelUrl =
  process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
  process.env.VERCEL_URL?.trim();
const appUrl = configuredAppUrl
  ? configuredAppUrl
  : vercelUrl
    ? `https://${vercelUrl}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Workspace",
    template: "%s · Workspace",
  },
  description: "Un espacio privado para organizar páginas, proyectos y conocimiento.",
  openGraph: {
    description: "Organiza páginas, proyectos y conocimiento",
    images: [{ alt: "Workspace", height: 900, url: "/og.png", width: 1600 }],
    title: "Workspace",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    description: "Organiza páginas, proyectos y conocimiento",
    images: ["/og.png"],
    title: "Workspace",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <a
          className="fixed left-3 top-3 z-[100] -translate-y-20 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white focus:translate-y-0"
          href="#main-content"
        >
          Saltar al contenido
        </a>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
