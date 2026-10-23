"use strict";

const config = window.PORTFOLIO_CONFIG || {};
// Newest work appears first. Projects from the same year keep their curated order.
const projects = [...(window.PORTFOLIO_PROJECTS || [])].sort(
  (a, b) => (Number(b.year) || 0) - (Number(a.year) || 0)
);
const $ = (selector) => document.querySelector(selector);
const safeText = (value) => String(value ?? "");
const categoryNames = { compositing: "2D Compositing", motion: "Motion Graphics", editing: "Video Editing" };

$("#year").textContent = String(new Date().getFullYear());
$("#brand-name").textContent = config.displayName || "Zeroshi";
const showreel = $(".archive-showreel");
if (showreel) {
  showreel.defaultMuted = true;
  showreel.muted = true;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    showreel.removeAttribute("autoplay");
    showreel.pause();
  }
}

const grid = $("#project-list");
const cards = [];

projects.forEach((project) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "project-card";
  button.dataset.category = safeText(project.category);
  button.setAttribute("aria-label", `View details for ${safeText(project.title)}`);

  const imageBox = document.createElement("div");
  imageBox.className = "project-image";
  const img = document.createElement("img");
  img.src = safeText(project.thumbnail);
  img.alt = `Thumbnail for ${safeText(project.title)}`;
  img.loading = "lazy";
  imageBox.appendChild(img);

  const meta = document.createElement("div");
  meta.className = "project-meta";
  const body = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = safeText(project.title);
  const detail = document.createElement("p");
  const separator = document.createElement("span");
  separator.textContent = "/";
  detail.append(document.createTextNode(categoryNames[project.category] || safeText(project.category) || "Project"), separator, document.createTextNode(safeText(project.year)));
  body.append(title, detail);
  const arrow = document.createElement("span");
  arrow.className = "arrow";
  arrow.textContent = "↗";
  meta.append(body, arrow);
  button.append(imageBox, meta);
  button.addEventListener("click", () => openProject(project));
  grid.appendChild(button);
  cards.push(button);
});

const filters = [...document.querySelectorAll(".filter-btn")];
function applyFilter(category) {
  let visible = 0;
  cards.forEach((card) => {
    const show = category === "all" || card.dataset.category.split(/\s+/).includes(category);
    card.hidden = !show;
    if (show) visible += 1;
  });
  filters.forEach((button) => {
    const active = button.dataset.filter === category;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("#project-count").textContent = `${visible} project${visible === 1 ? "" : "s"} ${category === "all" ? "" : `· ${categoryNames[category] || category}`}`;
  $("#empty-projects").hidden = visible !== 0;
}

filters.forEach((button) => button.addEventListener("click", () => applyFilter(button.dataset.filter)));
applyFilter("all");

const modal = $("#project-modal");
function videoFrame(project) {
  const wrapper = $("#modal-video");
  wrapper.replaceChildren();
  const makeFrame = (kindValue, idValue, title, placeholder = "") => {
  const kind = safeText(kindValue).toLowerCase();
  const id = safeText(idValue).trim();
  const valid = (kind === "youtube" && /^[A-Za-z0-9_-]{11}$/.test(id)) ||
    (kind === "vimeo" && /^\d+$/.test(id)) ||
    (kind === "googledrive" && /^[A-Za-z0-9_-]+$/.test(id));

  if (!valid) {
    const empty = document.createElement("div");
    empty.className = "video-empty";
    const heading = document.createElement("strong");
    heading.textContent = placeholder || "Video coming soon";
    const instruction = document.createElement("span");
    instruction.textContent = "Add a real YouTube, Vimeo, or Google Drive videoId to this project in projects.js to display its video here.";
    empty.appendChild(heading);
    if (!placeholder) empty.appendChild(instruction);
    return empty;
  }

  const iframe = document.createElement("iframe");
  iframe.title = title;
  iframe.src = kind === "youtube"
    ? `https://www.youtube.com/embed/${id}?rel=0`
    : kind === "vimeo"
      ? `https://player.vimeo.com/video/${id}`
      : `https://drive.google.com/file/d/${id}/preview`;
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen";
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  return iframe;
  };

  const hasBreakdown = Boolean(safeText(project.breakdownVideoId).trim());
  wrapper.classList.toggle("has-breakdown", hasBreakdown);
  if (!hasBreakdown) {
    wrapper.appendChild(makeFrame(project.videoType, project.videoId, `Video: ${safeText(project.title)}`, project.videoPlaceholder));
    return;
  }

  [["Final Video", project.videoType, project.videoId, project.videoPlaceholder], ["Breakdown Video", project.breakdownVideoType, project.breakdownVideoId, ""]].forEach(([label, kind, id, placeholder]) => {
    const section = document.createElement("section");
    section.className = "video-section";
    const heading = document.createElement("div");
    heading.className = "video-section-label";
    heading.textContent = label;
    const frame = document.createElement("div");
    frame.className = "video-section-frame";
    if (placeholder) frame.classList.add("is-placeholder");
    frame.appendChild(makeFrame(kind, id, `${label}: ${safeText(project.title)}`, placeholder));
    section.append(heading, frame);
    wrapper.appendChild(section);
  });
}

function openProject(project) {
  $("#modal-title").textContent = safeText(project.title);
  $("#modal-description").textContent = safeText(project.description);
  $("#modal-category").textContent = categoryNames[project.category] || safeText(project.category);
  $("#modal-category-detail").textContent = categoryNames[project.category] || safeText(project.category);
  $("#modal-year").textContent = safeText(project.year);
  $("#modal-tools").textContent = safeText(project.tools);
  videoFrame(project);
  modal.showModal();
  document.body.classList.add("modal-open");
}

function closeProject() {
  modal.close();
}

$("#modal-close").addEventListener("click", closeProject);
$("#modal-return").addEventListener("click", closeProject);
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeProject();
});
modal.addEventListener("close", () => {
  document.body.classList.remove("modal-open");
  const video = $("#modal-video");
  video.replaceChildren();
  video.classList.remove("has-breakdown");
});
