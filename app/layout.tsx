import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vape App",
  description: "Stock, ventas, pedidos y gastos",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-AR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
