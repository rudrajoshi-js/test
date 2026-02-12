// ========== SUPABASE ==========
const SUPABASE_URL = "https://dnzafmggkmawnshljyku.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuemFmbWdna21hd25zaGxqeWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMDgxMjYsImV4cCI6MjA4NDY4NDEyNn0.JWcpX3fgJW1kt6KI21Xr-cJRRd2hzxYAO2hptWibMTQ";

if (!window.supabase) {
  alert("Supabase library not loaded. Ensure supabase-js v2 CDN is included before app.js.");
  throw new Error("supabase-js not loaded");
}

const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== CONFIG ==========
const PASSWORDS = { admin: "admin2025", instructor: "instructor2025" };

const AIRTABLE_INVITE_URL =
  "https://airtable.com/appH63nLT8wsF37OE/shrlW2aVa9EJzqQET";

// ========== PARTS ==========
const CATEGORIES = [
  {
    name: "Electronics",
    icon: "⚡",
    parts: [
      { id: "large_hub", name: "Large Hub", expected: 1, image: "Parts_Images/largehub.png" },
      { id: "hub_battery", name: "Hub Battery", expected: 1, image: "Parts_Images/Hubbattery.png" },
      { id: "medium_motor", name: "Medium Motor", expected: 2, image: "Parts_Images/mediummotor.webp" },
      { id: "large_motor", name: "Large Motor", expected: 1, image: "Parts_Images/largemotor.webp" },
      { id: "color_sensor", name: "Color Sensor", expected: 1, image: "Parts_Images/cs.webp" },
      { id: "distance_sensor", name: "Distance Sensor", expected: 1, image: "Parts_Images/distancesensor.webp" },
      { id: "force_sensor", name: "Force Sensor", expected: 1, image: "Parts_Images/forcesensor.webp" },
      { id: "micro_usb", name: "USB Cable", expected: 1, image: "Parts_Images/usbcable.webp" },
    ],
  },
  {
    name: "Beams",
    icon: "🔧",
    parts: [
      { id: "beam_3m", name: "Beam 3M", expected: 6, image: "Parts_Images/Beam3M.png" },
      { id: "beam_5m", name: "Beam 5M", expected: 4, image: "Parts_Images/Beam5M.png" },
      { id: "beam_7m", name: "Beam 7M", expected: 6, image: "Parts_Images/Beam7M.png" },
      { id: "beam_9m", name: "Beam 9M", expected: 4, image: "Parts_Images/Beam9M.png" },
      { id: "beam_11m", name: "Beam 11M", expected: 4, image: "Parts_Images/Beam11M.png" },
      { id: "beam_13m", name: "Beam 13M", expected: 4, image: "Parts_Images/Beam13M.png" },
      { id: "beam_15m", name: "Beam 15M", expected: 6, image: "Parts_Images/Beam15M.png" },
    ],
  },
  {
    name: "Frames",
    icon: "⬜",
    parts: [
      { id: "frame_5x7", name: "Frame 5×7", expected: 2, image: "Parts_Images/Frame5x7.png" },
      { id: "frame_7x11", name: "Frame 7×11", expected: 2, image: "Parts_Images/Frame7x11.png" },
      { id: "frame_11x15", name: "Frame 11×15", expected: 1, image: "Parts_Images/Frame11x15.png" },
    ],
  },
  {
    name: "Connectors",
    icon: "🔩",
    parts: [
      { id: "peg_black", name: "Black Pegs", expected: 72, image: "Parts_Images/BlackPegs.png" },
      { id: "peg_blue", name: "Blue Pegs", expected: 20, image: "Parts_Images/BluePegs.png" },
      { id: "bush", name: "Bush", expected: 10, image: "Parts_Images/Bush.png"  },
    ],
  },
  {
    name: "Wheels & Gears",
    icon: "⚙️",
    parts: [
      { id: "wheel_56", name: "Wheel Ø56", expected: 4, image: "Parts_Images/Wheel056.png" },
      { id: "gear_12", name: "Gear Z12", expected: 2, image: "Parts_Images/Gearz12.png" },
      { id: "gear_20", name: "Gear Z20", expected: 2, image: "Parts_Images/Gearz20.png" },
      { id: "gear_36", name: "Gear Z36", expected: 2, image: "Parts_Images/Gearz36.png" },
    ],
  },
  {
    name: "Miscellaneous",
    icon: "📦",
    parts: [
      { id: "minifig_kate", name: "Kate Minifigure", expected: 1, image: "Parts_Images/Kate.png" },
      { id: "minifig_kyle", name: "Kyle Minifigure", expected: 1, image: "Parts_Images/Kyle.png" },
      { id: "storage_box", name: "Storage Box", expected: 1, image: "Parts_Images/StorageBox.png" },
      { id: "sorting_trays", name: "Sorting Trays", expected: 2, image: "Parts_Images/Tray.png" },
    ],
  },
];
const PARTS = CATEGORIES.flatMap((c) => c.parts);

