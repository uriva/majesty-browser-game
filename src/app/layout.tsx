import type { Metadata } from "next";
import { Cinzel, MedievalSharp } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
});

const medievalSharp = MedievalSharp({
  variable: "--font-medieval",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Majesty - The Fantasy Kingdom Sim",
  description: "An authentic indirect-control fantasy kingdom RTS in your browser. Hire heroes, set gold bounties, construct guilds, and defend your realm.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${medievalSharp.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
        {children}
      </body>
    </html>
  );
}
