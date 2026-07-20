async function renderHomePage() {
  const root = document.getElementById("home-sections");
  if (!root) return;

  try {
    const catalog = await CatalogUtils.loadCatalog();
    const sections = CatalogUtils.getSections(catalog);
    const subjects = CatalogUtils.getSubjectsMap(catalog);

    root.replaceChildren();

    sections.forEach((section) => {
      const sectionEl = document.createElement("section");
      sectionEl.className = "home-section";

      const heading = document.createElement("h2");
      heading.className = "section-title home-section-title";
      heading.textContent = section.title;
      sectionEl.appendChild(heading);

      const grid = document.createElement("div");
      grid.className = "subject-grid";

      (section.subjects || []).forEach((subjectKey) => {
        const subject = subjects[subjectKey];
        if (!subject) return;
        grid.appendChild(CatalogUtils.createSubjectCard(subjectKey, subject));
      });

      sectionEl.appendChild(grid);
      root.appendChild(sectionEl);
    });
  } catch {
    CatalogUtils.showLoadError(
      root,
      "We couldn't load the subject list. Please refresh the page or try again later.",
      null
    );
  }
}

renderHomePage();