// ========== STATE ==========
let currentUser = null, // FULL EMAIL
  userRole = null,
  schools = [],
  currentSchool = null,
  currentKit = null;

let currentUserId = null;
let currentUserActive = true;

// key: `${kitId}|${partId}` -> { start, end }
let inventoryData = {},
  pendingChanges = {},
  hasUnsavedChanges = false;

let currentFilter = "all",
  currentSemester = "start",
  editingSchoolId = null,
  editingKitId = null;

// ========== HELPERS ==========
const formatDate = (d) =>
  d
    ? new Date(d + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not set";

const isDeadlinePassed = (d) => (d ? new Date() > new Date(d + "T23:59:59") : false);

const daysUntil = (d) =>
  d ? Math.ceil((new Date(d + "T23:59:59") - new Date()) / 86400000) : null;

const isAdmin = () => userRole === "admin";

const canEditSemester = (sem) =>
  isAdmin() || !isDeadlinePassed(currentSchool?.[sem === "start" ? "startDeadline" : "endDeadline"]);

function invKey(kitId, partId) {
  return `${kitId}|${partId}`;
}

function parseInvKey(key) {
  const [kit_id, part_id] = key.split("|");
  if (!kit_id || !part_id) return null;
  return { kit_id, part_id };
}

function restoreSelection(prevSchoolId, prevKitId) {
  if (prevSchoolId) currentSchool = schools.find((s) => s.id === prevSchoolId) || null;
  if (currentSchool && prevKitId) currentKit = currentSchool.kits.find((k) => k.id === prevKitId) || null;
}

// ========== USERS (ensure row exists, read active) ==========
async function ensureCurrentUserId() {
  currentUserId = null;
  currentUserActive = true;

  if (!currentUser) return null;

  // 1) try select
  {
    const { data, error } = await db
      .from("users")
      .select("user_id,is_active,role")
      .eq("email", currentUser)
      .limit(1);

    if (!error) {
      const row = data?.[0];
      if (row?.user_id) {
        currentUserId = row.user_id;
        currentUserActive = row.is_active ?? true;
        return currentUserId;
      }
    } else {
      console.warn("users select blocked:", error.message);
    }
  }

  // 2) create/upsert if not found
  {
    const { data, error } = await db
      .from("users")
      .upsert({ email: currentUser, role: userRole || "instructor", is_active: true }, { onConflict: "email" })
      .select("user_id,is_active")
      .limit(1);

    if (error) {
      console.warn("users upsert blocked:", error.message);
      return null;
    }

    const row = data?.[0];
    currentUserId = row?.user_id || null;
    currentUserActive = row?.is_active ?? true;
    return currentUserId;
  }
}

// ========== STORAGE (Supabase) ==========
const loadData = async () => {
  // Schools
  let { data: schoolRows, error: sErr } = await db
    .from("schools")
    .select("school_id,user_id,name,start_deadline,end_deadline,created_at")
    .order("created_at", { ascending: true });

  if (sErr) {
    console.error(sErr);
    alert("Load schools failed: " + sErr.message);
    schools = [];
    inventoryData = {};
    return;
  }

 if (userRole === "instructor") {
    const myId = currentUserId;
    schoolRows = myId ? (schoolRows || []).filter((s) => s.user_id === myId) : [];
  }

  // Kits
  const { data: kitRows, error: kErr } = await db
    .from("kits")
    .select("kit_id,school_id,name,created_at")
    .order("created_at", { ascending: true });

  if (kErr) {
    console.error(kErr);
    alert("Load kits failed: " + kErr.message);
    schools = [];
    inventoryData = {};
    return;
  }

  // Part counts
  const { data: partCountRows, error: pcErr } = await db
    .from("part_counts")
    .select("kit_id,part_id,start_actual,end_actual,last_updated_by,last_updated_at");

  if (pcErr) {
    console.error(pcErr);
    alert("Load part counts failed: " + pcErr.message);
    schools = [];
    inventoryData = {};
    return;
  }

  // Build school → kits
  const kitsBySchool = {};
  (kitRows || []).forEach((k) => {
    (kitsBySchool[k.school_id] ||= []).push({
      id: k.kit_id,
      name: k.name || "",
    });
  });

  schools = (schoolRows || []).map((s) => ({
    id: s.school_id,
    name: s.name,
    startDeadline: s.start_deadline,
    endDeadline: s.end_deadline,
    kits: kitsBySchool[s.school_id] || [],
  }));

  // Flatten counts
  inventoryData = {};
  (partCountRows || []).forEach((pc) => {
    inventoryData[invKey(pc.kit_id, pc.part_id)] = {
      start: pc.start_actual ?? "",
      end: pc.end_actual ?? "",
    };
  });

  if (currentSchool && !schools.some((s) => s.id === currentSchool.id)) {
    currentSchool = null;
    currentKit = null;
  }
};

const saveData = () => {};

// ========== AUTH (PASSWORD-ONLY UI) ==========
function logout() {
  if (hasUnsavedChanges && !confirm("Unsaved changes will be lost. Continue?")) return;

  currentUser = userRole = null;
  currentUserId = null;
  currentUserActive = true;

  currentSchool = null;
  currentKit = null;

  localStorage.removeItem("js_user");
  localStorage.removeItem("js_role");

  document.getElementById("email-input").value = "";
  document.getElementById("password-input").value = "";

  showScreen("login-screen");
}

// ========== NAVIGATION ==========
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");

  if (id === "menu-screen") {
    // optional: only works if you add <span id="menu-user-display"></span> in HTML
    const el = document.getElementById("menu-user-display");
    if (el) el.textContent = (currentUser || "").split("@")[0];
  } else if (id === "school-screen") {
    updateRoleBadge();
    renderSchools();
  } else if (id === "kit-screen") {
    currentFilter = "all";
    renderKits();
    updateKitUI();
  } else if (id === "inventory-screen") {
    renderInventory();
    updateInventoryUI();
  }
}

