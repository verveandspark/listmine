import { useContext } from "react";
import { ListContext } from "./ListContext";

export const useLists = () => {
  const context = useContext(ListContext);
  if (context === undefined) {
    throw new Error("useLists must be used within a ListProvider");
  }
  return context;
};
