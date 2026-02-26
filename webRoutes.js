function doGet(e) {
  const page =
    e && e.parameter && e.parameter.page ? e.parameter.page : "index"; // Reads ?page= from the URL (SAFETY: allow only known pages)
  return HtmlService.createTemplateFromFile(page) // Returns the HTML file named page
    .evaluate()
    .setTitle("PG Intranet")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // Lets us embed the page inside Google Sites iframe
}