// Optional helper if you want to call it explicitly
function goToMenu() {
  showScreen("menu-screen");
}

// Button 2 action
function openAirtable() {
  // New tab:
  window.open(AIRTABLE_INVITE_URL, "_blank", "noopener,noreferrer");
  // Same tab (if preferred):
  // window.location.href = AIRTABLE_INVITE_URL;
}

function goBack() {
  if (hasUnsavedChanges && !confirm("Unsaved changes will be lost?")) return;
  hasUnsavedChanges = false;
  pendingChanges = {};
  showScreen("kit-screen");
}

function updateRoleBadge() {
  const b = document.getElementById("role-badge-schools");
  b.textContent = isAdmin() ? "Admin" : "Instructor";
  b.className = "role-badge " + userRole;

  document.getElementById("user-display").textContent = (currentUser || "").split("@")[0];

  // ✅ remove/hide Add School button for instructors (and kill click)
  const addBtn = document.getElementById("add-school-btn");
  if (addBtn) {
    if (isAdmin()) {
      addBtn.style.display = "block";
      addBtn.disabled = false;
      addBtn.style.pointerEvents = "auto";
      addBtn.onclick = addBtn.onclick || null;
    } else {
      addBtn.style.display = "none";
      addBtn.disabled = true;
      addBtn.style.pointerEvents = "none";
      addBtn.onclick = (e) => {
        if (e) e.preventDefault();
        return false;
      };
    }
  }

  // Admin-only Manage Instructors button (created once)
  if (isAdmin()) {
    let btn = document.getElementById("manage-instructors-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "manage-instructors-btn";
      btn.className = "btn secondary";
      btn.textContent = "Manage Instructors";
      btn.onclick = manageInstructorsPrompt;

      if (addBtn && addBtn.parentElement) addBtn.parentElement.appendChild(btn);
      else document.body.appendChild(btn);
    }
    btn.style.display = "inline-block";
  } else {
    const btn = document.getElementById("manage-instructors-btn");
    if (btn) btn.style.display = "none";
  }
}

