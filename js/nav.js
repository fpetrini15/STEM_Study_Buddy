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

  updateQuizCrumb(title) {
    const crumb = document.getElementById("crumb-quiz");
    if (crumb) {
      crumb.textContent = / Quiz$/.test(title) ? title : `${title} Quiz`;
    }
  },

  formatSubjectLabel(subject) {
    return subject.charAt(0).toUpperCase() + subject.slice(1);
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
        <button
          id="theme-toggle"
          class="theme-toggle"
          type="button"
          aria-label="Toggle dark mode"
        >🌙</button>
      </div>
    `;

    document.body.prepend(header);

    if (typeof Theme !== "undefined") {
      Theme.bindToggle();
    }
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

  renderRecent() {
    const container = document.getElementById("recent-quizzes");
    if (!container) return;

    const subject = document.body.dataset.subject;
    let recent = this.getRecentQuizzes();

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

      const subjectLabel =
        item.subject.charAt(0).toUpperCase() + item.subject.slice(1);
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
