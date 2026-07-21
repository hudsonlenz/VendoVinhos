const { createClient } = supabase;
const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- Tema claro/escuro ----------
const THEME_STORAGE_KEY = "vendovinhos-theme";
const themeToggle = document.getElementById("themeToggle");
const iconSun = document.getElementById("iconSun");
const iconMoon = document.getElementById("iconMoon");

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  iconSun.classList.toggle("hidden", theme === "dark");
  iconMoon.classList.toggle("hidden", theme !== "dark");
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved || (prefersDark ? "dark" : "light"));
}

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  applyTheme(current === "dark" ? "light" : "dark");
});

initTheme();

let wines = [];
let currentUser = null;
let activeCategory = "Todos";

const grid = document.getElementById("wineGrid");
const searchInput = document.getElementById("searchInput");
const filterChips = document.getElementById("filterChips");
const staffToggle = document.getElementById("staffToggle");
const addWineBtn = document.getElementById("addWineBtn");

const loginModal = document.getElementById("loginModal");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

const saleModal = document.getElementById("saleModal");
const saleForm = document.getElementById("saleForm");
const saleWineName = document.getElementById("saleWineName");
const saleQty = document.getElementById("saleQty");
const saleStockHint = document.getElementById("saleStockHint");
let saleTargetWine = null;

const toast = document.getElementById("toast");

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 2600);
}

function bottlePlaceholderSVG() {
  return `<svg class="bottle-icon" viewBox="0 0 64 120" xmlns="http://www.w3.org/2000/svg">
    <path d="M26 4h12v14c0 4 6 6 6 14v78a6 6 0 0 1-6 6H26a6 6 0 0 1-6-6V32c0-8 6-10 6-14V4z"
      fill="none" stroke="#1b1815" stroke-width="2"/>
    <rect x="22" y="46" width="20" height="30" fill="#1b1815" opacity="0.12"/>
  </svg>`;
}

function flutePlaceholderSVG() {
  return `<svg class="bottle-icon" viewBox="0 0 64 120" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 8h24l-4.5 38c-1 9-7.5 15.5-9.5 15.5s-8.5-6.5-9.5-15.5z"
      fill="none" stroke="#1b1815" stroke-width="2" stroke-linejoin="round"/>
    <line x1="32" y1="61.5" x2="32" y2="100" stroke="#1b1815" stroke-width="2"/>
    <line x1="32" y1="100" x2="32" y2="108" stroke="#1b1815" stroke-width="2"/>
    <line x1="17" y1="108" x2="47" y2="108" stroke="#1b1815" stroke-width="2"/>
    <circle cx="27" cy="20" r="1.3" fill="#1b1815" opacity="0.3"/>
    <circle cx="36" cy="26" r="1" fill="#1b1815" opacity="0.3"/>
    <circle cx="29" cy="33" r="1" fill="#1b1815" opacity="0.3"/>
    <circle cx="33" cy="42" r="0.9" fill="#1b1815" opacity="0.3"/>
  </svg>`;
}

function isEspumante(w) {
  return (w.category || "").toLowerCase().includes("espumante");
}

// Retorna a lista de fotos de um vinho, com fallback pra coluna antiga image_url
function getImages(w) {
  if (Array.isArray(w.image_urls) && w.image_urls.length > 0) return w.image_urls;
  if (w.image_url) return [w.image_url];
  return [];
}

async function loadWines() {
  const { data, error } = await client
    .from("wines")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    grid.innerHTML = `<p class="loading">Não foi possível carregar o catálogo. Verifique as credenciais em config.js.</p>`;
    console.error(error);
    return;
  }
  wines = data;
  buildFilterChips();
  renderGrid();
}

function buildFilterChips() {
  const categories = ["Todos", ...new Set(wines.map(w => w.category))];
  filterChips.innerHTML = categories
    .map(c => `<button class="chip ${c === activeCategory ? "active" : ""}" data-cat="${c}">${c}</button>`)
    .join("");
  filterChips.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      activeCategory = chip.dataset.cat;
      buildFilterChips();
      renderGrid();
    });
  });
}

