import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTodos from "./tools/list-todos";
import createTodo from "./tools/create-todo";
import completeTodo from "./tools/complete-todo";
import searchCustomers from "./tools/search-customers";
import getCustomer from "./tools/get-customer";
import createCustomer from "./tools/create-customer";
import appendCustomerNote from "./tools/append-customer-note";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "atelier-mcp",
  title: "Atelier — Notebook & To-Do",
  version: "0.1.0",
  instructions:
    "Tools for the Atelier app: manage the signed-in user's to-do list and their private women's-footwear customer notebook (search customers, read details, create customers, append notes).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listTodos,
    createTodo,
    completeTodo,
    searchCustomers,
    getCustomer,
    createCustomer,
    appendCustomerNote,
  ],
});
