import { Link } from "react-router-dom";
import styles from "./TikiLogo.module.css";

/** Logo Tiki Mask stylized ở góc trên bên trái, được làm bằng vàng và xanh */
export default function TikiLogo() {
  return (
    <Link to="/" className={styles.wrap} aria-label="Tiki - Trang chủ">
      <div className={styles.logoContainer}>
        <svg
          className={styles.maskSvg}
          width="40"
          height="40"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Mask Base: Shield shape with gold borders and deep blue background */}
          <path
            d="M50 5 L85 20 V65 C85 80 50 95 50 95 C50 95 15 80 15 65 V20 L50 5 Z"
            fill="#0A5DC7"
            stroke="#FFD700"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          {/* Gold Mask Forehead / Crown Pattern */}
          <path d="M50 12 L75 22 V32 L50 24 L25 32 V22 L50 12 Z" fill="#FFC72C" />
          {/* Gold Eyes (Tech-Tropical) */}
          <rect x="28" y="40" width="16" height="10" rx="3" fill="#FFC72C" />
          <rect x="56" y="40" width="16" height="10" rx="3" fill="#FFC72C" />
          <circle cx="36" cy="45" r="4" fill="#003DAA" />
          <circle cx="64" cy="45" r="4" fill="#003DAA" />
          {/* Gold Nose */}
          <path d="M50 35 L44 58 H56 L50 35 Z" fill="#FFC72C" />
          {/* Mouth (Friendly smile / geometric tiki style) */}
          <path d="M30 68 C30 76 70 76 70 68 H60 C60 70 40 70 40 68 H30 Z" fill="#FFD700" />
          {/* Tech lines/glow details */}
          <line x1="22" y1="58" x2="34" y2="58" stroke="#FFD700" strokeWidth="3" />
          <line x1="66" y1="58" x2="78" y2="58" stroke="#FFD700" strokeWidth="3" />
        </svg>
        <div className={styles.textWrap}>
          <span className={styles.word}>tiki</span>
          <span className={styles.subText}>Tốt & Nhanh</span>
        </div>
      </div>
    </Link>
  );
}

