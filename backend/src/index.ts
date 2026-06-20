import "dotenv/config";
import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger.js";
import { prisma } from "./lib/prisma.js";
import { connectDatabaseOrExit } from "./db-bootstrap.js";
import authRoutes from "./routes/auth.js";
import categoriesRoutes from "./routes/categories.js";
import productsRoutes from "./routes/products.js";
import cartRoutes from "./routes/cart.js";
import ordersRoutes from "./routes/orders.js";
import userRoutes from "./routes/user.js";
import searchRoutes from "./routes/search.js";
import adminRoutes from "./routes/admin.js";
import procurementRoutes from "./routes/procurement.js";
import inventoryRoutes from "./routes/inventory.js";
import checkoutRoutes from "./routes/checkout.js";
import returnsRoutes from "./routes/returns.js";
import vouchersRoutes from "./routes/vouchers.js";
import sellerRoutes from "./routes/seller.js";
import reviewRoutes from "./controllers/reviewController.js";
import adminReviewRoutes from "./controllers/adminReviewController.js";


const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Kiểm tra server
 */
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "tiki-clone-api", time: new Date().toISOString() });
});

/**
 * @openapi
 * /api/event-config:
 *   get:
 *     tags: [System]
 *     summary: Lấy cấu hình sự kiện đếm ngược cho Modal Trang chủ
 *     responses:
 *       200:
 *         description: Trả về trạng thái hoạt động và thời gian đếm ngược
 */
app.get("/api/event-config", (_req, res) => {
  const targetDate = new Date();
  // Tính chính xác 3 ngày, 14 giờ, 8 phút kể từ thời điểm hiện tại
  targetDate.setDate(targetDate.getDate() + 3);
  targetDate.setHours(targetDate.getHours() + 14);
  targetDate.setMinutes(targetDate.getMinutes() + 8);
  
  res.json({
    active: true,
    eventName: "EXCLUSIVE ACCESS",
    targetDate: targetDate.toISOString(),
    description: "Tropical Tech Island VIP Flash Sale & Secret Portal Access"
  });
});


app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: "TIKI Clone API" }));
app.get("/openapi.json", (_req, res) => res.json(swaggerSpec));

app.use("/api/auth", authRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/user", userRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/procurement", procurementRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/returns", returnsRoutes);
app.use("/api/vouchers", vouchersRoutes);
app.use("/api/seller", sellerRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/admin/reviews", adminReviewRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

async function main() {
  await connectDatabaseOrExit();

  const server = app.listen(PORT, () => {
    console.log(`API http://localhost:${PORT}`);
    console.log(`Swagger http://localhost:${PORT}/api-docs`);
  });

  const shutdown = async () => {
    server.close();
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
