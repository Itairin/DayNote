import { ReactNode } from "react";
import NavBar from "../components/NavBar";

export default function LayoutDashboard({ children }: { children: ReactNode }) {
  return (
    <div className="app-container">
      <NavBar />
      <div className="content-area">{children}</div>
    </div>
  );
}