// ========== ADMIN: ACTIVE/INACTIVE ==========
async function setInstructorActiveByEmail(email, isActive) {
  if (!isAdmin()) return;

  email = (email || "").trim().toLowerCase();
  if (!email) return alert("Enter an email");

  const { error } = await db
    .from("users")
    .upsert({ email, role: "instructor", is_active: !!isActive }, { onConflict: "email" });

  if (error) {
    console.error(error);
    alert("Failed to update instructor status: " + error.message);
    return;
  }

  alert(`Instructor ${email} set to ${isActive ? "ACTIVE" : "INACTIVE"}.`);
}

async function manageInstructorsPrompt() {
  if (!isAdmin()) return;

  const email = prompt("Instructor email to update (e.g. name@mystemclub.org):");
  if (!email) return;

  const status = (prompt("Type: active OR inactive") || "").trim().toLowerCase();
  if (status !== "active" && status !== "inactive") {
    alert("Invalid status. Type exactly: active OR inactive");
    return;
  }

  await setInstructorActiveByEmail(email, status === "active");
}

// ========== SCHOOLS ==========
function renderSchools() {
  const list = document.getElementById("school-list"),
    empty = document.getElementById("school-empty");

  if (!schools.length) {
    list.innerHTML = "";
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";
  list.innerHTML = schools
    .map((s) => {
      const stats = getSchoolStats(s);
      let sc = "complete",
        st = "All Complete";
      if (stats.issues > 0) {
        sc = "issues";
        st = stats.issues + " Issues";
      } else if (stats.pending > 0) {
        sc = "pending";
        st = stats.pending + " Pending";
      }

      const ss = isDeadlinePassed(s.startDeadline) ? "expired" : s.startDeadline ? "active" : "pending";
      const es = isDeadlinePassed(s.endDeadline) ? "expired" : s.endDeadline ? "active" : "pending";

      return `<div class="school-card" onclick="selectSchool('${s.id}')">
        <div class="school-info">
          <div class="school-header"><h3>${s.name}</h3>
          ${
            isAdmin()
              ? `<button class="kit-menu" onclick="event.stopPropagation();openEditSchool('${s.id}')">⚙️</button>`
              : ""
          }</div>
          <div class="school-meta">
            <span class="status-dot ${sc}"></span>
            <span>${(s.kits || []).length} Kits • ${st}</span>
          </div>
          <div class="school-deadlines">
            <span><span class="deadline-dot ${ss}"></span> Start: ${formatDate(s.startDeadline)}</span>
            <span><span class="deadline-dot ${es}"></span> End: ${formatDate(s.endDeadline)}</span>
          </div>
        </div>
        <span class="chevron">›</span>
      </div>`;
    })
    .join("");
}

function getSchoolStats(school) {
  let pending = 0,
    issues = 0;
  (school.kits || []).forEach((k) => {
    const s = getKitStatus(school.id, k.id);
    if (s === "pending") pending++;
    else if (s === "issues") issues++;
  });
  return { pending, issues };
}

function filterSchools() {
  const q = document.getElementById("school-search").value.toLowerCase();
  document.querySelectorAll(".school-card").forEach((c) => {
    c.style.display = c.querySelector("h3").textContent.toLowerCase().includes(q) ? "flex" : "none";
  });
}

function selectSchool(id) {
  currentSchool = schools.find((s) => s.id === id);
  document.getElementById("nav-school-name").textContent = currentSchool.name;
  document.getElementById("nav-school-name2").textContent = currentSchool.name;
  showScreen("kit-screen");
}

// ✅ add school (admin only via UI button; inserts user_id = null)
async function addSchool() {
  if (!isAdmin()) return; // hard stop (even if someone calls from console)

  const name = document.getElementById("new-school-name").value.trim();
  if (!name) return alert("Enter school name");

  const newSchool = {
    name,
    user_id: null,
    start_deadline: document.getElementById("new-school-start-deadline").value || null,
    end_deadline: document.getElementById("new-school-end-deadline").value || null,
  };

  const { error } = await db.from("schools").insert(newSchool);

  if (error) {
    console.error(error);
    return alert("Add school failed: " + error.message);
  }

  closeModal("add-school-modal");
  document.getElementById("new-school-name").value = "";
  document.getElementById("new-school-start-deadline").value = "";
  document.getElementById("new-school-end-deadline").value = "";

  await loadData();
  renderSchools();
}

// Add kit to current school
// Add kit to current school
async function addKit() {
  if (!currentSchool) return;

  const name = document.getElementById("new-kit-name").value.trim();

  const newKit = {
    school_id: currentSchool.id,
    name: name || null,
  };

  const { error } = await db.from("kits").insert(newKit);

  if (error) {
    console.error(error);
    return alert("Add kit failed: " + error.message);
  }

  closeModal("add-kit-modal");
  document.getElementById("new-kit-name").value = "";

  // Save current selection
  const prevSchoolId = currentSchool?.id || null;

  // Reload data
  await loadData();

  // Restore selected school
  if (prevSchoolId) {
    currentSchool = schools.find((s) => s.id === prevSchoolId) || null;
  }

  // Re-render
  renderSchools();
  renderKits();
}



// ========== KITS ==========
function updateKitUI() {
  document.getElementById("add-kit-btn").style.display = "block";
  document.getElementById("school-settings-btn").style.display = isAdmin() ? "block" : "none";

  const alert = document.getElementById("kit-deadline-alert");
  let html = "";

  if (!isAdmin()) {
    const sd = daysUntil(currentSchool.startDeadline),
      ed = daysUntil(currentSchool.endDeadline);

    if (sd !== null && sd > 0 && sd <= 3)
      html += `<div class="alert-box warning">⏰ Start deadline in ${sd} day${sd > 1 ? "s" : ""}</div>`;

    if (ed !== null && ed > 0 && ed <= 3)
      html += `<div class="alert-box warning">⏰ End deadline in ${ed} day${ed > 1 ? "s" : ""}</div>`;

    if (isDeadlinePassed(currentSchool.startDeadline) && isDeadlinePassed(currentSchool.endDeadline)) {
      html = '<div class="alert-box danger">🔒 All deadlines passed - View only</div>';
    }
  }

  alert.innerHTML = html;
}

function renderKits() {
  const grid = document.getElementById("kit-grid"),
    empty = document.getElementById("kit-empty"),
    kits = currentSchool.kits || [];

  let pending = 0,
    issues = 0;

  kits.forEach((k) => {
    const s = getKitStatus(currentSchool.id, k.id);
    if (s === "pending") pending++;
    else if (s === "issues") issues++;
  });

  document.getElementById("pending-count").textContent = pending;
  document.getElementById("issues-count").textContent = issues;

  document.querySelectorAll(".filter-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.filter === currentFilter)
  );

  const filtered = kits.filter((k) => currentFilter === "all" || getKitStatus(currentSchool.id, k.id) === currentFilter);

  if (!kits.length) {
    grid.innerHTML = "";
    empty.style.display = "block";
    empty.innerHTML = "<p>No kits yet</p>";
    return;
  }

  if (!filtered.length) {
    grid.innerHTML = "";
    empty.style.display = "block";
    empty.innerHTML = `<p>No ${currentFilter} kits</p>`;
    return;
  }

  empty.style.display = "none";
  grid.innerHTML = filtered
    .map((k) => {
      const idx = kits.indexOf(k) + 1,
        status = getKitStatus(currentSchool.id, k.id),
        miss = getMissing(currentSchool.id, k.id);

      let sh =
        status === "complete"
          ? '<div class="kit-status complete">● Complete</div>'
          : status === "issues"
          ? `<div class="kit-status issues">● ${miss} Missing</div>`
          : '<div class="kit-status pending">● Pending</div>';

      return `<div class="kit-card" onclick="selectKit('${k.id}')">
        <div class="kit-header">
          <span class="kit-name">${k.name || "Kit " + idx}</span>
        </div>
        ${sh}
      </div>`;
    })
    .join("");
}

function getKitStatus(_sid, kid) {
  let endFilled = 0,
    hasIssue = false;

  PARTS.forEach((p) => {
    const d = inventoryData[invKey(kid, p.id)];
    if (d) {
      if (d.end !== undefined && d.end !== "") {
        endFilled++;
        const sv = d.start !== "" && d.start !== undefined ? parseInt(d.start) : p.expected;
        if (parseInt(d.end) < sv) hasIssue = true;
      }
    }
  });

  const total = PARTS.length;
  if (hasIssue) return "issues";
  if (endFilled === total) return "complete";
  return "pending";
}

function getMissing(_sid, kid) {
  let m = 0;

  PARTS.forEach((p) => {
    const d = inventoryData[invKey(kid, p.id)];
    if (d && d.end !== undefined && d.end !== "") {
      const sv = d.start !== "" && d.start !== undefined ? parseInt(d.start) : p.expected;
      if (parseInt(d.end) < sv) m += sv - parseInt(d.end);
    }
  });

  return m;
}

function setFilter(f) {
  currentFilter = f;
  renderKits();
}

function selectKit(id) {
  currentKit = currentSchool.kits.find((k) => k.id === id);
  const idx = currentSchool.kits.indexOf(currentKit) + 1;
  document.getElementById("nav-kit-name").textContent = currentKit.name || "Kit " + idx;
  document.getElementById("inventory-title").textContent = (currentKit.name || "Kit " + idx) + " Inventory";

  hasUnsavedChanges = false;
  pendingChanges = {};
  currentSemester = "start";

  showScreen("inventory-screen");
}

// ========== INVENTORY (rest unchanged from your previous version) ==========
function updateInventoryUI() {
  const canS = canEditSemester("start"),
    canE = canEditSemester("end"),
    canC = currentSemester === "start" ? canS : canE;

  document.getElementById("start-lock").textContent = canS ? "" : " 🔒";
  document.getElementById("end-lock").textContent = canE ? "" : " 🔒";

  document.querySelectorAll(".semester-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.sem === currentSemester);
    t.classList.toggle("locked", t.dataset.sem === "start" ? !canS : !canE);
  });

  const di = document.getElementById("deadline-info"),
    df = currentSemester === "start" ? "startDeadline" : "endDeadline",
    dl = currentSchool[df];

  if (dl) {
    const days = daysUntil(dl);
    if (isDeadlinePassed(dl)) {
      di.style.display = "flex";
      di.className = "deadline-info expired";
      di.innerHTML = `🔒 Deadline passed (${formatDate(dl)})${isAdmin() ? " - Admin override" : ""}`;
    } else if (days <= 3) {
      di.style.display = "flex";
      di.className = "deadline-info";
      di.innerHTML = `⏰ ${days} day${days !== 1 ? "s" : ""} until deadline`;
    } else {
      di.style.display = "flex";
      di.className = "deadline-info active";
      di.innerHTML = `✓ Deadline: ${formatDate(dl)}`;
    }
  } else di.style.display = "none";

  document.getElementById("clear-btn").style.display = canC ? "block" : "none";
  document.getElementById("save-btn").style.display = canC ? "block" : "none";
}

