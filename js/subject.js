const subject = document.body.dataset.subject;
const catalogRoot = document.getElementById("quiz-catalog");
const searchInput = document.getElementById("quiz-search");
const searchWrap = document.getElementById("quiz-search-wrap");

function setupSearch() {
  if (!searchInput || !searchWrap) return;

  searchWrap.classList.remove("hidden");

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();

    document.querySelectorAll(".quiz-unit").forEach((unit) => {
      let visibleCards = 0;

      unit.querySelectorAll(".quiz-card").forEach((card) => {
        const matches =
          !query || (card.dataset.search || "").includes(query);
        card.classList.toggle("hidden", !matches);
        if (matches) visibleCards++;
      });

      unit.classList.toggle("hidden", visibleCards === 0);
    });
  });
}

function renderComingSoon(items) {
  const section = document.createElement("section");
  section.className = "quiz-unit";

  const heading = document.createElement("h2");
  heading.className = "quiz-unit-title";
  heading.textContent = "Coming Soon";
  section.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "subject-grid";

  items.forEach((quiz) => {
    const card = document.createElement("div");
    card.className = "subject-card";
    card.innerHTML = `
      <div class="subject-icon">${quiz.icon}</div>
      <h3>${quiz.title}</h3>
      <p>${quiz.description}</p>
      <p class="quiz-meta">Coming soon</p>
    `;
    const btn = document.createElement("button");
    btn.className = "btn btn-full btn-disabled";
    btn.disabled = true;
    btn.textContent = "Coming Soon";
    card.appendChild(btn);
    grid.appendChild(card);
  });

  section.appendChild(grid);
  return section;
}

async function renderUnit(subjectKey, unit) {
  const section = document.createElement("section");
  section.className = "quiz-unit";

  const heading = document.createElement("h2");
  heading.className = "quiz-unit-title";
  heading.textContent = unit.name;
  section.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "subject-grid";

  const quizzes = await Promise.all(
    unit.quizzes.map((quiz) => CatalogUtils.enrichQuiz(subjectKey, quiz))
  );

  quizzes.forEach((quiz) => {
    const searchText = `${quiz.title} ${quiz.description} ${unit.name}`.toLowerCase();
    grid.appendChild(CatalogUtils.createQuizCard(subjectKey, quiz, searchText));
  });

  section.appendChild(grid);
  return section;
}

async function renderSubjectPage() {
  try {
    const catalog = await CatalogUtils.loadCatalog();
    const data = catalog[subject];

    if (!data) {
      catalogRoot.textContent = "Subject not found.";
      return;
    }

    if (data.units) {
      setupSearch();

      for (const unit of data.units) {
        catalogRoot.appendChild(await renderUnit(subject, unit));
      }

      if (data.comingSoon) {
        catalogRoot.appendChild(renderComingSoon(data.comingSoon));
      }
    } else if (data.quizzes) {
      const section = document.createElement("section");
      section.className = "quiz-unit";

      const grid = document.createElement("div");
      grid.className = "subject-grid";

      const quizzes = await Promise.all(
        data.quizzes.map((quiz) => CatalogUtils.enrichQuiz(subject, quiz))
      );

      quizzes.forEach((quiz) => {
        grid.appendChild(CatalogUtils.createQuizCard(subject, quiz));
      });

      section.appendChild(grid);
      catalogRoot.appendChild(section);

      if (data.comingSoon) {
        catalogRoot.appendChild(renderComingSoon(data.comingSoon));
      }
    }
  } catch {
    CatalogUtils.showLoadError(
      catalogRoot,
      "We couldn't load quizzes for this subject. Please refresh the page or try again later.",
      "index.html",
      "Back to subjects"
    );
  }
}

renderSubjectPage();
