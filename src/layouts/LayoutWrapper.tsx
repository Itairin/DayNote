import { ReactNode } from "react";
import { useLayout } from "../contexts/LayoutContext";
import NavBar from "../components/NavBar";
import Sidebar from "../components/Sidebar";

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  const { navPosition } = useLayout();

  if (navPosition === "sidebar") {
    return (
      <div className="sidebar-layout">
        <Sidebar />
        <div className="sidebar-content">
          <div className="content-area">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <NavBar />
      <div className="content-area">{children}</div>
    </div>
  );
}