function renderGrid() {
  const term = searchInput.value.trim().toLowerCase();
  const filtered = wines.filter(w => {
    const matchesCat = activeCategory === "Todos" || w.category === activeCategory;
    const matchesTerm = !term ||
      w.name.toLowerCase().includes(term) ||
      (w.vintage || "").toLowerCase().includes(term) ||
      w.category.toLowerCase().includes(term);
    return matchesCat && matchesTerm;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `<p class="loading">Nenhum vinho encontrado.</p>`;
    return;
  }

  grid.innerHTML = filtered.map(renderCard).join("");

  filtered.forEach(w => {
    const sellBtn = grid.querySelector(`.sell-btn[data-id="${w.id}"]`);
    if (sellBtn) sellBtn.addEventListener("click", () => openSaleModal(w));
    const editBtn = grid.querySelector(`.edit-btn[data-id="${w.id}"]`);
    if (editBtn) editBtn.addEventListener("click", () => openEditModal(w));
    const visBtn = grid.querySelector(`.visibility-btn[data-id="${w.id}"]`);
    if (visBtn) visBtn.addEventListener("click", () => toggleHidden(w));

    const cardEl = grid.querySelector(`.wine-card[data-id="${w.id}"]`);
    if (cardEl) {
      cardEl.addEventListener("click", (e) => {
        if (e.target.closest(".staff-controls")) return;
        openLightbox(w);
      });
    }
  });
}

async function toggleHidden(wine) {
  const newHidden = !wine.hidden;
  const { error } = await client
    .from("wines")
    .update({ hidden: newHidden })
    .eq("id", wine.id);

  if (error) {
    showToast("Erro ao atualizar visibilidade.");
    console.error(error);
    return;
  }
  wine.hidden = newHidden;
  renderGrid();
  showToast(newHidden ? "Anúncio escondido do público." : "Anúncio visível para o público novamente.");
}

function renderCard(w) {
  const isOut = w.stock <= 0;
  const lowStock = !isOut && w.stock <= 2;
  const priceStr = Number(w.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  const showStockHints = !!currentUser; // estoque só aparece pra quem está logado
  const images = getImages(w);

  const eyeOpenSVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const eyeOffSVG = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a20.3 20.3 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 7 11 7a20.3 20.3 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

  return `
  <div class="wine-card" data-id="${w.id}">
    <div class="bottle-wrap">
      ${images.length > 0
        ? `<img src="${images[0]}" alt="${w.name}" class="bottle-photo" data-id="${w.id}">`
        : (isEspumante(w) ? flutePlaceholderSVG() : bottlePlaceholderSVG())}
      ${isEspumante(w) ? `<div class="espumante-badge">✨ Espumante</div>` : ""}
      ${images.length > 1 ? `<div class="photo-count-badge">${images.length} fotos</div>` : ""}
      ${showStockHints && isOut ? `<div class="stamp">Esgotado</div>` : ""}
      ${showStockHints && lowStock ? `<div class="low-stock-badge">Últimas unidades</div>` : ""}
      ${showStockHints && w.hidden ? `<div class="hidden-badge">Oculto do público</div>` : ""}
    </div>
    <h3 class="wine-name">${w.name}${w.vintage ? " " + w.vintage : ""}</h3>
    <p class="wine-vintage">${w.category}</p>
    <p class="wine-desc">${w.description || ""}</p>
    <p class="wine-price">R$ ${priceStr}</p>
    <div class="staff-controls ${currentUser ? "visible" : ""}">
      <span class="stock-count">Estoque: ${w.stock}</span>
      <button class="icon-btn visibility-btn" data-id="${w.id}" title="${w.hidden ? "Reexibir para o público" : "Esconder do público"}">
        ${w.hidden ? eyeOffSVG : eyeOpenSVG}
      </button>
      <button class="edit-btn" data-id="${w.id}">Editar</button>
      <button class="sell-btn" data-id="${w.id}" ${isOut ? "disabled" : ""}>
        ${isOut ? "Sem estoque" : "Marcar venda"}
      </button>
    </div>
  </div>`;
}

// ---------- Lightbox (com detalhes do vinho e navegação) ----------
const lightbox = document.getElementById("lightbox");
const lightboxContent = document.getElementById("lightboxContent");
const lightboxImg = document.getElementById("lightboxImg");
const lightboxStage = document.getElementById("lightboxStage");
const lightboxCounter = document.getElementById("lightboxCounter");
const lightboxPrev = document.getElementById("lightboxPrev");
const lightboxNext = document.getElementById("lightboxNext");
const lightboxThumbs = document.getElementById("lightboxThumbs");
const lightboxCategory = document.getElementById("lightboxCategory");
const lightboxName = document.getElementById("lightboxName");
const lightboxDesc = document.getElementById("lightboxDesc");
const lightboxPrice = document.getElementById("lightboxPrice");
const lightboxWhatsapp = document.getElementById("lightboxWhatsapp");
const WHATSAPP_NUMBER = "5547999674451"; // (47) 99967-4451, com código do país

let galleryImages = [];
let galleryIndex = 0;

// Estado do zoom
let zoomScale = 1;
let panX = 0;
let panY = 0;

function openLightbox(wine) {
  const images = getImages(wine);
  if (images.length === 0) return;

  galleryImages = images;
  galleryIndex = 0;
  lightboxImg.alt = wine.name;
  resetZoom();
  updateLightboxImage();
  buildLightboxThumbs();

  lightboxCategory.textContent = wine.category || "";
  lightboxName.textContent = `${wine.name}${wine.vintage ? " " + wine.vintage : ""}`;
  lightboxDesc.textContent = wine.description || "";
  const priceStr = Number(wine.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  lightboxPrice.textContent = `R$ ${priceStr}`;

  const wineLabel = `${wine.name}${wine.vintage ? " " + wine.vintage : ""}`;
  const message = `Olá! Tenho interesse no vinho: ${wineLabel} (R$ ${priceStr}). Ainda está disponível?`;
  lightboxWhatsapp.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

  lightbox.classList.remove("hidden");
  lightboxContent.classList.remove("anim-in");
  void lightboxContent.offsetWidth; // força reflow pra reiniciar a animação
  lightboxContent.classList.add("anim-in");
}

function buildLightboxThumbs() {
  const multi = galleryImages.length > 1;
  lightboxThumbs.classList.toggle("hidden", !multi);
  if (!multi) {
    lightboxThumbs.innerHTML = "";
    return;
  }
  lightboxThumbs.innerHTML = galleryImages
    .map((src, i) => `<img src="${src}" class="lightbox-thumb" data-index="${i}">`)
    .join("");
}

lightboxThumbs.addEventListener("click", (e) => {
  const thumb = e.target.closest(".lightbox-thumb");
  if (!thumb) return;
  galleryIndex = parseInt(thumb.dataset.index, 10);
  resetZoom();
  updateLightboxImage();
});

function updateLightboxImage() {
  lightboxImg.src = galleryImages[galleryIndex];
  applyImgTransform();
  const multi = galleryImages.length > 1;
  lightboxCounter.textContent = multi ? `${galleryIndex + 1} / ${galleryImages.length}` : "";
  lightboxPrev.classList.toggle("hidden", !multi);
  lightboxNext.classList.toggle("hidden", !multi);

  lightboxThumbs.querySelectorAll(".lightbox-thumb").forEach((thumb, i) => {
    thumb.classList.toggle("active", i === galleryIndex);
  });
}

function nextImage() {
  galleryIndex = (galleryIndex + 1) % galleryImages.length;
  resetZoom();
  updateLightboxImage();
}

function prevImage() {
  galleryIndex = (galleryIndex - 1 + galleryImages.length) % galleryImages.length;
  resetZoom();
  updateLightboxImage();
}

function closeLightbox() {
  lightbox.classList.add("hidden");
  lightboxImg.src = "";
  galleryImages = [];
}

document.getElementById("closeLightbox").addEventListener("click", closeLightbox);
lightboxNext.addEventListener("click", nextImage);
lightboxPrev.addEventListener("click", prevImage);
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener("keydown", (e) => {
  if (lightbox.classList.contains("hidden")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowRight" && zoomScale === 1) nextImage();
  if (e.key === "ArrowLeft" && zoomScale === 1) prevImage();
});

// ---------- Zoom ----------
const ZOOM_LEVEL = 2.4;
const ZOOM_MIN = 1;
const ZOOM_MAX = 3.5;

function applyImgTransform() {
  lightboxImg.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
  lightboxImg.classList.toggle("is-zoomed", zoomScale > 1);
}

function resetZoom() {
  zoomScale = 1;
  panX = 0;
  panY = 0;
  lightboxImg.style.transition = "none";
  applyImgTransform();
}

function clampPan() {
  // Limita o quanto dá pra arrastar a imagem ampliada pra fora da área visível
  const stageRect = lightboxStage.getBoundingClientRect();
  const maxX = (stageRect.width * (zoomScale - 1)) / 2;
  const maxY = (stageRect.height * (zoomScale - 1)) / 2;
  panX = Math.max(-maxX, Math.min(maxX, panX));
  panY = Math.max(-maxY, Math.min(maxY, panY));
}

// Clique alterna entre normal e ampliado; roda do mouse ajusta o zoom aos poucos
lightboxImg.addEventListener("wheel", (e) => {
  e.preventDefault();
  const delta = e.deltaY < 0 ? 0.25 : -0.25;
  zoomScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomScale + delta));
  if (zoomScale === 1) { panX = 0; panY = 0; }
  clampPan();
  lightboxImg.style.transition = "transform 0.12s ease";
  applyImgTransform();
}, { passive: false });

// Arrastar (mouse e touch): navega entre fotos quando normal, arrasta a imagem quando ampliada
let dragStartX = null;
let dragStartY = null;
let dragging = false;
let dragMoved = false;
let panStartX = 0;
let panStartY = 0;

lightboxStage.addEventListener("pointerdown", (e) => {
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  panStartX = panX;
  panStartY = panY;
  dragging = true;
  dragMoved = false;
  lightboxImg.style.transition = "none";
  if (zoomScale > 1) lightboxImg.classList.add("is-panning");
  // Mantém o arrasto funcionando mesmo se o mouse sair da área da foto
  lightboxStage.setPointerCapture(e.pointerId);
});

lightboxStage.addEventListener("pointermove", (e) => {
  if (!dragging || dragStartX === null) return;
  const deltaX = e.clientX - dragStartX;
  const deltaY = e.clientY - dragStartY;
  if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) dragMoved = true;

  if (zoomScale > 1) {
    panX = panStartX + deltaX;
    panY = panStartY + deltaY;
    clampPan();
    applyImgTransform();
  } else if (galleryImages.length > 1) {
    lightboxImg.style.transform = `translateX(${deltaX}px)`;
  }
});

function endDrag(e) {
  if (!dragging || dragStartX === null) return;
  const deltaX = e.clientX - dragStartX;
  dragging = false;
  dragStartX = null;
  lightboxImg.classList.remove("is-panning");
  lightboxImg.style.transition = "transform 0.2s ease";
  if (e.pointerId !== undefined && lightboxStage.hasPointerCapture(e.pointerId)) {
    lightboxStage.releasePointerCapture(e.pointerId);
  }

  if (zoomScale > 1) {
    return; // já ficou na posição arrastada, sem trocar de foto
  }

  if (galleryImages.length > 1 && Math.abs(deltaX) > 60) {
    deltaX < 0 ? nextImage() : prevImage();
  } else {
    lightboxImg.style.transform = "translateX(0px)";
  }
}

lightboxStage.addEventListener("pointerup", endDrag);
lightboxStage.addEventListener("pointerleave", (e) => {
  if (dragging) endDrag(e);
});

// Clique simples (sem arrastar) alterna o zoom
lightboxStage.addEventListener("click", () => {
  if (dragMoved) return;
  lightboxImg.style.transition = "transform 0.2s ease";
  if (zoomScale > 1) {
    resetZoom();
  } else {
    zoomScale = ZOOM_LEVEL;
    applyImgTransform();
  }
});

// ---------- Auth ----------

async function refreshSession() {
  const { data } = await client.auth.getSession();
  currentUser = data.session?.user || null;
  updateStaffUI();
}

function updateStaffUI() {
  if (currentUser) {
    staffToggle.textContent = currentUser.email.split("@")[0] + " · Sair";
    staffToggle.classList.add("logged-in");
    addWineBtn.classList.remove("hidden");
  } else {
    staffToggle.textContent = "Área da equipe";
    staffToggle.classList.remove("logged-in");
    addWineBtn.classList.add("hidden");
  }
  renderGrid();
}

staffToggle.addEventListener("click", async () => {
  if (currentUser) {
    await client.auth.signOut();
    currentUser = null;
    updateStaffUI();
    await loadWines();
    showToast("Sessão encerrada.");
  } else {
    loginModal.classList.remove("hidden");
  }
});

document.getElementById("closeLogin").addEventListener("click", () => {
  loginModal.classList.add("hidden");
  loginError.classList.add("hidden");
});

const togglePasswordBtn = document.getElementById("togglePassword");
const loginPasswordInput = document.getElementById("loginPassword");
togglePasswordBtn.addEventListener("click", () => {
  const isHidden = loginPasswordInput.type === "password";
  loginPasswordInput.type = isHidden ? "text" : "password";
  togglePasswordBtn.textContent = isHidden ? "Esconder" : "Mostrar";
  togglePasswordBtn.setAttribute("aria-label", isHidden ? "Esconder senha" : "Mostrar senha");
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    loginError.textContent = "E-mail ou senha incorretos.";
    loginError.classList.remove("hidden");
    return;
  }
  currentUser = data.user;
  loginModal.classList.add("hidden");
  loginError.classList.add("hidden");
  loginForm.reset();
  updateStaffUI();
  await loadWines();
  showToast(`Bem-vindo(a), ${currentUser.email.split("@")[0]}!`);
});

