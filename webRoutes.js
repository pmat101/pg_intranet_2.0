function doGet(e) {
  const page =
    e && e.parameter && e.parameter.page ? e.parameter.page : "index"; // read page from URL. SAFETY: allow only known pages
  const scriptUrl = ScriptApp.getService().getUrl(); // This grabs deployed link automatically
  const template = HtmlService.createTemplateFromFile(page); // returns HTML file named page
  template.scriptUrl = scriptUrl; // We "hand" the URL to the HTML here. If there's shared data, pass it here too- [template.masterData = MASTER_CONFIG]
  return template
    .evaluate()
    .setTitle("PG Intranet")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // lets us embed page inside Google site as iframe
}
/*
     → e.parameter.page reads "?page=" from the URL
     → HtmlService.createHtmlOutputFromFile(page) returns the HTML file named page (e.g BD01A)
     → setXFrameOptionsMode(ALLOWALL) lets us embed the page inside a Google Site iframe
*/
