import type {Metadata} from "next";
import {Fraunces, Outfit} from "next/font/google";
import "./globals.css";

const outfit = Outfit({
    variable: "--font-sans",
    subsets: ["latin", "latin-ext"],
});

const fraunces = Fraunces({
    variable: "--font-display",
    subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
    title: "Office Table Tennis Cup",
    description: "Register, play best of 3, and follow the live ranking.",
};

export default function RootLayout({children}: LayoutProps<"/">) {
    return (
        <html
            lang="en"
            className={`${outfit.variable} ${fraunces.variable} h-full antialiased`}
        >
        <body className="min-h-full bg-paper font-sans text-ink">{children}</body>
        </html>
    );
}