// ---------- Sales ----------

function openSaleModal(wine) {
  saleTargetWine = wine;
  saleWineName.textContent = `Registrar venda — ${wine.name}`;
  saleStockHint.textContent = `Estoque atual: ${wine.stock} unidade(s)`;
  saleQty.max = wine.stock;
  saleQty.value = 1;
  saleModal.classList.remove("hidden");
}

document.getElementById("closeSale").addEventListener("click", () => {
  saleModal.classList.add("hidden");
});

saleForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!saleTargetWine || !currentUser) return;

  const qty = parseInt(saleQty.value, 10);
  if (qty < 1 || qty > saleTargetWine.stock) {
    showToast("Quantidade inválida.");
    return;
  }

  const newStock = saleTargetWine.stock - qty;

  const { error: updateError } = await client
    .from("wines")
    .update({ stock: newStock })
    .eq("id", saleTargetWine.id);

  if (updateError) {
    showToast("Erro ao atualizar estoque.");
    console.error(updateError);
    return;
  }

  await client.from("sales").insert({
    wine_id: saleTargetWine.id,
    wine_name: saleTargetWine.name,
    sold_by: currentUser.email,
  });

  saleTargetWine.stock = newStock;
  saleModal.classList.add("hidden");
  renderGrid();
  showToast(`Venda registrada: ${qty}x ${saleTargetWine.name}`);
});