function setSemester(s) {
  currentSemester = s;
  renderInventory();
  updateInventoryUI();
}

function renderInventory() {
  updateSaveStatus();
  const canE = canEditSemester(currentSemester);

  document.getElementById("categories").innerHTML = CATEGORIES
    .map(
      (cat) => `
      <div class="category">
        <div class="category-header" onclick="toggleCategory('${cat.name}')">
          <span class="category-name">${cat.icon} ${cat.name}</span>
          <span class="category-chevron" id="chev-${cat.name}">▼</span>
        </div>
        <div class="category-items" id="cat-${cat.name}" style="display:none;">
          ${cat.parts.map((p) => renderPart(p, canE)).join("")}
        </div>
      </div>`
    )
    .join("");
}

function toggleCategory(name) {
  const content = document.getElementById(`cat-${name}`);
  const chev = document.getElementById(`chev-${name}`);

  if (!content) return;

  const isOpen = content.style.display === "block";

  content.style.display = isOpen ? "none" : "block";

  if (chev) {
    chev.style.transform = isOpen ? "rotate(0deg)" : "rotate(180deg)";
  }
}



function renderPart(part, canE) {
  const key = invKey(currentKit.id, part.id),
    d = inventoryData[key] || {},
    pend = pendingChanges[key] || {};

  const val = pend[currentSemester] !== undefined ? pend[currentSemester] : d[currentSemester] ?? "";
  const num = val === "" ? null : parseInt(val);

  let badge = '<span class="part-badge empty">—</span>';
  if (num !== null) {
    badge =
      num >= part.expected ? '<span class="part-badge ok">OK</span>' : `<span class="part-badge missing">-${part.expected - num}</span>`;
  }

  const cat = CATEGORIES.find((c) => c.parts.includes(part));
  const mDis = !canE || num === null || num <= 0 ? "disabled" : "";
  const pDis = !canE || num >= part.expected ? "disabled" : "";

  return `<div class="part-row" data-part="${part.id}">
    <div class="part-info">
      <div class="part-icon">
        ${part.image ? `<img src="${part.image}" alt="${part.name}" class="part-img">` : (cat?.icon || "📦")}
      </div>
      <div class="part-details">
        <div class="part-name">${part.name}</div>
        <div class="part-expected">Expected: ${part.expected}</div>
      </div>
    </div>

    <div class="part-controls">
      <div class="counter">
        <button class="counter-btn" onclick="adjust('${part.id}',-1)" ${mDis}>−</button>
        <input type="number" min="0" max="${part.expected}"
          class="counter-value"
          value="${num !== null ? num : ""}"
          data-part="${part.id}"
          onchange="handleInput(this)"
          onfocus="this.select()"
          ${!canE ? "disabled" : ""}>

        <button class="counter-btn" onclick="adjust('${part.id}',1)" ${pDis}>+</button>
      </div>
      ${badge}
    </div>
  </div>`;
}

