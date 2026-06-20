import { useEffect, useState, useRef } from "react";
import styles from "./EventModal.module.css";

interface EventConfig {
  active: boolean;
  eventName: string;
  targetDate: string;
  description: string;
}

// Generate 30 floating particles with random properties for the AR effect
const PARTICLES = Array.from({ length: 30 }).map((_, i) => {
  const colors = ["#00d2ff", "#ff7a00", "#00ab56"]; // blue, orange, green
  const angle = Math.random() * Math.PI * 2;
  const speed = 40 + Math.random() * 80;
  return {
    id: i,
    color: colors[i % colors.length],
    dx: Math.cos(angle) * speed,
    dy: Math.sin(angle) * speed,
    delay: `${Math.random() * 2}s`,
    duration: `${3 + Math.random() * 4}s`,
    size: `${4 + Math.random() * 8}px`,
  };
});

export default function EventModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [config, setConfig] = useState<EventConfig | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if user has already seen the modal in this session
    const seen = sessionStorage.getItem("tiki_event_seen");
    if (seen) return;

    // Fetch config from backend trigger service
    fetch("/api/event-config")
      .then((res) => res.json())
      .then((data: EventConfig) => {
        if (data && data.active) {
          setConfig(data);
          setIsOpen(true);
        }
      })
      .catch((err) => console.error("Không thể tải cấu hình sự kiện:", err));
  }, []);

  useEffect(() => {
    if (!config || !isOpen) return;

    const updateTimer = () => {
      const difference = +new Date(config.targetDate) - +new Date();
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [config, isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    sessionStorage.setItem("tiki_event_seen", "true");
  };

  if (!isOpen || !config) return null;

  const formatNum = (num: number) => String(num).padStart(2, "0");

  return (
    <div className={styles.overlay}>
      {/* Background overlay click to close */}
      <div className={styles.backdrop} onClick={handleClose} />

      {/* AR Particle Streams radiating from the modal */}
      <div className={styles.particlesWrap}>
        {PARTICLES.map((p) => (
          <div
            key={p.id}
            className={styles.particle}
            style={{
              "--color": p.color,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              width: p.size,
              height: p.size,
              animationDelay: p.delay,
              animationDuration: p.duration,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Modal Container */}
      <div className={styles.modal}>
        {/* Left Tiki Torch */}
        <div className={`${styles.torch} ${styles.torchLeft}`}>
          <div className={styles.digitalFlame}>
            <div className={styles.flameCore} />
            <div className={styles.flameGlow} />
          </div>
          <div className={styles.torchBody} />
        </div>

        {/* Right Tiki Torch */}
        <div className={`${styles.torch} ${styles.torchRight}`}>
          <div className={styles.digitalFlame}>
            <div className={styles.flameCore} />
            <div className={styles.flameGlow} />
          </div>
          <div className={styles.torchBody} />
        </div>

        {/* Pulsing close button */}
        <button
          type="button"
          className={styles.closeBtn}
          onClick={handleClose}
          aria-label="Đóng thông báo"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        {/* Modal Content */}
        <div className={styles.content}>
          <div className={styles.glowLine} />
          <span className={styles.badge}>SPECIAL PROMO EVENT</span>
          <h2 className={styles.title}>{config.eventName} IN:</h2>
          
          {/* Countdown Clock (Tropical Digital Font style) */}
          <div className={styles.countdown}>
            <div className={styles.timeBox}>
              <span className={styles.timeVal}>{formatNum(timeLeft.days)}</span>
              <span className={styles.timeUnit}>DAYS</span>
            </div>
            <span className={styles.divider}>:</span>
            <div className={styles.timeBox}>
              <span className={styles.timeVal}>{formatNum(timeLeft.hours)}</span>
              <span className={styles.timeUnit}>HRS</span>
            </div>
            <span className={styles.divider}>:</span>
            <div className={styles.timeBox}>
              <span className={styles.timeVal}>{formatNum(timeLeft.minutes)}</span>
              <span className={styles.timeUnit}>MINS</span>
            </div>
            <span className={styles.divider}>:</span>
            <div className={styles.timeBox}>
              <span className={styles.timeVal}>{formatNum(timeLeft.seconds)}</span>
              <span className={styles.timeUnit}>SECS</span>
            </div>
          </div>

          <p className={styles.desc}>{config.description}</p>
          <button type="button" className={styles.actionBtn} onClick={handleClose}>
            GET SECRET LINK
          </button>
        </div>
      </div>
    </div>
  );
}