// ---------- Edit wine (com múltiplas fotos) ----------

const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const editError = document.getElementById("editError");
const editImageFile = document.getElementById("editImageFile");
const editImageStatus = document.getElementById("editImageStatus");
const editPhotosGrid = document.getElementById("editPhotosGrid");
let editTargetWine = null;

// Cada item: { type: 'existing', url } ou { type: 'new', file, previewUrl, contentType, ext }
let editPhotos = [];

function isHeic(file) {
  const name = file.name.toLowerCase();
  return name.endsWith(".heic") || name.endsWith(".heif") ||
    file.type === "image/heic" || file.type === "image/heif";
}

function renderEditPhotos() {
  editPhotosGrid.innerHTML = editPhotos.map((p, i) => `
    <div class="edit-photo-thumb">
      <img src="${p.type === "existing" ? p.url : p.previewUrl}">
      <button type="button" class="remove-photo-btn" data-index="${i}" aria-label="Remover foto">&times;</button>
    </div>
  `).join("");

  editPhotosGrid.querySelectorAll(".remove-photo-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      editPhotos.splice(parseInt(btn.dataset.index, 10), 1);
      renderEditPhotos();
    });
  });
}

function openEditModal(wine) {
  editTargetWine = wine || null;
  editPhotos = wine ? getImages(wine).map(url => ({ type: "existing", url })) : [];

  document.getElementById("editModalTitle").textContent = wine ? "Editar vinho" : "Adicionar vinho";
  document.getElementById("editModalSub").textContent = wine
    ? "Altere as informações e/ou a foto do anúncio."
    : "Preencha os dados do novo vinho.";

  document.getElementById("editName").value = wine ? wine.name : "";
  document.getElementById("editVintage").value = wine ? (wine.vintage || "") : "";
  document.getElementById("editCategory").value = wine ? wine.category : "";
  document.getElementById("editDescription").value = wine ? (wine.description || "") : "";
  document.getElementById("editPrice").value = wine ? wine.price : "";
  document.getElementById("editStock").value = wine ? wine.stock : 1;
  editImageFile.value = "";
  editImageStatus.textContent = "";
  editError.classList.add("hidden");
  renderEditPhotos();
  editModal.classList.remove("hidden");
}

