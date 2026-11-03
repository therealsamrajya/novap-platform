import { Navigate, Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import { RequireAdmin } from "./lib/auth";
import { CategoriesPage } from "./pages/Categories";
import { InboxPage } from "./pages/Inbox";
import { LoginPage } from "./pages/Login";
import { OrderPage } from "./pages/Order";
import { OrdersPage } from "./pages/Orders";
import { ProductPage } from "./pages/Product";
import { ProductsPage } from "./pages/Products";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAdmin>
            <Layout />
          </RequireAdmin>
        }
      >
        <Route index element={<Navigate to="/orders" replace />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrderPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/new" element={<ProductPage />} />
        <Route path="products/:id" element={<ProductPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="*" element={<p className="text-sm text-zinc-500">Page not found.</p>} />
      </Route>
    </Routes>
  );
}
