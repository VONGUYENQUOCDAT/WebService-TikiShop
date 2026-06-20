-- =============================================================================
-- TIKI — MySQL 8.x: schema + seed (khớp Prisma @@map: user, category, product…)
-- Workbench: mở file → Execute (⚡). Hoặc dùng: npx prisma migrate deploy
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `tiki`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `tiki`;

SET NAMES utf8mb4;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `orderitem`;
DROP TABLE IF EXISTS `order`;
DROP TABLE IF EXISTS `cartitem`;
DROP TABLE IF EXISTS `product`;
DROP TABLE IF EXISTS `category`;
DROP TABLE IF EXISTS `user`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `user` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `category` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NULL,
    UNIQUE INDEX `Category_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `product` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `price` INTEGER NOT NULL,
    `listPrice` INTEGER NULL,
    `image` TEXT NOT NULL,
    `rating` DOUBLE NOT NULL DEFAULT 4.5,
    `reviewCount` INTEGER NOT NULL DEFAULT 0,
    `sold` INTEGER NOT NULL DEFAULT 0,
    `stock_quantity` INTEGER NOT NULL DEFAULT 0,
    `badge` VARCHAR(191) NULL,
    `brand` VARCHAR(191) NULL,
    `tags` TEXT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    UNIQUE INDEX `Product_slug_key`(`slug`),
    INDEX `Product_name_idx`(`name`),
    INDEX `Product_description_idx`(`description`(191)),
    INDEX `Product_brand_idx`(`brand`),
    INDEX `Product_categoryId_idx`(`categoryId`),
    INDEX `Product_price_idx`(`price`),
    INDEX `Product_rating_idx`(`rating`),
    INDEX `Product_sold_idx`(`sold`),
    INDEX `Product_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `cartitem` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    INDEX `CartItem_productId_fkey`(`productId`),
    UNIQUE INDEX `CartItem_userId_productId_key`(`userId`, `productId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `order` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `total` INTEGER NOT NULL,
    `address` TEXT NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `Order_userId_fkey`(`userId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `orderitem` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `price` INTEGER NOT NULL,
    INDEX `OrderItem_orderId_fkey`(`orderId`),
    INDEX `OrderItem_productId_fkey`(`productId`),
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `product` ADD CONSTRAINT `product_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `cartitem` ADD CONSTRAINT `cartitem_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `cartitem` ADD CONSTRAINT `cartitem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `order` ADD CONSTRAINT `order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `orderitem` ADD CONSTRAINT `orderitem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `orderitem` ADD CONSTRAINT `orderitem_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- -----------------------------------------------------------------------------
-- Seed (giống prisma/seed.ts; id category/product = slug để dễ đọc)
-- -----------------------------------------------------------------------------

INSERT INTO `category` (`id`, `name`, `slug`, `icon`) VALUES
  ('dien-thoai-may-tinh-bang', 'Điện thoại - Máy tính bảng', 'dien-thoai-may-tinh-bang', '📱'),
  ('dien-tu-dien-may', 'Điện tử - Điện máy', 'dien-tu-dien-may', '📺'),
  ('thoi-trang-nam', 'Thời trang nam', 'thoi-trang-nam', '👔'),
  ('thoi-trang-nu', 'Thời trang nữ', 'thoi-trang-nu', '👗'),
  ('nha-cua-doi-song', 'Nhà cửa - Đời sống', 'nha-cua-doi-song', '🏠'),
  ('sach-vpp', 'Sách - VPP', 'sach-vpp', '📚'),
  ('lam-dep-suc-khoe', 'Làm đẹp - Sức khỏe', 'lam-dep-suc-khoe', '💄'),
  ('the-thao-da-ngoai', 'Thể thao - Dã ngoại', 'the-thao-da-ngoai', '⚽');

INSERT INTO `product` (
  `id`, `name`, `slug`, `description`, `price`, `listPrice`, `image`,
  `rating`, `reviewCount`, `sold`, `badge`, `brand`, `tags`, `categoryId`, `stock_quantity`
) VALUES
  (
    'samsung-galaxy-a54-5g',
    'Điện thoại Samsung Galaxy A54 5G 8GB/128GB',
    'samsung-galaxy-a54-5g',
    'Màn hình Super AMOLED 6.4 inch, chip Exynos 1380, pin 5000mAh.',
    7490000, 8990000,
    'https://picsum.photos/seed/samsung-galaxy-a54-5g/280/280',
    4.8, 1250, 3200, '-17%', 'Samsung', 'điện thoại,android,5g',
    'dien-thoai-may-tinh-bang', 150
  ),
  (
    'iphone-15-128gb',
    'iPhone 15 128GB | Chính hãng VN/A',
    'iphone-15-128gb',
    'Chip A16 Bionic, Dynamic Island, camera 48MP.',
    19990000, 22990000,
    'https://picsum.photos/seed/iphone-15-128gb/280/280',
    4.9, 890, 1500, 'Giảm sốc', 'Apple', 'điện thoại,ios,iphone',
    'dien-thoai-may-tinh-bang', 150
  ),
  (
    'xiaomi-redmi-note-13-pro',
    'Xiaomi Redmi Note 13 Pro 8GB/256GB',
    'xiaomi-redmi-note-13-pro',
    'Màn AMOLED 120Hz, Snapdragon 7s Gen 2.',
    6690000, 7290000,
    'https://picsum.photos/seed/xiaomi-redmi-note-13-pro/280/280',
    4.7, 560, 2100, NULL, 'Xiaomi', 'điện thoại,android,redmi',
    'dien-thoai-may-tinh-bang', 150
  ),
  (
    'laptop-asus-vivobook-15-oled',
    'Laptop ASUS VivoBook 15 OLED',
    'laptop-asus-vivobook-15-oled',
    'Intel Core i5, RAM 16GB, SSD 512GB, OLED.',
    15990000, 17990000,
    'https://picsum.photos/seed/laptop-asus-vivobook-15-oled/280/280',
    4.6, 320, 890, 'Mới', 'ASUS', 'laptop,máy tính,oled',
    'dien-tu-dien-may', 150
  ),
  (
    'sony-wh-1000xm5',
    'Tai nghe Bluetooth Sony WH-1000XM5',
    'sony-wh-1000xm5',
    'Chống ồn chủ động, pin 30 giờ.',
    7490000, 8990000,
    'https://picsum.photos/seed/sony-wh-1000xm5/280/280',
    4.9, 2100, 5600, 'TikiNOW', 'Sony', 'tai nghe,bluetooth,chống ồn',
    'dien-tu-dien-may', 150
  ),
  (
    'smart-tv-samsung-55',
    'Smart TV Samsung 55 inch Crystal UHD',
    'smart-tv-samsung-55',
    '4K HDR, hệ điều hành Tizen.',
    11290000, 13990000,
    'https://picsum.photos/seed/smart-tv-samsung-55/280/280',
    4.5, 412, 780, '-19%', NULL, NULL,
    'dien-tu-dien-may', 150
  ),
  (
    'ao-thun-nam-co-tru-coolmate',
    'Áo thun nam cổ trụ Basic Coolmate',
    'ao-thun-nam-co-tru-coolmate',
    'Vải cotton thoáng mát, nhiều màu.',
    199000, 299000,
    'https://picsum.photos/seed/ao-thun-nam-co-tru-coolmate/280/280',
    4.7, 890, 12000, NULL, NULL, NULL,
    'thoi-trang-nam', 150
  ),
  (
    'quan-jean-nam-slim-fit',
    'Quần jean nam slim fit',
    'quan-jean-nam-slim-fit',
    'Co giãn nhẹ, form slim.',
    399000, 599000,
    'https://picsum.photos/seed/quan-jean-nam-slim-fit/280/280',
    4.4, 230, 3400, NULL, NULL, NULL,
    'thoi-trang-nam', 150
  ),
  (
    'vay-lien-nu-cong-so',
    'Váy liền nữ công sở',
    'vay-lien-nu-cong-so',
    'Chất liệu lụa mát, thanh lịch.',
    459000, 659000,
    'https://picsum.photos/seed/vay-lien-nu-cong-so/280/280',
    4.6, 156, 2100, 'Mới', NULL, NULL,
    'thoi-trang-nu', 150
  ),
  (
    'tui-xach-nu-da-pu',
    'Túi xách nữ da PU cao cấp',
    'tui-xach-nu-da-pu',
    'Nhiều ngăn, khóa kéo YKK.',
    329000, 499000,
    'https://picsum.photos/seed/tui-xach-nu-da-pu/280/280',
    4.5, 98, 890, NULL, NULL, NULL,
    'thoi-trang-nu', 150
  ),
  (
    'noi-chien-khong-dau-philips',
    'Nồi chiên không dầu Philips 4.1L',
    'noi-chien-khong-dau-philips',
    'Công nghệ Rapid Air, dễ vệ sinh.',
    1990000, 2490000,
    'https://picsum.photos/seed/noi-chien-khong-dau-philips/280/280',
    4.8, 3400, 15000, 'Bán chạy', NULL, NULL,
    'nha-cua-doi-song', 150
  ),
  (
    'bo-chan-ga-cotton-amando',
    'Bộ chăn ga cotton Amando',
    'bo-chan-ga-cotton-amando',
    '1m6 x 2m, nhiều họa tiết.',
    890000, 1190000,
    'https://picsum.photos/seed/bo-chan-ga-cotton-amando/280/280',
    4.6, 670, 4500, NULL, NULL, NULL,
    'nha-cua-doi-song', 150
  ),
  (
    'sach-dac-nhan-tam',
    'Sách Đắc Nhân Tâm (bìa cứng)',
    'sach-dac-nhan-tam',
    'Bản dịch Nguyễn Hiến Lê.',
    79000, 120000,
    'https://picsum.photos/seed/sach-dac-nhan-tam/280/280',
    4.9, 12000, 80000, NULL, NULL, NULL,
    'sach-vpp', 150
  ),
  (
    'but-bi-thien-long-tl027',
    'Bút bi Thiên Long TL-027',
    'but-bi-thien-long-tl027',
    'Hộp 20 cây, mực xanh.',
    45000, NULL,
    'https://picsum.photos/seed/but-bi-thien-long-tl027/280/280',
    4.5, 560, 23000, NULL, NULL, NULL,
    'sach-vpp', 150
  ),
  (
    'serum-vitamin-c-the-ordinary',
    'Serum Vitamin C The Ordinary',
    'serum-vitamin-c-the-ordinary',
    'Làm sáng da, 30ml.',
    320000, 420000,
    'https://picsum.photos/seed/serum-vitamin-c-the-ordinary/280/280',
    4.7, 2100, 12000, '-24%', NULL, NULL,
    'lam-dep-suc-khoe', 150
  ),
  (
    'kem-chong-nang-la-roche-posay',
    'Kem chống nắng La Roche-Posay',
    'kem-chong-nang-la-roche-posay',
    'SPF 50+, không nhờn.',
    395000, 495000,
    'https://picsum.photos/seed/kem-chong-nang-la-roche-posay/280/280',
    4.8, 5600, 18000, 'Hàng hiệu', NULL, NULL,
    'lam-dep-suc-khoe', 150
  ),
  (
    'giay-chay-bo-nike-revolution-6',
    'Giày chạy bộ Nike Revolution 6',
    'giay-chay-bo-nike-revolution-6',
    'Đệm êm, size đủ.',
    1890000, 2290000,
    'https://picsum.photos/seed/giay-chay-bo-nike-revolution-6/280/280',
    4.6, 890, 5600, NULL, NULL, NULL,
    'the-thao-da-ngoai', 150
  ),
  (
    'leu-cam-trai-4-nguoi',
    'Lều cắm trại 4 người Naturehike',
    'leu-cam-trai-4-nguoi',
    'Chống nước, gọn nhẹ.',
    2490000, 2990000,
    'https://picsum.photos/seed/leu-cam-trai-4-nguoi/280/280',
    4.5, 230, 890, NULL, NULL, NULL,
    'the-thao-da-ngoai', 150
  );

-- -----------------------------------------------------------------------------
-- Admin (khớp prisma seed): admin@demo.local / admin123
-- -----------------------------------------------------------------------------
INSERT INTO `user` (`id`, `email`, `name`, `phone`, `password`, `role`, `createdAt`) VALUES
  ('seed-admin-local-demo', 'admin@demo.local', 'Quản trị viên', NULL, '$2a$10$P79q8m4lC/Sr7UptKjMxfeU67KKptWvTUDoTuzcHVza7uk5D9Zb0O', 'ADMIN', CURRENT_TIMESTAMP(3));
