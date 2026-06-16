async function renderHomePage() {
  const grid = document.getElementById("subject-grid");

  try {
    const catalog = await CatalogUtils.loadCatalog();

    Object.entries(catalog).forEach(([subjectKey, subject]) => {
      grid.appendChild(CatalogUtils.createSubjectCard(subjectKey, subject));
    });
  } catch {
    CatalogUtils.showLoadError(
      grid,
      "We couldn't load the subject list. Please refresh the page or try again later.",
      null
    );
  }
}

renderHomePage();
