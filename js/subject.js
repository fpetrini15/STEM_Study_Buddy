const subject = document.body.dataset.subject;
const catalogRoot = document.getElementById("quiz-catalog");
const controlsEl = document.getElementById("quiz-controls");
const searchInput = document.getElementById("quiz-search");
const searchWrap = document.getElementById("quiz-search-wrap");
const filterWrap = document.getElementById("quiz-filter-wrap");
const filtersEl = document.getElementById("quiz-filters");
const courseFilterWrap = document.getElementById("course-filter-wrap");
const courseFiltersEl = document.getElementById("course-filters");

let catalogUnits = [];
let courseLabels = new Map();
let activeCourseFilter = "all";
let activeUnitFilter = "all";

function unitSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function quizCourseId(unit, quiz) {
  return quiz.course || unit.course || "";
}

function unitsForCourse(courseId) {
  if (courseId === "all") return catalogUnits;
  return catalogUnits.filter((unit) =>
    (unit.quizzes || []).some((quiz) => quizCourseId(unit, quiz) === courseId),
  );
}

function setActiveChip(container, datasetKey, activeId) {
  container.querySelectorAll(".quiz-filter-chip").forEach((chip) => {
    const isActive = chip.dataset[datasetKey] === activeId;
    chip.classList.toggle("quiz-filter-chip--active", isActive);
    chip.setAttribute("aria-pressed", String(isActive));
  });
}

function applyFilters() {
  const query = searchInput?.value.trim().toLowerCase() || "";
  const courseUnits = unitsForCourse(activeCourseFilter);
  const courseHasUnits = activeCourseFilter === "all" || courseUnits.length > 0;

  document.querySelectorAll(".quiz-unit").forEach((unit) => {
    if (unit.classList.contains("course-empty")) return;

    if (unit.classList.contains("quiz-unit--coming-soon")) {
      unit.classList.toggle(
        "hidden",
        activeUnitFilter !== "all" || !courseHasUnits,
      );
      return;
    }

    const topicMatches =
      activeUnitFilter === "all" || unit.dataset.unit === activeUnitFilter;
    let visibleCards = 0;

    unit.querySelectorAll(".quiz-card").forEach((card) => {
      const courseMatches =
        activeCourseFilter === "all" || card.dataset.course === activeCourseFilter;
      const searchMatches =
        !query || (card.dataset.search || "").includes(query);
      const matches = topicMatches && courseMatches && searchMatches;
      card.classList.toggle("hidden", !matches);
      if (matches) visibleCards++;
    });

    unit.classList.toggle("hidden", !topicMatches || visibleCards === 0);
  });

  const empty = document.getElementById("course-empty");
  if (empty) {
    const showEmpty = activeCourseFilter !== "all" && courseUnits.length === 0;
    empty.classList.toggle("hidden", !showEmpty);
    if (showEmpty) {
      const label = courseLabels.get(activeCourseFilter) || "This course";
      empty.querySelector("h2").textContent = label;
      empty.querySelector("p").textContent =
        `${label} quizzes will appear here.`;
    }
  }
}

function setupUnitFilters(units) {
  if (!filterWrap || !filtersEl) return;

  filterWrap.classList.toggle("hidden", units.length === 0);
  filtersEl.replaceChildren();

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
    button.setAttribute("aria-pressed", String(id === activeUnitFilter));

    if (id === activeUnitFilter) {
      button.classList.add("quiz-filter-chip--active");
    }

    button.addEventListener("click", () => {
      activeUnitFilter = id;
      setActiveChip(filtersEl, "unit", id);
      applyFilters();
    });

    filtersEl.appendChild(button);
  });
}

