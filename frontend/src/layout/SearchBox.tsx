import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/shared/api/client";
import styles from "./SearchBox.module.css";

interface SearchBoxProps {
  placeholder?: string;
  className?: string;
}

export default function SearchBox({
  placeholder = "Tìm sản phẩm, thương hiệu và từ khóa…",
  className = "",
}: SearchBoxProps) {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const wrapperRef = useRef<HTMLDivElement>(null);

  const cacheRef = useRef<Record<string, string[]>>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(async () => {
      if (cacheRef.current[trimmed]) {
        setSuggestions(cacheRef.current[trimmed]);
        setShowSuggestions(true);
        return;
      }

      const currentRequestId = ++requestIdRef.current;

      try {
        setLoading(true);

        const res = await api.searchSuggestions(trimmed);

        if (currentRequestId !== requestIdRef.current) return;

        const data = res.suggestions || [];

        cacheRef.current[trimmed] = data;

        setSuggestions(data);
        setShowSuggestions(true);
      } catch (err) {
        console.error("Search suggestion error:", err);
        setSuggestions([]);
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const submitSearch = useCallback(
    (keyword: string) => {
      const trimmed = keyword.trim();

      if (!trimmed) return;

      navigate(`/tim-kiem?q=${encodeURIComponent(trimmed)}`);

      setShowSuggestions(false);
    },
    [navigate]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitSearch(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;

      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;

      case "Enter":
        if (selectedIndex >= 0) {
          e.preventDefault();
          submitSearch(suggestions[selectedIndex]);
        }
        break;

      case "Escape":
        setShowSuggestions(false);
        break;
    }
  };

  useEffect(() => {
    setSelectedIndex(-1);
  }, [suggestions]);

  const renderedSuggestions = useMemo(() => {
    return suggestions.map((suggestion, index) => (
      <button
        key={suggestion}
        type="button"
        className={`${styles.suggestion} ${selectedIndex === index ? styles.active : ""}`}
        onClick={() => submitSearch(suggestion)}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>

        <span>{suggestion}</span>
      </button>
    ));
  }, [suggestions, selectedIndex, submitSearch]);

  return (
    <div ref={wrapperRef} className={`${styles.searchBox} ${className}`}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputWrapper}>
          <svg
            className={styles.searchIcon}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={query}
            placeholder={placeholder}
            autoComplete="off"
            className={styles.input}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onKeyDown={handleKeyDown}
          />
        </div>

        <span className={styles.divider} />

        <button type="submit" className={styles.button}>
          <span className={styles.buttonText}>Tìm kiếm</span>
          <svg
            className={styles.buttonIcon}
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        </button>
      </form>

      {showSuggestions && (
        <div className={styles.suggestions}>
          {loading ? (
            <div className={styles.loading}>Đang tìm...</div>
          ) : suggestions.length > 0 ? (
            renderedSuggestions
          ) : (
            <div className={styles.empty}>Không tìm thấy kết quả</div>
          )}
        </div>
      )}
    </div>
  );
}
