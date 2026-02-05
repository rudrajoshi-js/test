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

// ========== PARTS ==========
const CATEGORIES = [
  {
    name: "Electronics",
    icon: "⚡",
    parts: [
      { id: "large_hub", name: "Large Hub", expected: 1, image: "Parts_Images/45601.png" },
      { id: "hub_battery", name: "Hub Battery", expected: 1, image: "Parts_Images/Hubbattery.webp" },
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
      { id: "beam_3m", name: "Beam 3M", expected: 6 },
      { id: "beam_5m", name: "Beam 5M", expected: 4 },
      { id: "beam_7m", name: "Beam 7M", expected: 6 },
      { id: "beam_9m", name: "Beam 9M", expected: 4 },
      { id: "beam_11m", name: "Beam 11M", expected: 4 },
      { id: "beam_13m", name: "Beam 13M", expected: 4 },
      { id: "beam_15m", name: "Beam 15M", expected: 6 },
    ],
  },
  {
    name: "Frames",
    icon: "⬜",
    parts: [
      { id: "frame_5x7", name: "Frame 5×7", expected: 2 },
      { id: "frame_7x11", name: "Frame 7×11", expected: 2 },
      { id: "frame_11x15", name: "Frame 11×15", expected: 1 },
    ],
  },
  {
    name: "Connectors",
    icon: "🔩",
    parts: [
      { id: "peg_black", name: "Black Pegs", expected: 72 },
      { id: "peg_blue", name: "Blue Pegs", expected: 20 },
      { id: "bush", name: "Bush", expected: 10 },
    ],
  },
  {
    name: "Wheels & Gears",
    icon: "⚙️",
    parts: [
      { id: "wheel_56", name: "Wheel Ø56", expected: 4 },
      { id: "gear_12", name: "Gear Z12", expected: 2 },
      { id: "gear_20", name: "Gear Z20", expected: 2 },
      { id: "gear_36", name: "Gear Z36", expected: 2 },
    ],
  },
  {
    name: "Miscellaneous",
    icon: "📦",
    parts: [
      { id: "minifig_kate", name: "Kate Minifigure", expected: 1 },
      { id: "minifig_kyle", name: "Kyle Minifigure", expected: 1 },
      { id: "storage_box", name: "Storage Box", expected: 1 },
      { id: "sorting_trays", name: "Sorting Trays", expected: 2 },
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
  if (currentSchool && prevKitId)
    currentKit = currentSchool.kits.find((k) => k.id === prevKitId) || null;
}

// ========== STORAGE (Supabase) ==========
const loadData = async () => {
  // Schools (includes user_id so we can filter)
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

  // ✅ DEMO FILTER: instructor only sees their own schools (by schools.user_id)
  if (userRole === "instructor") {
    const { data: userRows, error: uErr } = await db
      .from("users")
      .select("user_id")
      .eq("email", currentUser) // MUST be full email
      .limit(1);

    if (uErr) {
      console.error(uErr);
      alert("Load user failed: " + uErr.message);
      schools = [];
      inventoryData = {};
      return;
    }

    const myUserId = userRows?.[0]?.user_id;
    schoolRows = myUserId ? (schoolRows || []).filter((s) => s.user_id === myUserId) : [];
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

  // Part counts (directly linked to kit_id)
  const { data: partCountRows, error: pcErr } = await db
    .from("part_counts")
    .select("kit_id,part_id,start_actual,end_actual");

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

  // Flatten counts: kitId|partId
  inventoryData = {};
  (partCountRows || []).forEach((pc) => {
    inventoryData[invKey(pc.kit_id, pc.part_id)] = {
      start: pc.start_actual ?? "",
      end: pc.end_actual ?? "",
    };
  });

  // ✅ Safety: if filtered schools removed the currently-selected school, clear selection
  if (currentSchool && !schools.some((s) => s.id === currentSchool.id)) {
    currentSchool = null;
    currentKit = null;
  }
};

// keep this so existing calls don't break
const saveData = () => {};

// ========== AUTH ==========
function logout() {
  if (hasUnsavedChanges && !confirm("Unsaved changes will be lost. Continue?")) return;
  currentUser = userRole = null;
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

  if (id === "school-screen") {
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

  // show username nicely, while currentUser stores full email
  document.getElementById("user-display").textContent = (currentUser || "").split("@")[0];

  document.getElementById("add-school-btn").style.display = isAdmin() ? "block" : "none";
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
      const ss = isDeadlinePassed(s.startDeadline)
        ? "expired"
        : s.startDeadline
        ? "active"
        : "pending";
      const es = isDeadlinePassed(s.endDeadline)
        ? "expired"
        : s.endDeadline
        ? "active"
        : "pending";

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

// ✅ add school
async function addSchool() {
  const name = document.getElementById("new-school-name").value.trim();
  if (!name) return alert("Enter school name");

  const newSchool = {
    name,
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

function openEditSchool(id) {
  editingSchoolId = id;
  const s = schools.find((x) => x.id === id);
  document.getElementById("edit-school-name").value = s.name;
  document.getElementById("edit-school-start-deadline").value = s.startDeadline || "";
  document.getElementById("edit-school-end-deadline").value = s.endDeadline || "";
  openModal("edit-school-modal");
}

async function saveSchoolEdit() {
  const id = editingSchoolId;
  const name = document.getElementById("edit-school-name").value.trim();
  const start_deadline = document.getElementById("edit-school-start-deadline").value || null;
  const end_deadline = document.getElementById("edit-school-end-deadline").value || null;

  const { error } = await db.from("schools").update({ name, start_deadline, end_deadline }).eq("school_id", id);

  if (error) {
    console.error(error);
    return alert("Save failed: " + error.message);
  }

  closeModal("edit-school-modal");

  const prevSchoolId = currentSchool?.id || null;
  const prevKitId = currentKit?.id || null;

  await loadData();
  restoreSelection(prevSchoolId, prevKitId);

  renderSchools();
  if (currentSchool) {
    document.getElementById("nav-school-name").textContent = currentSchool.name;
    document.getElementById("nav-school-name2").textContent = currentSchool.name;
  }
}

async function deleteSchool() {
  if (!confirm("Delete this school and all data?")) return;

  const { error } = await db.from("schools").delete().eq("school_id", editingSchoolId);

  if (error) {
    console.error(error);
    return alert("Delete failed: " + error.message);
  }

  closeModal("edit-school-modal");

  const prevSchoolId = currentSchool?.id || null;
  const prevKitId = currentKit?.id || null;

  await loadData();
  if (prevSchoolId === editingSchoolId) {
    currentSchool = null;
    currentKit = null;
  } else {
    restoreSelection(prevSchoolId, prevKitId);
  }
  renderSchools();
}

function openSchoolSettings() {
  document.getElementById("settings-school-name").value = currentSchool.name;
  document.getElementById("settings-start-deadline").value = currentSchool.startDeadline || "";
  document.getElementById("settings-end-deadline").value = currentSchool.endDeadline || "";
  openModal("school-settings-modal");
}

async function saveSchoolSettings() {
  const id = currentSchool.id;
  const name = document.getElementById("settings-school-name").value.trim() || currentSchool.name;
  const start_deadline = document.getElementById("settings-start-deadline").value || null;
  const end_deadline = document.getElementById("settings-end-deadline").value || null;

  const { error } = await db.from("schools").update({ name, start_deadline, end_deadline }).eq("school_id", id);

  if (error) {
    console.error(error);
    return alert("Save failed: " + error.message);
  }

  closeModal("school-settings-modal");

  const prevSchoolId = currentSchool?.id || null;
  const prevKitId = currentKit?.id || null;

  await loadData();
  restoreSelection(prevSchoolId, prevKitId);

  document.getElementById("nav-school-name").textContent = currentSchool.name;
  document.getElementById("nav-school-name2").textContent = currentSchool.name;

  renderKits();
  updateKitUI();
  renderSchools();
}

async function deleteCurrentSchool() {
  if (!confirm("Delete this school?")) return;

  const id = currentSchool.id;
  const { error } = await db.from("schools").delete().eq("school_id", id);

  if (error) {
    console.error(error);
    return alert("Delete failed: " + error.message);
  }

  closeModal("school-settings-modal");

  currentSchool = null;
  currentKit = null;

  await loadData();
  showScreen("school-screen");
}

// ========== KITS ==========
function updateKitUI() {
  // Hide Add Kit button for instructors
  document.getElementById("add-kit-btn").style.display =
    isAdmin() ? "block" : "none";

  // existing code
  document.getElementById("school-settings-btn").style.display =
    isAdmin() ? "block" : "none";

  const alert = document.getElementById("kit-deadline-alert");
  let html = "";

  if (!isAdmin()) {
    const sd = daysUntil(currentSchool.startDeadline),
      ed = daysUntil(currentSchool.endDeadline);

    if (sd !== null && sd > 0 && sd <= 3)
      html += `<div class="alert-box warning">⏰ Start deadline in ${sd} day${sd > 1 ? "s" : ""}</div>`;

    if (ed !== null && ed > 0 && ed <= 3)
      html += `<div class="alert-box warning">⏰ End deadline in ${ed} day${ed > 1 ? "s" : ""}</div>`;

    if (
      isDeadlinePassed(currentSchool.startDeadline) &&
      isDeadlinePassed(currentSchool.endDeadline)
    ) {
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
          ${
            isAdmin()
              ? `<button class="kit-menu" onclick="event.stopPropagation();openEditKit('${k.id}')">•••</button>`
              : ``
          }
        </div>
        ${sh}
      </div>`;

    })
    .join("");
}

// sid unused; kept for compatibility
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

async function addKit() {
  if (!currentSchool) return alert("Select a school first");

  const name = document.getElementById("new-kit-name").value.trim() || null;

  const { error } = await db.from("kits").insert({
    school_id: currentSchool.id,
    name,
  });

  if (error) {
    console.error(error);
    return alert("Add kit failed: " + error.message);
  }

  closeModal("add-kit-modal");
  document.getElementById("new-kit-name").value = "";

  const prevSchoolId = currentSchool?.id || null;
  await loadData();
  restoreSelection(prevSchoolId, null);

  renderKits();
  updateKitUI();
  renderSchools();
}

function openEditKit(id) {
  editingKitId = id;
  document.getElementById("edit-kit-name").value = currentSchool.kits.find((k) => k.id === id).name || "";
  openModal("edit-kit-modal");
}

async function saveKitEdit() {
  const name = document.getElementById("edit-kit-name").value.trim() || null;
  const kitId = editingKitId;

  const { error } = await db.from("kits").update({ name }).eq("kit_id", kitId);

  if (error) {
    console.error(error);
    return alert("Save failed: " + error.message);
  }

  closeModal("edit-kit-modal");

  const prevSchoolId = currentSchool?.id || null;
  const prevKitId = currentKit?.id || null;

  await loadData();
  restoreSelection(prevSchoolId, prevKitId);

  renderKits();
  renderSchools();
}

async function deleteKit() {
  if (!confirm("Delete this kit?")) return;

  const kitId = editingKitId;
  const { error } = await db.from("kits").delete().eq("kit_id", kitId);

  if (error) {
    console.error(error);
    return alert("Delete failed: " + error.message);
  }

  closeModal("edit-kit-modal");

  const prevSchoolId = currentSchool?.id || null;
  const wasCurrentKit = currentKit?.id === kitId;

  await loadData();
  restoreSelection(prevSchoolId, null);

  if (wasCurrentKit) {
    currentKit = null;
  }

  renderKits();
  renderSchools();
}

// ========== INVENTORY ==========
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
        <div class="category-header" onclick="this.parentElement.classList.toggle('collapsed')">
          <span class="category-name">${cat.icon} ${cat.name}</span>
          <span class="category-chevron">▼</span>
        </div>
        <div class="category-items">
          ${cat.parts.map((p) => renderPart(p, canE)).join("")}
        </div>
      </div>`
    )
    .join("");
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
      num >= part.expected
        ? '<span class="part-badge ok">OK</span>'
        : `<span class="part-badge missing">-${part.expected - num}</span>`;
  }

  const cat = CATEGORIES.find((c) => c.parts.includes(part));
  const mDis = !canE || num === null || num <= 0 ? "disabled" : "";
  const pDis = !canE || num >= part.expected ? "disabled" : "";

  return `<div class="part-row" data-part="${part.id}">
    <div class="part-info">
      <div class="part-icon">
        ${
          part.image
            ? `<img src="${part.image}" alt="${part.name}" class="part-img">`
            : (cat?.icon || "📦")
        }
      </div>
      <div class="part-details">
        <div class="part-name">${part.name}</div>
        <div class="part-expected">Expected: ${part.expected}</div>
      </div>
    </div>

    <div class="part-controls">
      <div class="counter">
        <button class="counter-btn" onclick="adjust('${part.id}',-1)" ${mDis}>−</button>
        <input type="text" class="counter-value" value="${num !== null ? num : ""}" data-part="${part.id}"
          onchange="handleInput(this)" onfocus="this.select()" inputmode="numeric" ${!canE ? "disabled" : ""}>
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
  pendingChanges[key][currentSemester] =
    val === "" ? "" : Math.max(0, Math.min(parseInt(val) || 0, part.expected));

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

// ✅ Save to part_counts (directly using kit_id)
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
    });
  }

  if (!rows.length) {
    pendingChanges = {};
    hasUnsavedChanges = false;
    updateSaveStatus();
    return;
  }

  const { error } = await db.from("part_counts").upsert(rows, {
    onConflict: "kit_id,part_id",
  });

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
// NOTE: we DO NOT call loadData() before we restore saved user/role.
// Calling it too early would load unfiltered data (userRole/currentUser are null).
(async () => {
  const savedUser = localStorage.getItem("js_user"),
    savedRole = localStorage.getItem("js_role");

  if (savedUser && savedRole) {
    currentUser = savedUser; // full email
    userRole = savedRole;

    await loadData();
    showScreen("school-screen");
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

  // ✅ store FULL email now (so it matches users.email)
  currentUser = email;

  localStorage.setItem("js_user", currentUser);
  localStorage.setItem("js_role", userRole);

  await loadData();
  showScreen("school-screen");
});

window.addEventListener("beforeunload", (e) => {
  if (hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = "";
  }
});
