const RECENT_KEY = "stemStudyBuddy.recentQuizzes";
const RECENT_LIMIT = 5;

const Nav = {
  init() {
    if (document.body.dataset.page === "quiz") {
      const params = new URLSearchParams(window.location.search);
      const quiz = params.get("quiz");
      if (quiz) {
        document.body.dataset.subject = quiz.split("/")[0];
      }
    }

    this.renderHeader();
    this.renderBreadcrumbs();
    this.renderRecent();
    this.standardizeFooters();
    this.updateSiteHeaderOffset();
    this.observeSiteHeader();
    window.addEventListener("resize", () => this.updateSiteHeaderOffset());
  },

  getRecentQuizzes() {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    } catch {
      return [];
    }
  },

  recordRecentQuiz(quizPath, title) {
    if (!quizPath) return;

    const [subject, id] = quizPath.split("/");
    const entry = {
      subject,
      id,
      title: title || id,
      visitedAt: Date.now(),
    };

    let recent = this.getRecentQuizzes().filter(
      (item) => !(item.subject === subject && item.id === id)
    );
    recent.unshift(entry);
    recent = recent.slice(0, RECENT_LIMIT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  },

  collectCatalogQuizIds(catalog) {
    const ids = new Set();
    if (typeof CatalogUtils === "undefined") return ids;

    const subjects = CatalogUtils.getSubjectsMap(catalog);
    Object.entries(subjects).forEach(([subjectKey, subject]) => {
      (subject.quizzes || []).forEach((quiz) => {
        if (quiz?.id) ids.add(`${subjectKey}/${quiz.id}`);
      });
      (subject.units || []).forEach((unit) => {
        (unit.quizzes || []).forEach((quiz) => {
          if (quiz?.id) ids.add(`${subjectKey}/${quiz.id}`);
        });
      });
    });

    return ids;
  },

  async pruneRecentQuizzes() {
    const recent = this.getRecentQuizzes();
    if (!recent.length || typeof CatalogUtils === "undefined") {
      return recent;
    }

    try {
      const catalog = await CatalogUtils.loadCatalog();
      const knownIds = this.collectCatalogQuizIds(catalog);
      if (!knownIds.size) return recent;

      const pruned = recent.filter((item) =>
        knownIds.has(`${item.subject}/${item.id}`),
      );

      if (pruned.length !== recent.length) {
        localStorage.setItem(RECENT_KEY, JSON.stringify(pruned));
      }

      return pruned;
    } catch {
      return recent;
    }
  },

  updateQuizCrumb(title) {
    const crumb = document.getElementById("crumb-quiz");
    if (crumb) {
      crumb.textContent = / Quiz$/.test(title) ? title : `${title} Quiz`;
      this.updateSiteHeaderOffset();
    }
  },

  formatSubjectLabel(subject) {
    if (!subject) return "";

    const labels = {
      biology: "Biology",
      chemistry: "Chemistry",
      emt: "Emergency Medicine",
      pharmacology: "Pharmacology",
    };

    if (labels[subject]) return labels[subject];
    return subject.charAt(0).toUpperCase() + subject.slice(1);
  },

  standardizeFooters() {
    const year = new Date().getFullYear();
    const label = `STEM Study Buddy © ${year}`;

    document.querySelectorAll("footer").forEach((footer) => {
      let brand = footer.querySelector(".site-footer-brand");

      if (!brand) {
        const existing = [...footer.querySelectorAll("p")].find(
          (p) => !p.classList.contains("medical-disclaimer"),
        );

        if (existing) {
          brand = existing;
          brand.classList.add("site-footer-brand");
        } else {
          brand = document.createElement("p");
          brand.className = "site-footer-brand";
          footer.appendChild(brand);
        }
      }

      brand.textContent = label;
    });
  },

  renderHeader() {
    if (document.getElementById("site-header")) return;

    const header = document.createElement("header");
    header.id = "site-header";
    header.className = "site-header";
    header.innerHTML = `
      <div class="site-header-inner">
        <a href="index.html" class="site-logo">STEM Study Buddy</a>
        <nav class="breadcrumbs" id="breadcrumbs" aria-label="Breadcrumb"></nav>
        <div class="site-header-actions">
          <a href="feedback.html" class="feedback-link">Feedback</a>
          <button
            id="theme-toggle"
            class="theme-toggle"
            type="button"
            aria-label="Toggle dark mode"
          >🌙</button>
        </div>
      </div>
    `;

    document.body.prepend(header);

    const feedbackLink = header.querySelector(".feedback-link");
    if (feedbackLink) {
      const page = document.body.dataset.page;
      const keepSessionOpen = page === "quiz" || page === "lewis";

      if (keepSessionOpen) {
        feedbackLink.target = "_blank";
        feedbackLink.rel = "noopener noreferrer";
        feedbackLink.setAttribute(
          "aria-label",
          "Feedback (opens in a new tab)",
        );
      }

      if (page === "feedback") {
        feedbackLink.setAttribute("aria-current", "page");
      }
    }

    if (typeof Theme !== "undefined") {
      Theme.bindToggle();
    }
  },

  updateSiteHeaderOffset() {
    const header = document.getElementById("site-header");
    if (!header) return;

    document.documentElement.style.setProperty(
      "--site-header-offset",
      `${header.offsetHeight}px`,
    );
  },

  observeSiteHeader() {
    const header = document.getElementById("site-header");
    if (!header || header.dataset.offsetObserver) return;

    header.dataset.offsetObserver = "true";

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => this.updateSiteHeaderOffset());
    observer.observe(header);
  },

  renderBreadcrumbs() {
    const container = document.getElementById("breadcrumbs");
    if (!container) return;

    const page = document.body.dataset.page || "home";
    const subject = document.body.dataset.subject;
    const crumbs = [{ label: "Home", href: "index.html" }];

    if (page === "subject" && subject) {
      crumbs.push({ label: this.formatSubjectLabel(subject), href: null });
    }

    if (page === "quiz" && subject) {
      const title = this.formatSubjectLabel(subject);
      crumbs.push({ label: title, href: `${subject}.html` });
      crumbs.push({ label: `${title} Quiz`, id: "crumb-quiz", href: null });
    }

    if (page === "lewis" && subject) {
      const title = this.formatSubjectLabel(subject);
      crumbs.push({ label: title, href: `${subject}.html` });
      crumbs.push({
        label: "Lewis Dot Structures",
        id: "crumb-lewis",
        href: null,
      });
    }

    if (page === "feedback") {
      crumbs.push({ label: "Feedback", href: null });
    }

    container.replaceChildren();

    crumbs.forEach((crumb, index) => {
      if (index > 0) {
        const sep = document.createElement("span");
        sep.className = "breadcrumb-sep";
        sep.textContent = "/";
        sep.setAttribute("aria-hidden", "true");
        container.appendChild(sep);
      }

      if (crumb.href) {
        const link = document.createElement("a");
        link.href = crumb.href;
        link.textContent = crumb.label;
        container.appendChild(link);
      } else {
        const span = document.createElement("span");
        span.className = "breadcrumb-current";
        if (crumb.id) span.id = crumb.id;
        span.textContent = crumb.label;
        container.appendChild(span);
      }
    });
  },

  async renderRecent() {
    const container = document.getElementById("recent-quizzes");
    if (!container) return;

    const subject = document.body.dataset.subject;
    let recent = await this.pruneRecentQuizzes();

    if (subject) {
      recent = recent.filter((item) => item.subject === subject);
    }

    if (!recent.length) {
      container.classList.add("hidden");
      return;
    }

    container.classList.remove("hidden");
    container.replaceChildren();

    const heading = document.createElement("h2");
    heading.className = "section-title";
    heading.textContent = subject ? "Recently Studied" : "Pick Up Where You Left Off";
    container.appendChild(heading);

    const list = document.createElement("div");
    list.className = "recent-list";

    recent.forEach((item) => {
      const link = document.createElement("a");
      link.className = "recent-item";
      link.href = `quiz.html?quiz=${item.subject}/${item.id}`;

      const subjectLabel = this.formatSubjectLabel(item.subject);
      link.innerHTML = `
        <span class="recent-item-title">${item.title.replace(/ Quiz$/, "")}</span>
        <span class="recent-item-meta">${subjectLabel}</span>
      `;

      list.appendChild(link);
    });

    container.appendChild(list);
  },
};

document.addEventListener("DOMContentLoaded", () => {
  Nav.init();
});
