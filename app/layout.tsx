import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeProvider from "./theme-provider";
export const metadata:Metadata={title:"Personal Insider — Guest Relations",description:"Your private daily guest relations workspace.",manifest:"/manifest.webmanifest",appleWebApp:{capable:true,statusBarStyle:"default",title:"Personal Insider"},icons:{icon:"/favicon.svg",apple:"/icons/icon-192.png"}};
export const viewport:Viewport={width:"device-width",initialScale:1,viewportFit:"cover",themeColor:"#073b43"};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en" suppressHydrationWarning><body><ThemeProvider>{children}</ThemeProvider></body></html>}