document.getElementById("closeEdit").addEventListener("click", () => {
  editModal.classList.add("hidden");
});

addWineBtn.addEventListener("click", () => openEditModal(null));

editImageFile.addEventListener("change", async () => {
  const files = Array.from(editImageFile.files);
  if (files.length === 0) return;

  const hasHeic = files.some(isHeic);
  if (hasHeic) editImageStatus.textContent = "Convertendo fotos (formato iPhone)...";

  for (const file of files) {
    if (isHeic(file)) {
      try {
        const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
        const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
        editPhotos.push({
          type: "new",
          file: jpegBlob,
          previewUrl: URL.createObjectURL(jpegBlob),
          contentType: "image/jpeg",
          ext: "jpg",
        });
      } catch (err) {
        console.error(err);
        editImageStatus.textContent = "Não foi possível converter uma das fotos. Tente exportar como JPEG.";
      }
    } else {
      editPhotos.push({
        type: "new",
        file,
        previewUrl: URL.createObjectURL(file),
        contentType: file.type,
        ext: file.name.split(".").pop(),
      });
    }
  }

  if (!hasHeic || editImageStatus.textContent.startsWith("Convertendo")) {
    editImageStatus.textContent = "";
  }
  editImageFile.value = "";
  renderEditPhotos();
});

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const submitBtn = editForm.querySelector(".primary-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Salvando...";

  const isNew = !editTargetWine;

  try {
    const baseFields = {
      name: document.getElementById("editName").value.trim(),
      vintage: document.getElementById("editVintage").value.trim() || null,
      category: document.getElementById("editCategory").value.trim(),
      description: document.getElementById("editDescription").value.trim(),
      price: parseFloat(document.getElementById("editPrice").value),
      stock: parseInt(document.getElementById("editStock").value, 10),
    };

    // Vinho novo: cria a linha primeiro pra ter um ID (necessário pro caminho das fotos)
    if (isNew) {
      const nextSortOrder = wines.reduce((max, w) => Math.max(max, w.sort_order || 0), 0) + 1;
      const { data, error: insertError } = await client
        .from("wines")
        .insert({ ...baseFields, image_urls: [], sort_order: nextSortOrder })
        .select()
        .single();

      if (insertError) throw insertError;
      editTargetWine = data;
      wines.push(data);
    }

    const imageUrls = [];
    for (const photo of editPhotos) {
      if (photo.type === "existing") {
        imageUrls.push(photo.url);
        continue;
      }
      const path = `${editTargetWine.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${photo.ext}`;
      const { error: uploadError } = await client
        .storage
        .from("wine-photos")
        .upload(path, photo.file, { upsert: true, contentType: photo.contentType });

      if (uploadError) throw uploadError;

      const { data: publicData } = client.storage.from("wine-photos").getPublicUrl(path);
      imageUrls.push(publicData.publicUrl);
    }

    const updates = {
      ...baseFields,
      image_urls: imageUrls,
      image_url: imageUrls[0] || null,
    };

    const { error: updateError } = await client
      .from("wines")
      .update(updates)
      .eq("id", editTargetWine.id);

    if (updateError) throw updateError;

    Object.assign(editTargetWine, updates);
    editModal.classList.add("hidden");
    buildFilterChips();
    renderGrid();
    showToast(isNew ? "Vinho adicionado ao catálogo!" : "Vinho atualizado com sucesso!");
  } catch (err) {
    console.error(err);
    editError.textContent = "Erro ao salvar. Confira os campos e tente de novo.";
    editError.classList.remove("hidden");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Salvar alterações";
  }
});