function adjust(pid, delta) {
  if (!canEditSemester(currentSemester)) return;

  const key = invKey(currentKit.id, pid),
    part = PARTS.find((p) => p.id === pid);

  const d = inventoryData[key] || {},
    pend = pendingChanges[key] || {};

  let val = pend[currentSemester] !== undefined ? pend[currentSemester] : d[currentSemester] ?? "";
  val = val === "" ? part.expected : parseInt(val);
  val = Math.max(0, Math.min(val + delta, part.expected));

  if (!pendingChanges[key]) pendingChanges[key] = {};
  pendingChanges[key][currentSemester] = val;

  hasUnsavedChanges = true;
  updateSaveStatus();

  const row = document.querySelector(`[data-part="${pid}"]`);
  if (row) row.outerHTML = renderPart(part, canEditSemester(currentSemester));
}

function handleInput(inp) {
  if (!canEditSemester(currentSemester)) return;

  const pid = inp.dataset.part,
    part = PARTS.find((p) => p.id === pid),
    key = invKey(currentKit.id, pid);

  let val = inp.value.trim();

  if (!pendingChanges[key]) pendingChanges[key] = {};
  pendingChanges[key][currentSemester] = val === "" ? "" : Math.max(0, Math.min(parseInt(val) || 0, part.expected));

  hasUnsavedChanges = true;
  updateSaveStatus();

  const row = document.querySelector(`[data-part="${pid}"]`);
  if (row) row.outerHTML = renderPart(part, canEditSemester(currentSemester));
}

