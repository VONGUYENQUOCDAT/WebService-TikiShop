import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import Layout from "@/layout/Layout";

const Home = lazy(() => import("@/pages/home"));
const SearchPage = lazy(() => import("@/pages/search"));
const CategoriesPage = lazy(() => import("@/pages/categories"));
const CategoryPage = lazy(() => import("@/pages/category"));
const ProductPage = lazy(() => import("@/pages/product"));
const CartPage = lazy(() => import("@/pages/cart"));
const CheckoutPage = lazy(() => import("@/pages/checkout"));
const LoginPage = lazy(() => import("@/pages/login"));
const RegisterPage = lazy(() => import("@/pages/register"));
const AccountPage = lazy(() => import("@/pages/account"));
const AboutPage = lazy(() => import("@/pages/about"));

const RequireAdmin = lazy(() => import("@/pages/admin/RequireAdmin"));
const AdminLayout = lazy(() => import("@/pages/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminOrders = lazy(() => import("@/pages/admin/AdminOrders"));
const AdminOrderDetail = lazy(() => import("@/pages/admin/AdminOrderDetail"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminProducts = lazy(() => import("@/pages/admin/AdminProducts"));
const AdminCategories = lazy(() => import("@/pages/admin/AdminCategories"));
const AdminShops = lazy(() => import("@/pages/admin/AdminShops"));
const SellerRegister = lazy(() => import("@/pages/seller"));
const AdminDeliveries = lazy(() => import("@/pages/admin/AdminDeliveries"));
const AdminReturns = lazy(() => import("@/pages/admin/AdminReturns"));
const AdminReviews = lazy(() => import("@/pages/admin/AdminReviews"));
const AdminVouchers = lazy(() => import("@/pages/admin/Vouchers"));

// ERP Imports
const AdminSuppliers = lazy(() => import("@/pages/admin/Suppliers"));
const AdminImportOrders = lazy(() => import("@/pages/admin/ImportOrders"));
const AdminGoodsReceipts = lazy(() => import("@/pages/admin/GoodsReceipts"));
const AdminInventory = lazy(() => import("@/pages/admin/Inventory"));
const AdminBatchManagement = lazy(() => import("@/pages/admin/BatchManagement"));

function RouteFallback() {
  return <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>Đang tải...</div>;
}

/** Redirect old /don-hang/:id → /tai-khoan/don-hang/:id */
function RedirectOrderDetail() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/tai-khoan/don-hang/${id}`} replace />;
}

function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="admin" element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="don-hang/:id" element={<AdminOrderDetail />} />
            <Route path="don-hang" element={<AdminOrders />} />
            <Route path="san-pham" element={<AdminProducts />} />
            <Route path="danh-muc" element={<AdminCategories />} />
            <Route path="nguoi-dung" element={<AdminUsers />} />
            <Route path="gian-hang" element={<AdminShops />} />
            <Route path="vouchers" element={<AdminVouchers />} />
            <Route path="deliveries" element={<AdminDeliveries />} />
            <Route path="returns" element={<AdminReturns />} />
            <Route path="reviews" element={<AdminReviews />} />
            
            {/* ERP Routes */}
            <Route path="nha-cung-cap" element={<AdminSuppliers />} />
            <Route path="import-orders" element={<AdminImportOrders />} />
            <Route path="goods-receipts" element={<AdminGoodsReceipts />} />
            <Route path="kho" element={<AdminInventory />} />
            <Route path="lo-han-dung" element={<AdminBatchManagement />} />
          </Route>
        </Route>

        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="tim-kiem" element={<SearchPage />} />
          <Route path="danh-muc" element={<CategoriesPage />} />
          <Route path="danh-muc/:slug" element={<CategoryPage />} />
          <Route path="p/:slug" element={<ProductPage />} />
          <Route path="gio-hang" element={<CartPage />} />
          <Route path="thanh-toan" element={<CheckoutPage />} />
          <Route path="dang-nhap" element={<LoginPage />} />
          <Route path="dang-ky" element={<RegisterPage />} />
          <Route path="gioi-thieu" element={<AboutPage />} />
          <Route path="ban-hang" element={<SellerRegister />} />

          {/* Account dashboard — all account/order routes */}
          <Route path="tai-khoan" element={<AccountPage />} />
          <Route path="tai-khoan/don-hang" element={<AccountPage />} />
          <Route path="tai-khoan/don-hang/:id" element={<AccountPage />} />
          <Route path="tai-khoan/cai-dat" element={<AccountPage />} />

          {/* Backward compatibility: redirect old standalone order URLs */}
          <Route path="don-hang/:id" element={<RedirectOrderDetail />} />
          <Route path="don-hang" element={<Navigate to="/tai-khoan/don-hang" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;