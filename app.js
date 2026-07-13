const { createClient } = supabase;
const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let wines = [];
let currentUser = null;
let activeCategory = "Todos";

const grid = document.getElementById("wineGrid");
const searchInput = document.getElementById("searchInput");
const filterChips = document.getElementById("filterChips");
const staffToggle = document.getElementById("staffToggle");

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
  });
}

function renderCard(w) {
  const isOut = w.stock <= 0;
  const lowStock = !isOut && w.stock <= 2;
  const priceStr = Number(w.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  // Estoque (esgotado, últimas unidades, contagem) só aparece pra quem está logado
  const showStockHints = !!currentUser;

  return `
  <div class="wine-card">
    <div class="bottle-wrap">
      ${w.image_url ? `<img src="${w.image_url}" alt="${w.name}">` : bottlePlaceholderSVG()}
      ${showStockHints && isOut ? `<div class="stamp">Esgotado</div>` : ""}
      ${showStockHints && lowStock ? `<div class="low-stock-badge">Últimas unidades</div>` : ""}
    </div>
    <h3 class="wine-name">${w.name}${w.vintage ? " " + w.vintage : ""}</h3>
    <p class="wine-vintage">${w.category}</p>
    <p class="wine-desc">${w.description || ""}</p>
    <p class="wine-price">R$ ${priceStr}</p>
    <div class="staff-controls ${currentUser ? "visible" : ""}">
      <span class="stock-count">Estoque: ${w.stock}</span>
      <button class="edit-btn" data-id="${w.id}">Editar</button>
      <button class="sell-btn" data-id="${w.id}" ${isOut ? "disabled" : ""}>
        ${isOut ? "Sem estoque" : "Marcar venda"}
      </button>
    </div>
  </div>`;
}

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
  } else {
    staffToggle.textContent = "Área da equipe";
    staffToggle.classList.remove("logged-in");
  }
  renderGrid();
}

staffToggle.addEventListener("click", async () => {
  if (currentUser) {
    await client.auth.signOut();
    currentUser = null;
    updateStaffUI();
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

// ---------- Edit wine ----------

const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const editError = document.getElementById("editError");
const editImagePreview = document.getElementById("editImagePreview");
const editImageFile = document.getElementById("editImageFile");
let editTargetWine = null;

function openEditModal(wine) {
  editTargetWine = wine;
  document.getElementById("editName").value = wine.name;
  document.getElementById("editVintage").value = wine.vintage || "";
  document.getElementById("editCategory").value = wine.category;
  document.getElementById("editDescription").value = wine.description || "";
  document.getElementById("editPrice").value = wine.price;
  document.getElementById("editStock").value = wine.stock;
  editImageFile.value = "";
  if (wine.image_url) {
    editImagePreview.src = wine.image_url;
    editImagePreview.classList.remove("hidden");
  } else {
    editImagePreview.classList.add("hidden");
  }
  editError.classList.add("hidden");
  editModal.classList.remove("hidden");
}

document.getElementById("closeEdit").addEventListener("click", () => {
  editModal.classList.add("hidden");
});

editImageFile.addEventListener("change", () => {
  const file = editImageFile.files[0];
  if (!file) return;
  editImagePreview.src = URL.createObjectURL(file);
  editImagePreview.classList.remove("hidden");
});

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editTargetWine || !currentUser) return;

  const submitBtn = editForm.querySelector(".primary-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Salvando...";

  try {
    let imageUrl = editTargetWine.image_url;
    const file = editImageFile.files[0];

    if (file) {
      const ext = file.name.split(".").pop();
      const path = `${editTargetWine.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await client
        .storage
        .from("wine-photos")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicData } = client
        .storage
        .from("wine-photos")
        .getPublicUrl(path);
      imageUrl = publicData.publicUrl;
    }

    const updates = {
      name: document.getElementById("editName").value.trim(),
      vintage: document.getElementById("editVintage").value.trim() || null,
      category: document.getElementById("editCategory").value.trim(),
      description: document.getElementById("editDescription").value.trim(),
      price: parseFloat(document.getElementById("editPrice").value),
      stock: parseInt(document.getElementById("editStock").value, 10),
      image_url: imageUrl,
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
    showToast("Vinho atualizado com sucesso!");
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

// ---------- Realtime sync (opcional, mantém estoque atualizado entre os 3 usuários) ----------
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