function updateSaveStatus() {
  const st = document.getElementById("save-status"),
    tx = document.getElementById("save-text"),
    canE = canEditSemester(currentSemester);

  if (!canE && !isAdmin()) {
    st.className = "save-status locked";
    tx.textContent = "🔒 Locked";
  } else if (hasUnsavedChanges) {
    st.className = "save-status unsaved";
    tx.textContent = "Unsaved";
  } else {
    st.className = "save-status saved";
    tx.textContent = "Saved";
  }
}

// ✅ Save to part_counts
async function saveChanges() {
  if (!currentKit) return;

  const rows = [];

  for (const key of Object.keys(pendingChanges)) {
    const change = pendingChanges[key];
    if (change[currentSemester] === undefined) continue;

    const parsed = parseInvKey(key);
    if (!parsed) continue;

    const { kit_id, part_id } = parsed;
    if (kit_id !== currentKit.id) continue;

    const val = change[currentSemester];
    const num = val === "" || val === null || val === undefined ? null : Number(val);

    const existing = inventoryData[key] || {};

    const start_actual =
      currentSemester === "start"
        ? num
        : existing.start === "" || existing.start === undefined
        ? null
        : Number(existing.start);

    const end_actual =
      currentSemester === "end"
        ? num
        : existing.end === "" || existing.end === undefined
        ? null
        : Number(existing.end);

    rows.push({
      kit_id,
      part_id,
      start_actual,
      end_actual,
      last_updated_by: currentUserId || null,
      last_updated_at: new Date().toISOString(),
    });
  }

  if (!rows.length) {
    pendingChanges = {};
    hasUnsavedChanges = false;
    updateSaveStatus();
    return;
  }

  const { error } = await db.from("part_counts").upsert(rows, { onConflict: "kit_id,part_id" });

  if (error) {
    console.error(error);
    return alert("Save failed: " + error.message);
  }

  pendingChanges = {};
  hasUnsavedChanges = false;

  const prevSchoolId = currentSchool?.id || null;
  const prevKitId = currentKit?.id || null;

  await loadData();
  restoreSelection(prevSchoolId, prevKitId);

  renderInventory();
  updateInventoryUI();

  document.getElementById("save-text").textContent = "✓ Saved!";
  setTimeout(() => {
    if (!hasUnsavedChanges) updateSaveStatus();
  }, 1500);
}

