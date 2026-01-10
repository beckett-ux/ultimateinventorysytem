import "./globals.css";
import ShopifyAppBridgeProvider from "./shopify-app-bridge-provider";

export const metadata = {
  title: "Inventory Intake",
  description: "Consignment inventory intake",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ShopifyAppBridgeProvider>{children}</ShopifyAppBridgeProvider>
      </body>
    </html>
  );
}