// ---------- Search ----------
searchInput.addEventListener("input", renderGrid);

// ---------- Cursor personalizado ----------
const cursorDot = document.querySelector(".cursor-dot");
const CURSOR_HOVER_SELECTOR =
  "button, a, .chip, .bottle-photo, .wine-card, .staff-btn, .sell-btn, .edit-btn, " +
  ".primary-btn, .modal-close, .lightbox-nav, .lightbox-close, " +
  ".remove-photo-btn, .toggle-password, .theme-toggle";

if (cursorDot && window.matchMedia("(hover: hover)").matches) {
  document.addEventListener("mousemove", (e) => {
    cursorDot.style.left = `${e.clientX}px`;
    cursorDot.style.top = `${e.clientY}px`;
  });

  document.addEventListener("mouseover", (e) => {
    if (e.target.closest(CURSOR_HOVER_SELECTOR)) {
      document.body.classList.add("cursor-hovering");
    }
  });

  document.addEventListener("mouseout", (e) => {
    if (e.target.closest(CURSOR_HOVER_SELECTOR)) {
      document.body.classList.remove("cursor-hovering");
    }
  });
}

// ---------- Realtime sync (mantém estoque e fotos atualizados entre os 3 usuários) ----------
client
  .channel("wines-changes")
  .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wines" }, (payload) => {
    const idx = wines.findIndex(w => w.id === payload.new.id);
    if (idx !== -1) {
      wines[idx] = { ...wines[idx], ...payload.new };
      renderGrid();
    }
  })
  .subscribe();

// ---------- Init ----------
refreshSession().then(loadWines);