function setupCourseFilters(courses) {
  if (!courseFilterWrap || !courseFiltersEl || courses.length === 0) return;

  courseFilterWrap.classList.remove("hidden");
  courseFiltersEl.replaceChildren();

  const chips = [
    { id: "all", label: "All" },
    ...courses.map((course) => ({ id: course.id, label: course.label })),
  ];

  chips.forEach(({ id, label }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "quiz-filter-chip";
    button.dataset.course = id;
    button.textContent = label;
    button.setAttribute("aria-pressed", String(id === activeCourseFilter));

    if (id === activeCourseFilter) {
      button.classList.add("quiz-filter-chip--active");
    }

    button.addEventListener("click", () => {
      activeCourseFilter = id;
      if (
        activeUnitFilter !== "all" &&
        !unitsForCourse(id).some((unit) => unitSlug(unit.name) === activeUnitFilter)
      ) {
        activeUnitFilter = "all";
      }
      setActiveChip(courseFiltersEl, "course", id);
      setupUnitFilters(unitsForCourse(id));
      applyFilters();
    });

    courseFiltersEl.appendChild(button);
  });
}

function setupSearch() {
  if (!searchInput || !searchWrap) return;

  searchInput.addEventListener("input", applyFilters);
}

function setupCatalogControls(data) {
  if (!controlsEl) return;

  catalogUnits = data.units || [];
  const courses = Array.isArray(data.courses) ? data.courses : [];
  courseLabels = new Map(courses.map((course) => [course.id, course.label]));

  setupCourseFilters(courses);
  setupUnitFilters(unitsForCourse(activeCourseFilter));
  setupSearch();
  controlsEl.classList.remove("hidden");
}

function renderCourseEmpty() {
  const section = document.createElement("section");
  section.id = "course-empty";
  section.className = "quiz-unit course-empty hidden";

  const heading = document.createElement("h2");
  heading.className = "quiz-unit-title";
  section.appendChild(heading);

  const text = document.createElement("p");
  section.appendChild(text);

  return section;
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

function renderUnit(subjectKey, unit) {
  const section = document.createElement("section");
  section.className = "quiz-unit";
  section.dataset.unit = unitSlug(unit.name);

  const heading = document.createElement("h2");
  heading.className = "quiz-unit-title";
  heading.textContent = unit.name;
  section.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "subject-grid";

  unit.quizzes.forEach((quiz) => {
    const enriched = CatalogUtils.enrichQuiz(quiz);
    const courseId = quizCourseId(unit, quiz);
    const courseLabel = courseLabels.get(courseId) || "";
    const searchText = [quiz.title, quiz.description, unit.name, courseLabel, courseId]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const card = CatalogUtils.createQuizCard(
      subjectKey,
      enriched,
      searchText,
      courseLabel,
    );
    if (courseId) card.dataset.course = courseId;
    grid.appendChild(card);
  });

  section.appendChild(grid);
  return section;
}

async function renderSubjectPage() {
  try {
    const catalog = await CatalogUtils.loadCatalog();
    const data =
      (typeof CatalogUtils.getSubject === "function"
        ? CatalogUtils.getSubject(catalog, subject)
        : null) ?? catalog[subject];

    if (!data || subject === "sections") {
      catalogRoot.textContent = "Subject not found.";
      return;
    }

    if (CatalogUtils.isMedicalSubject(subject)) {
      const hero = document.querySelector(".hero");
      if (hero && !document.querySelector(".medical-disclaimer")) {
        hero.insertAdjacentElement(
          "afterend",
          CatalogUtils.createMedicalDisclaimer(),
        );
      }
    }

    if (data.units) {
      setupCatalogControls(data);

      data.units.forEach((unit) => {
        catalogRoot.appendChild(renderUnit(subject, unit));
      });

      if (data.comingSoon) {
        catalogRoot.appendChild(renderComingSoon(data.comingSoon));
      }

      if (Array.isArray(data.courses) && data.courses.length > 0) {
        catalogRoot.appendChild(renderCourseEmpty());
      }
    } else {
      if (Array.isArray(data.quizzes) && data.quizzes.length > 0) {
        const section = document.createElement("section");
        section.className = "quiz-unit";

        const grid = document.createElement("div");
        grid.className = "subject-grid";

        data.quizzes.forEach((quiz) => {
          grid.appendChild(
            CatalogUtils.createQuizCard(subject, CatalogUtils.enrichQuiz(quiz)),
          );
        });

        section.appendChild(grid);
        catalogRoot.appendChild(section);
      }

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
