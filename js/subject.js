const subject = document.body.dataset.subject;
const catalogRoot = document.getElementById("quiz-catalog");
const controlsEl = document.getElementById("quiz-controls");
const searchInput = document.getElementById("quiz-search");
const searchWrap = document.getElementById("quiz-search-wrap");
const filterWrap = document.getElementById("quiz-filter-wrap");
const filtersEl = document.getElementById("quiz-filters");

let activeUnitFilter = "all";

function unitSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function applyFilters() {
  const query = searchInput?.value.trim().toLowerCase() || "";

  document.querySelectorAll(".quiz-unit").forEach((unit) => {
    if (unit.classList.contains("quiz-unit--coming-soon")) {
      unit.classList.toggle("hidden", activeUnitFilter !== "all");
      return;
    }

    const unitId = unit.dataset.unit;
    const unitMatches = activeUnitFilter === "all" || unitId === activeUnitFilter;
    let visibleCards = 0;

    unit.querySelectorAll(".quiz-card").forEach((card) => {
      const searchMatches =
        !query || (card.dataset.search || "").includes(query);
      const matches = unitMatches && searchMatches;
      card.classList.toggle("hidden", !matches);
      if (matches) visibleCards++;
    });

    unit.classList.toggle("hidden", !unitMatches || visibleCards === 0);
  });
}

function setupUnitFilters(units) {
  if (!filterWrap || !filtersEl) return;

  const chips = [
    { id: "all", label: "All" },
    ...units.map((unit) => ({ id: unitSlug(unit.name), label: unit.name })),
  ];

  chips.forEach(({ id, label }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quiz-filter-chip";
    button.dataset.unit = id;
    button.textContent = label;
    button.setAttribute("aria-pressed", id === "all" ? "true" : "false");

    if (id === "all") {
      button.classList.add("quiz-filter-chip--active");
    }

    button.addEventListener("click", () => {
      activeUnitFilter = id;

      filtersEl.querySelectorAll(".quiz-filter-chip").forEach((chip) => {
        const isActive = chip.dataset.unit === id;
        chip.classList.toggle("quiz-filter-chip--active", isActive);
        chip.setAttribute("aria-pressed", String(isActive));
      });

      applyFilters();
    });

    filtersEl.appendChild(button);
  });
}

function setupSearch() {
  if (!searchInput || !searchWrap) return;

  searchInput.addEventListener("input", applyFilters);
}

function setupCatalogControls(units) {
  if (!controlsEl) return;

  controlsEl.classList.remove("hidden");
  setupUnitFilters(units);
  setupSearch();
}

function renderComingSoon(items) {
  const section = document.createElement("section");
  section.className = "quiz-unit quiz-unit--coming-soon";

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
  section.dataset.unit = unitSlug(unit.name);

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
      setupCatalogControls(data.units);

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
