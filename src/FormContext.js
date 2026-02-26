// MyContext.js
import React, { createContext } from "react";

// Create the context
export const FormContext = createContext();

// Create a provider component
export const FormContextProvider = ({ children, value }) => {
  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
};
