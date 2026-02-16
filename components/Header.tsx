"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "../styles/Header.module.css";
import Image from "next/image";

interface HeaderProps {
  siteTitle?: string;
}

export default function Header({ siteTitle }: HeaderProps) {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("darkMode") === null) {
      const OSLikesDark =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      setDarkMode(OSLikesDark);
      localStorage.setItem("darkMode", String(OSLikesDark));
    } else if (localStorage.getItem("darkMode") === "true") {
      setDarkMode(true);
      document.body.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    console.log(darkMode);
    if (darkMode) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    const toggle = !darkMode;
    setDarkMode(toggle);
    localStorage.setItem("darkMode", String(toggle));
  };
  /*
display: flex;
  padding: 0.5rem 1rem;
  justify-content: space-between;
  flex-direction: row;
  align-items: center;
  text-align: center;
  gap: 0.5rem;
  width: 100%;
  background-color: #fff;
  border-bottom: 2px solid #000;
*/
  return (
    <header className={styles.header}>
      <nav
        className="flex flex-row align-center text-center w-full"
        role="navigation"
        aria-label="main navigation"
      >
        <Link href="/" passHref>
          <h1>{siteTitle}</h1>
          <h5 style={{ color: "#555", fontWeight: 20, textAlign: "center" }}>
            Barbosa-Chifan
          </h5>
        </Link>
        <div className="flex justify-baseline align-baseline justify-between w-full">
          <Link href="/about" passHref title="About">
            <h2>About</h2>
          </Link>
          <div
            className={`dark-is-${darkMode ? "on" : "off"}`}
            onClick={toggleDarkMode}
            title="Toggle dark mode"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
              <path d="M448 256c0-106-86-192-192-192V448c106 0 192-86 192-192zm64 0c0 141.4-114.6 256-256 256S0 397.4 0 256S114.6 0 256 0S512 114.6 512 256z" />
            </svg>
          </div>
          <div style={{ height: "40px" }} />
          <Link
            target="_blank"
            href="https://www.github.com/kaiobarb"
            passHref
            title="Github"
          >
            <Image
              className="no-invert"
              src="/icons/githublogo.png"
              alt="Github"
              width={52}
              height={52}
            />
          </Link>
        </div>

        <div style={{ height: "80%" }} />
      </nav>
    </header>
  );
}
