const CatalogUtils = {
  async loadCatalog() {
    const res = await fetch("data/catalog.json");
    if (!res.ok) {
      throw new Error("Could not load the quiz catalog.");
    }
    return res.json();
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
    return labels.join(" · ");
  },

  formatMeta(quiz) {
    if (!quiz.available) return "Coming soon";
    const minutes = Math.max(1, Math.round(quiz.questionCount * 0.5));
    return `${quiz.questionCount} questions · ${this.formatTypes(quiz.types)} · ~${minutes} min`;
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
        available: stats !== null,
        itemCount: stats?.itemCount ?? 0,
        quizTitle: stats?.title ?? quiz.title,
      };
    }

    const stats = await this.loadQuizStats(subjectKey, quiz.id);

    return {
      ...quiz,
      available: stats !== null,
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

    card.innerHTML = `
      <div class="subject-icon">${subject.cardIcon}</div>
      <h3>${subject.title}</h3>
      <p>${subject.summary}</p>
    `;

    const link = document.createElement("a");
    link.className = "btn btn-full card-link";
    link.href = `${subjectKey}.html`;
    link.textContent = `Open ${subject.title}`;
    card.appendChild(link);

    return card;
  },
};