function confirmClear() {
  openModal("confirm-clear-modal");
}

function clearInventory() {
  PARTS.forEach((p) => {
    const k = invKey(currentKit.id, p.id);
    if (!pendingChanges[k]) pendingChanges[k] = {};
    pendingChanges[k][currentSemester] = "";
  });
  hasUnsavedChanges = true;
  closeModal("confirm-clear-modal");
  renderInventory();
  updateInventoryUI();
}

// ========== MODALS ==========
function openModal(id) {
  document.getElementById(id).classList.add("active");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("active");
}
document.querySelectorAll(".modal-overlay").forEach((m) =>
  m.addEventListener("click", (e) => {
    if (e.target === m) m.classList.remove("active");
  })
);

// ========== INIT ==========
(async () => {
  const savedUser = localStorage.getItem("js_user"),
    savedRole = localStorage.getItem("js_role");

  if (savedUser && savedRole) {
    currentUser = savedUser;
    userRole = savedRole;

    await ensureCurrentUserId();

    // Block inactive instructors
    if (userRole === "instructor" && currentUserActive === false) {
      alert("Your instructor access is inactive. Please contact an admin.");
      logout();
      return;
    }

    await loadData();
    // ✅ go to the new menu after login
    showScreen("menu-screen");
  } else {
    showScreen("login-screen");
  }
})();

document.getElementById("login-form").addEventListener("submit", async function (e) {
  e.preventDefault();

  const email = document.getElementById("email-input").value.trim().toLowerCase(),
    pw = document.getElementById("password-input").value;

  document.getElementById("email-error").classList.remove("show");
  document.getElementById("password-error").classList.remove("show");

  if (!email.endsWith("@mystemclub.org")) {
    document.getElementById("email-error").classList.add("show");
    return;
  }

  if (pw === PASSWORDS.admin) userRole = "admin";
  else if (pw === PASSWORDS.instructor) userRole = "instructor";
  else {
    document.getElementById("password-error").classList.add("show");
    return;
  }

  currentUser = email;

  localStorage.setItem("js_user", currentUser);
  localStorage.setItem("js_role", userRole);

  await ensureCurrentUserId();

  // Block inactive instructors
  if (userRole === "instructor" && currentUserActive === false) {
    alert("Your instructor access is inactive. Please contact an admin.");
    logout();
    return;
  }

  await loadData();
  // ✅ go to the new menu after login
  showScreen("menu-screen");
});

window.addEventListener("beforeunload", (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = "";
  }
});
