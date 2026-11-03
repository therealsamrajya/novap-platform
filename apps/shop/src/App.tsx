import { Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./lib/auth";
import { AccountOrderPage, AccountPage } from "./pages/Account";
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage, VerifyEmailPage } from "./pages/Auth";
import { CartPage } from "./pages/Cart";
import { CheckoutSuccessPage } from "./pages/CheckoutSuccess";
import { ContactPage } from "./pages/Contact";
import { HomePage } from "./pages/Home";
import { NotFoundPage } from "./pages/NotFound";
import { ProductPage } from "./pages/Product";
import { ShopPage } from "./pages/Shop";

// /cart, /checkout/success, /reset-password and /verify-email are linked from the API
// (Stripe redirects and emails), so their paths must not change without updating apps/api.
export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="shop" element={<ShopPage />} />
        <Route path="products/:slug" element={<ProductPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout/success" element={<CheckoutSuccessPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route
          path="account"
          element={
            <RequireAuth>
              <AccountPage />
            </RequireAuth>
          }
        />
        <Route
          path="account/orders/:id"
          element={
            <RequireAuth>
              <AccountOrderPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
