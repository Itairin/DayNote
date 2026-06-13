import { ReactNode } from "react";
import NavBar from "../components/NavBar";

export default function LayoutMinimal({ children }: { children: ReactNode }) {
  return (
    <div className="app-container">
      <NavBar />
      <div className="content-area">{children}</div>
    </div>
  );
}
