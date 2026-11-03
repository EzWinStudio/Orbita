(() => {
  const DISCORD_URL = "https://discord.gg/4vYK5vWCy8";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* Mobile navigation */

  const header = document.querySelector(".site-header");
  const menuToggle = document.getElementById("menu-toggle");
  const nav = document.getElementById("site-nav");

  if (header && menuToggle && nav) {
    const setNav = (open) => {
      header.dataset.navOpen = String(open);
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.setAttribute("aria-label", open ? "Menüyü kapat" : "Menüyü aç");
    };

    menuToggle.addEventListener("click", () => {
      setNav(header.dataset.navOpen !== "true");
    });

    nav.addEventListener("click", (event) => {
      if (event.target.closest("a")) setNav(false);
    });

    document.addEventListener("click", (event) => {
      if (header.dataset.navOpen !== "true") return;
      if (!header.contains(event.target)) setNav(false);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || header.dataset.navOpen !== "true") return;
      setNav(false);
      menuToggle.focus();
    });

    const desktop = window.matchMedia("(min-width: 981px)");
    desktop.addEventListener("change", (event) => {
      if (event.matches) setNav(false);
    });
  }

  /* Order slip */

  const priceBoard = document.querySelector(".price-board");
  const slip = document.getElementById("slip");

  if (slip && priceBoard) {
    const inputs = Array.from(priceBoard.querySelectorAll('input[name="package"]'));
    const labels = inputs.map((input) => input.closest(".pkg"));
    const packageLabel = document.getElementById("slip-package");
    const totalLabel = document.getElementById("slip-total");
    const dateLabel = document.getElementById("slip-date");
    const robioxInput = document.getElementById("roblox-user");
    const discordInput = document.getElementById("discord-user");
    const copyButton = document.getElementById("copy-slip");
    const status = document.getElementById("slip-status");
    const fallback = document.getElementById("slip-fallback");
    const fallbackText = document.getElementById("slip-fallback-text");

    const current = () => {
      const input = inputs.find((item) => item.checked) || inputs[0];
      return {
        rp: Number(input.dataset.rp),
        price: Number(input.dataset.price),
        priceLabel: `${input.dataset.price} TL`,
      };
    };

    const setDate = () => {
      if (!dateLabel) return;
      const now = new Date();
      dateLabel.textContent = new Intl.DateTimeFormat("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(now);
    };

    const sync = (animate) => {
      const selection = current();
      if (packageLabel) packageLabel.textContent = `${selection.rp} R$`;
      if (totalLabel) {
        totalLabel.textContent = selection.priceLabel;
        if (animate && !reduceMotion.matches) {
          totalLabel.classList.remove("is-pulsing");
          void totalLabel.offsetWidth;
          totalLabel.classList.add("is-pulsing");
        }
      }
      labels.forEach((label, index) => {
        if (!label) return;
        label.classList.toggle("is-selected", inputs[index].checked);
      });
    };

    const clearStatus = () => {
      if (status) status.textContent = "";
      if (fallback) fallback.hidden = true;
    };

    const buildSummary = () => {
      const selection = current();
      const roblox = robioxInput ? robioxInput.value.trim() : "";
      const discord = discordInput ? discordInput.value.trim() : "";
      const date = dateLabel ? dateLabel.textContent : "";
      return [
        "CATA STORE — Sipariş taslağı",
        `Tarih: ${date}`,
        `Paket: ${selection.rp} R$`,
        `Liste fiyatı: ${selection.priceLabel}`,
        "Teslimat: Grup ödemesi (Roblox)",
        "Kanal: Discord",
        `Roblox kullanıcı adı: ${roblox || "Belirtilmedi"}`,
        `Discord kullanıcı adı: ${discord || "Belirtilmedi"}`,
        "",
        "Not: Bu bir taslaktır; güncel fiyat ve stok Discord'da doğrulanacak.",
        `Discord: ${DISCORD_URL}`,
      ].join("\n");
    };

    const legacyCopy = (text) => {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.top = "-1000px";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      return copied;
    };

    const showFallback = (text) => {
      if (!fallback || !fallbackText) return;
      fallbackText.value = text;
      fallback.hidden = false;
      fallbackText.focus();
      fallbackText.select();
    };

    const copySummary = async () => {
      const text = buildSummary();
      if (status) status.textContent = "";

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
        } else if (!legacyCopy(text)) {
          throw new Error("copy unavailable");
        }
        if (status) {
          status.textContent = "Sipariş özeti kopyalandı. Discord'da ekiple paylaşabilirsin.";
        }
      } catch (error) {
        if (status) {
          status.textContent = "Otomatik kopyalama çalışmadı. Özeti aşağıdan seçip kopyalayabilirsin.";
        }
        showFallback(text);
      }
    };

    inputs.forEach((input) => {
      input.addEventListener("change", () => {
        clearStatus();
        sync(true);
      });
    });

    [robioxInput, discordInput].forEach((input) => {
      if (!input) return;
      input.addEventListener("input", clearStatus);
    });

    if (copyButton) copyButton.addEventListener("click", copySummary);

    const form = document.querySelector(".price-board");
    if (form) form.addEventListener("submit", (event) => event.preventDefault());

    setDate();
    sync(false);
  }

  /* FAQ: one answer open at a time */

  const faq = document.querySelector(".faq-list");
  if (faq) {
    faq.addEventListener("toggle", (event) => {
      const item = event.target;
      if (!(item instanceof HTMLDetailsElement) || !item.open) return;
      faq.querySelectorAll("details[open]").forEach((other) => {
        if (other !== item) other.open = false;
      });
    }, true);
  }
})();
