"use strict";
// No dependencies. All source paths are relative for GitHub Pages project repositories.
const config = window.PORTFOLIO_CONFIG || {};
// Keep All Work concise while allowing category filters to reveal matching archive projects.
const projects = window.PORTFOLIO_PROJECTS || [];
const $ = (selector) => document.querySelector(selector);
const safeText = (value) => String(value ?? "");
const categoryNames = { compositing: "2D Compositing", motion: "Motion Graphics", editing: "Video Editing" };
$("#year").textContent = String(new Date().getFullYear());
$("#brand-name").textContent = config.displayName || "Zeroshi";
$("#hero-greeting").textContent = config.greeting || "Hello, I'm Zeroshi";
$("#hero-role").textContent = config.role || "Motion Graphic Designer";
$("#hero-copy").textContent = config.description || "";
const heroShowreel = $(".hero-showreel");
if (heroShowreel) {
  heroShowreel.defaultMuted = true;
  heroShowreel.muted = true;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    heroShowreel.removeAttribute("autoplay");
    heroShowreel.pause();
  }
}
if (config.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(config.email)) {
  $("#contact-action").href = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(config.email)}`;
  $("#contact-action").target = "_blank";
  $("#contact-action").rel = "noopener noreferrer";
  const contactArrow = document.createElement("span");
  contactArrow.textContent = "↗";
  $("#contact-action").replaceChildren(config.email, contactArrow);
  $("#contact-action").hidden = false;
  $("#contact-placeholder").hidden = true;
}
const grid = $("#project-list");
const cards = [];
projects.forEach((project, index) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "project-card";
  button.dataset.category = safeText(project.category);
  button.dataset.featured = String(index < 9);
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
  const title = document.createElement("h3"); title.textContent = safeText(project.title);
  const detail = document.createElement("p");
  const separator = document.createElement("span"); separator.textContent = "/";
  detail.append(document.createTextNode(categoryNames[project.category] || safeText(project.category) || "Project"), separator, document.createTextNode(safeText(project.year)));
  body.append(title,detail);
  const arrow = document.createElement("span"); arrow.className="arrow";arrow.textContent="↗";
  meta.append(body,arrow);
  button.append(imageBox,meta);
  button.addEventListener("click", () => openProject(project));
  grid.appendChild(button);cards.push(button);
});
const filters=[...document.querySelectorAll(".filter-btn")];
function applyFilter(category){
  let visible=0;
  cards.forEach(card=>{const show=category==="all" ? card.dataset.featured==="true" : card.dataset.category.split(/\s+/).includes(category);card.hidden=!show;if(show) visible++});
  filters.forEach(btn=>{const active=btn.dataset.filter===category;btn.classList.toggle("active",active);btn.setAttribute("aria-pressed",String(active))});
  $("#project-count").textContent = category === "all"
    ? `${visible} selected projects · Full archive available below`
    : `${visible} project${visible===1?"":"s"} · ${categoryNames[category] || category}`;
  $("#empty-projects").hidden=visible!==0;
}
filters.forEach(btn=>btn.addEventListener("click",()=>applyFilter(btn.dataset.filter)));
applyFilter("all");
const modal=$("#project-modal");
function videoFrame(project){
  const wrapper=$("#modal-video");wrapper.replaceChildren();
  const makeFrame=(kindValue,idValue,title,placeholder="")=>{
  const kind=safeText(kindValue).toLowerCase();
  const id=safeText(idValue).trim();
  const valid=(kind==="youtube" && /^[A-Za-z0-9_-]{11}$/.test(id)) ||
    (kind==="vimeo" && /^\d+$/.test(id)) ||
    (kind==="googledrive" && /^[A-Za-z0-9_-]+$/.test(id));
  if(!valid){
    const empty=document.createElement("div");empty.className="video-empty";
    const heading=document.createElement("strong");heading.textContent=placeholder||"Video coming soon";
    const instruction=document.createElement("span");instruction.textContent="Add a real YouTube, Vimeo, or Google Drive videoId to this project in projects.js to display its video here.";
    empty.appendChild(heading);if(!placeholder) empty.appendChild(instruction);return empty;
  }
  const iframe=document.createElement("iframe");
  iframe.title=title;
  
iframe.src = kind === "youtube"
  ? `https://www.youtube.com/embed/${id}?rel=0`
  : kind === "vimeo"
    ? `https://player.vimeo.com/video/${id}`
    : `https://drive.google.com/file/d/${id}/preview`;

  iframe.allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen";
  iframe.allowFullscreen=true;
  iframe.referrerPolicy="strict-origin-when-cross-origin";
  return iframe;
  };
  const hasBreakdown=Boolean(safeText(project.breakdownVideoId).trim());
  wrapper.classList.toggle("has-breakdown",hasBreakdown);
  if(!hasBreakdown){wrapper.appendChild(makeFrame(project.videoType,project.videoId,`Video: ${safeText(project.title)}`,project.videoPlaceholder));return;}
  [["Final Video",project.videoType,project.videoId,project.videoPlaceholder],["Breakdown Video",project.breakdownVideoType,project.breakdownVideoId,""]].forEach(([label,kind,id,placeholder])=>{
    const section=document.createElement("section");section.className="video-section";
    const heading=document.createElement("div");heading.className="video-section-label";heading.textContent=label;
    const frame=document.createElement("div");frame.className="video-section-frame";if(placeholder) frame.classList.add("is-placeholder");
    frame.appendChild(makeFrame(kind,id,`${label}: ${safeText(project.title)}`,placeholder));
    section.append(heading,frame);wrapper.appendChild(section);
  });
}
function openProject(project){
  $("#modal-title").textContent=safeText(project.title);
  $("#modal-description").textContent=safeText(project.description);
  $("#modal-category").textContent=categoryNames[project.category]||safeText(project.category);
  $("#modal-category-detail").textContent=categoryNames[project.category]||safeText(project.category);
  $("#modal-year").textContent=safeText(project.year);
  $("#modal-tools").textContent=safeText(project.tools);
  videoFrame(project);
  modal.showModal();document.body.classList.add("modal-open");
}
function closeProject(){modal.close()}
$("#modal-close").addEventListener("click",closeProject);
$("#modal-return").addEventListener("click",closeProject);
modal.addEventListener("click",event=>{if(event.target===modal) closeProject()});
modal.addEventListener("close",()=>{document.body.classList.remove("modal-open");const video=$("#modal-video");video.replaceChildren();video.classList.remove("has-breakdown")});
const navLinks=[...document.querySelectorAll(".nav-link")];
const sections=navLinks.map(link=>document.querySelector(link.getAttribute("href"))).filter(Boolean);
const setActiveSection=id=>navLinks.forEach(link=>link.classList.toggle("active",link.getAttribute("href")===`#${id}`));
const isPageBottom=()=>window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-3;
if("IntersectionObserver" in window){
 const observer=new IntersectionObserver(entries=>{if(isPageBottom()){setActiveSection("contact");return;}entries.forEach(entry=>{if(entry.isIntersecting)setActiveSection(entry.target.id)})},{rootMargin:"-30% 0px -60% 0px"});
 sections.forEach(section=>observer.observe(section));
}
navLinks.forEach(link=>link.addEventListener("click",()=>setActiveSection(link.getAttribute("href").slice(1))));
const highlightContactAction=()=>{
  const action=$("#contact-action");
  if(!action||action.hidden)return;
  action.classList.remove("contact-action-highlight");
  void action.offsetWidth;
  action.classList.add("contact-action-highlight");
  window.setTimeout(()=>action.classList.remove("contact-action-highlight"),1500);
};
document.querySelectorAll('a[href="#contact"]').forEach(link=>link.addEventListener("click",highlightContactAction));
window.addEventListener("scroll",()=>{if(isPageBottom())setActiveSection("contact")},{passive:true});
requestAnimationFrame(()=>{if(location.hash==="#contact"||isPageBottom())setActiveSection("contact")});
