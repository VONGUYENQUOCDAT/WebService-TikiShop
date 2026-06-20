import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import styles from "./HeroSection.module.css";

const SLIDES = [
  {
    tag: "Tiki Exclusive",
    title: "WELCOME TO TIKI!",
    subtitle: "EXPLORE VIBRANT DEALS!",
    desc: "Đắm chìm vào thế giới công nghệ nhiệt đới với ưu đãi tai nghe, loa thông minh và phụ kiện chính hãng.",
    cta: "SEE DEALS",
    link: "/tim-kiem?q=tai nghe",
    bg: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 40%, #0369a1 100%)",
    image: "/tiki_hero_banner.png",
  },
  {
    tag: "Flash Sale Tech",
    title: "TROPICAL TECH ISLAND",
    subtitle: "GIẢM ĐẾN 50% THIẾT BỊ SỐ",
    desc: "Điện thoại thông minh, máy tính bảng thế hệ mới và phụ kiện thông minh cực đỉnh.",
    cta: "SĂN CÔNG NGHỆ",
    link: "/danh-muc/dien-tu-dien-may",
    bg: "linear-gradient(135deg, #059669 0%, #047857 50%, #065f46 100%)",
    image: "/tiki_hero_banner.png",
  },
  {
    tag: "Summer Fashion",
    title: "JUNGLE STYLE OUTLET",
    subtitle: "MUA 1 TẶNG 1 HÈ RỰC RỠ",
    desc: "Bộ sưu tập thời trang dã ngoại, biển đảo rực rỡ sắc màu, giao nhanh 2h miễn phí.",
    cta: "KHÁM PHÁ NGAY",
    link: "/tim-kiem?q=thời trang",
    bg: "linear-gradient(135deg, #ea580c 0%, #d97706 50%, #b45309 100%)",
    image: "/tiki_hero_banner.png",
  },
];

// Sinh ngẫu nhiên các hạt đom đóm (fireflies)
const FIREFLIES = Array.from({ length: 18 }).map((_, i) => ({
  id: i,
  top: `${Math.random() * 85 + 5}%`,
  left: `${Math.random() * 90 + 5}%`,
  delay: `${Math.random() * 6}s`,
  duration: `${8 + Math.random() * 8}s`,
  size: `${3 + Math.random() * 6}px`,
}));

// Sinh ngẫu nhiên vị trí các lá nhiệt đới bay lơ lửng
const LEAVES = Array.from({ length: 6 }).map((_, i) => ({
  id: i,
  top: `${Math.random() * 70 + 10}%`,
  left: `${Math.random() * 80 + 10}%`,
  delay: `${Math.random() * 4}s`,
  duration: `${10 + Math.random() * 10}s`,
  scale: 0.5 + Math.random() * 0.7,
  rotate: `${Math.random() * 360}deg`,
}));

export default function HeroSection() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  const startAutoPlay = () => {
    stopAutoPlay();
    autoPlayRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 6000);
  };

  const stopAutoPlay = () => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
    }
  };

  useEffect(() => {
    startAutoPlay();
    return () => stopAutoPlay();
  }, []);

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length);
    startAutoPlay();
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    startAutoPlay();
  };

  const handleDotClick = (index: number) => {
    setCurrentSlide(index);
    startAutoPlay();
  };

  return (
    <section className={styles.heroWrap}>
      <div className="container">
        <div className={styles.heroGrid}>
          {/* Slideshow chính */}
          <div
            className={styles.slideshowContainer}
            onMouseEnter={stopAutoPlay}
            onMouseLeave={startAutoPlay}
          >
            {SLIDES.map((slide, index) => (
              <div
                key={index}
                className={`${styles.slide} ${index === currentSlide ? styles.slideActive : ""}`}
                style={{ background: slide.bg } as React.CSSProperties}
              >
                {/* Lớp hạt đom đóm động */}
                <div className={styles.particlesContainer}>
                  {FIREFLIES.map((f) => (
                    <div
                      key={f.id}
                      className={styles.firefly}
                      style={{
                        top: f.top,
                        left: f.left,
                        width: f.size,
                        height: f.size,
                        animationDelay: f.delay,
                        animationDuration: f.duration,
                      }}
                    />
                  ))}
                </div>

                {/* Các lá nhiệt đới bay lơ lửng */}
                <div className={styles.leavesContainer}>
                  {LEAVES.map((l) => (
                    <svg
                      key={l.id}
                      className={styles.floatingLeaf}
                      style={{
                        top: l.top,
                        left: l.left,
                        transform: `scale(${l.scale}) rotate(${l.rotate})`,
                        animationDelay: l.delay,
                        animationDuration: l.duration,
                      }}
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M2 22C2 22 6 18 12 17C18 16 22 12 22 2C22 2 12 2 8 8C4 14 2 22 2 22Z"
                        fill="#ffd700"
                        fillOpacity="0.15"
                        stroke="#ffd700"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M2 22C4 18 8 14 12 12"
                        stroke="#ffd700"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  ))}
                </div>

                {/* Nội dung text slide */}
                <div className={styles.slideContent}>
                  <span className={styles.slideTag}>{slide.tag}</span>
                  <h2 className={styles.slideTitle}>{slide.title}</h2>
                  <h3 className={styles.slideSubtitle}>{slide.subtitle}</h3>
                  <p className={styles.slideDesc}>{slide.desc}</p>
                  <Link to={slide.link} className={styles.btnPulse}>
                    {slide.cta}
                  </Link>
                </div>

                {/* Ảnh sản phẩm banner kết hợp */}
                <div className={styles.slideImageWrap}>
                  <img
                    src={slide.image}
                    alt={slide.title}
                    className={styles.slideImage}
                    loading="eager"
                  />
                  <div className={styles.imageOverlayGlow} />
                </div>
              </div>
            ))}

            {/* Nút điều hướng Slider */}
            <button type="button" className={styles.arrowLeft} onClick={handlePrev} aria-label="Slide trước">
              ‹
            </button>
            <button type="button" className={styles.arrowRight} onClick={handleNext} aria-label="Slide kế tiếp">
              ›
            </button>

            {/* Các chấm chuyển slide */}
            <div className={styles.dots}>
              {SLIDES.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  className={`${styles.dot} ${index === currentSlide ? styles.dotActive : ""}`}
                  onClick={() => handleDotClick(index)}
                  aria-label={`Đi tới slide ${index + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Banner phụ bên cạnh (Tropical Tech Mini Ads) */}
          <div className={styles.sideBanners}>
            <div className={`${styles.miniCard} ${styles.miniCard1}`}>
              <div className={styles.miniCardContent}>
                <span className={styles.miniBadge}>TikiNOW Giao 2h</span>
                <h4>Đơn Điện Tử</h4>
                <p>Nhận hàng tức thì trong 2 giờ, freeship mọi nơi.</p>
                <Link to="/tim-kiem?q=laptop" className={styles.miniLink}>
                  Xem ngay →
                </Link>
              </div>
              <div className={styles.miniDecorIcon}>🏝️</div>
            </div>

            <div className={`${styles.miniCard} ${styles.miniCard2}`}>
              <div className={styles.miniCardContent}>
                <span className={styles.miniBadge2}>Ưu Đãi Đặc Biệt</span>
                <h4>Gói Hội Viên Tech</h4>
                <p>Hoàn tiền 10% khi mua sắm sản phẩm công nghệ.</p>
                <Link to="/tai-khoan" className={styles.miniLink}>
                  Đăng ký →
                </Link>
              </div>
              <div className={styles.miniDecorIcon}>🦜</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

