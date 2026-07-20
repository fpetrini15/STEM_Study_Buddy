const CatalogUtils = {
  MEDICAL_SUBJECTS: new Set(["emt", "pharmacology"]),

  MEDICAL_DISCLAIMER_TEXT:
    "STEM Study Buddy’s medical quizzes are for educational practice only. They are not medical advice, certification, continuing education credit, or a substitute for accredited training, agency protocols, medical direction, or the judgment of a licensed clinician. Content may be incomplete or outdated—always verify against current guidelines and qualified instructors. Do not use this site to diagnose, treat, dose, or manage real patients.",

  async loadCatalog() {
    const res = await fetch("data/catalog.json", { cache: "no-store" });
    if (!res.ok) {
      throw new Error("Could not load the quiz catalog.");
    }
    return res.json();
  },

  getSections(catalog) {
    if (Array.isArray(catalog?.sections)) return catalog.sections;

    const subjects = this.getSubjectsMap(catalog);
    const keys = Object.keys(subjects);
    return keys.length ? [{ title: "Subjects", subjects: keys }] : [];
  },

  getSubject(catalog, subjectKey) {
    if (!catalog || !subjectKey) return null;
    if (subjectKey === "sections" || subjectKey === "subjects") return null;

    // Nested shape (briefly used) or flat top-level subjects.
    return catalog.subjects?.[subjectKey] ?? catalog[subjectKey] ?? null;
  },

  getSubjectsMap(catalog) {
    if (!catalog || typeof catalog !== "object") return {};

    if (catalog.subjects && typeof catalog.subjects === "object") {
      return catalog.subjects;
    }

    const subjects = { ...catalog };
    delete subjects.sections;
    return subjects;
  },

  isMedicalSubject(subjectKey) {
    return this.MEDICAL_SUBJECTS.has(subjectKey);
  },

  createMedicalDisclaimer({ compact = false } = {}) {
    const el = document.createElement("p");
    el.className = compact
      ? "medical-disclaimer medical-disclaimer--compact"
      : "medical-disclaimer";
    el.setAttribute("role", "note");
    el.textContent = this.MEDICAL_DISCLAIMER_TEXT;
    return el;
  },

  showLoadError(container, message, backHref, backLabel) {
    container.replaceChildren();

    const panel = document.createElement("div");
    panel.className = "load-error";
    panel.innerHTML = `
      <h2>Something went wrong</h2>
      <p>${message}</p>
    `;

    if (backHref) {
      const link = document.createElement("a");
      link.className = "btn btn-small nav-link";
      link.href = backHref;
      link.textContent = backLabel || "Go back";
      panel.appendChild(link);
    }

    container.appendChild(panel);
  },

  formatTypes(types) {
    const labels = [];
    if (types.multiple_choice) labels.push("Multiple choice");
    if (types.drag_and_drop) labels.push("Drag & drop");
    if (types.drug_worksheet) labels.push("Drug worksheet");
    return labels.join(" · ");
  },

  formatMeta(quiz) {
    if (!quiz.available) return "Coming soon";
    if (!quiz.questionCount) return "Quiz available";
    const minutes = Math.max(1, Math.round(quiz.questionCount * 0.5));
    const types = this.formatTypes(quiz.types);
    return types
      ? `${quiz.questionCount} questions · ${types} · ~${minutes} min`
      : `${quiz.questionCount} questions · ~${minutes} min`;
  },

  async loadQuizStats(subjectKey, quizId) {
    try {
      const res = await fetch(`data/${subjectKey}/${quizId}.json`);
      if (!res.ok) return null;

      const data = await res.json();
      const types = {};

      data.questions.forEach((question) => {
        types[question.type] = (types[question.type] || 0) + 1;
      });

      return {
        questionCount: data.questions.length,
        types,
        title: data.title,
      };
    } catch {
      return null;
    }
  },

  async loadPracticeStats(subjectKey, dataFile) {
    try {
      const res = await fetch(`data/${subjectKey}/${dataFile}.json`);
      if (!res.ok) return null;

      const data = await res.json();
      const itemCount = data.molecules?.length ?? 0;

      return {
        itemCount,
        title: data.title,
      };
    } catch {
      return null;
    }
  },

  formatPracticeMeta(quiz) {
    if (quiz.itemCount > 0) {
      return `${quiz.itemCount} structures · Interactive practice`;
    }
    return "Interactive practice";
  },

  async enrichQuiz(subjectKey, quiz) {
    if (quiz.href) {
      const dataFile = quiz.dataFile || quiz.id;
      const stats = await this.loadPracticeStats(subjectKey, dataFile);

      return {
        ...quiz,
        // Catalog entries are launchable; stats only enrich the subtitle.
        available: true,
        itemCount: stats?.itemCount ?? 0,
        quizTitle: stats?.title ?? quiz.title,
      };
    }

    const stats = await this.loadQuizStats(subjectKey, quiz.id);

    return {
      ...quiz,
      available: true,
      questionCount: stats?.questionCount ?? 0,
      types: stats?.types ?? {},
      quizTitle: stats?.title ?? quiz.title,
    };
  },

  createQuizCard(subjectKey, quiz, searchText) {
    const card = document.createElement("div");
    card.className = "subject-card quiz-card";
    card.dataset.search = searchText || `${quiz.title} ${quiz.description}`.toLowerCase();

    const meta = quiz.href ? this.formatPracticeMeta(quiz) : this.formatMeta(quiz);

    card.innerHTML = `
      <div class="subject-icon">${quiz.icon}</div>
      <h3>${quiz.title}</h3>
      <p>${quiz.description}</p>
      <p class="quiz-meta">${meta}</p>
    `;

    if (quiz.available) {
      const link = document.createElement("a");
      link.className = "btn btn-full card-link";
      link.href = quiz.href || `quiz.html?quiz=${subjectKey}/${quiz.id}`;
      link.textContent = "Start Quiz";
      card.appendChild(link);
    } else {
      const btn = document.createElement("button");
      btn.className = "btn btn-full btn-disabled";
      btn.disabled = true;
      btn.textContent = "Coming Soon";
      card.appendChild(btn);
    }

    return card;
  },

  createSubjectCard(subjectKey, subject) {
    const card = document.createElement("div");
    card.className = `subject-card subject-card--${subjectKey}`;

    const iconIsImage =
      typeof subject.cardIcon === "string" &&
      (/\.(svg|png|webp|jpe?g)$/i.test(subject.cardIcon) ||
        subject.cardIcon.startsWith("images/"));

    const iconHtml = iconIsImage
      ? `<img class="subject-icon-img" src="${subject.cardIcon}" alt="" />`
      : subject.cardIcon;

    card.innerHTML = `
      <div class="subject-icon">${iconHtml}</div>
      <h3>${subject.title}</h3>
      <p>${subject.summary}</p>
    `;

    const link = document.createElement("a");
    link.className = "btn btn-full card-link";
    link.href = `${subjectKey}.html`;
    link.textContent = "View Quizzes";
    card.appendChild(link);

    return card;
  },
};
