import "./globals.css";

export const metadata = {
  title: "Inventory Intake",
  description: "Consignment inventory intake",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
