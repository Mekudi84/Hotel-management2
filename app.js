"use strict";

const STORAGE_KEY = "basseys-crib.reservations.v1";
const THEME_STORAGE_KEY = "basseys-crib.theme.v2";
const SESSION_KEY = "basseys-crib.authenticated";
const CURRENCY_STORAGE_KEY = "basseys-crib.currency.v1";
const currencies = {
  NGN: { symbol: "₦", locale: "en-NG" },
  USD: { symbol: "$", locale: "en-US" },
  EUR: { symbol: "€", locale: "de-DE" },
  GBP: { symbol: "£", locale: "en-GB" }
};
let currentCurrency = "NGN";
const guestColors = ["#e8eee5", "#f4e8e2", "#e7edf0", "#f1ecde", "#eee7ee", "#e7efec"];
const activityItems = [];
const roomInventory = [];

class HotelManager {
  constructor(reservations) { this.reservations = reservations; this.activeFilter = "all"; this.query = ""; }
  visibleReservations() {
    return this.reservations.filter((reservation) => {
      const matchesFilter = this.activeFilter === "all" || (this.activeFilter === "arriving" && reservation.status === "Arriving") || (this.activeFilter === "in-house" && reservation.status === "Checked in");
      const searchText = `${reservation.name} ${reservation.room} ${reservation.email}`.toLowerCase();
      return matchesFilter && searchText.includes(this.query.toLowerCase());
    });
  }
  addReservation(formValues) {
    const reservation = { id: `guest-${Date.now()}`, name: formValues.name.trim(), email: formValues.email?.trim() || "", room: formValues.room.trim(), nights: Number(formValues.nights), rate: Number(formValues.rate) || 0, currency: currentCurrency, arrival: formValues.arrival, status: "Arriving", initials: formValues.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() };
    this.reservations = [reservation, ...this.reservations];
    if (!roomInventory.some((room) => room.number === reservation.room)) roomInventory.push({ number: reservation.room, status: "Ready" });
    return reservation;
  }
  checkIn(reservationId) {
    const reservation = this.reservations.find((item) => item.id === reservationId);
    if (reservation && reservation.status === "Arriving") reservation.status = "Checked in";
    return reservation;
  }
}

function loadReservations() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const validReservations = Array.isArray(saved) ? saved.filter((reservation) => reservation && typeof reservation.name === "string" && typeof reservation.room === "string" && Number(reservation.nights) > 0 && isValidArrivalDate(reservation.arrival)).map((reservation) => ({ ...reservation, currency: currencies[reservation.currency] ? reservation.currency : "NGN" })) : [];
    if (Array.isArray(saved)) localStorage.setItem(STORAGE_KEY, JSON.stringify(validReservations));
    return validReservations;
  } catch (error) {
    console.warn("Saved reservations could not be loaded.", error);
    return [];
  }
}

function isValidArrivalDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const manager = new HotelManager(loadReservations());
const workspaceScrollObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => entry.target.classList.toggle("visible", entry.isIntersecting));
}, { threshold: 0.6 });
manager.reservations.forEach((reservation) => {
  if (!roomInventory.some((room) => room.number === reservation.room)) roomInventory.push({ number: reservation.room, status: "Ready" });
});
const reservationRows = document.querySelector("#reservation-rows");
const toast = document.querySelector("#toast");
let toastTimeout;

function escapeHTML(value) {
  const element = document.createElement("span");
  element.textContent = String(value);
  return element.innerHTML;
}

function renderReservations(target = reservationRows) {
  const reservations = manager.visibleReservations();
  target.innerHTML = reservations.length ? reservations.map((reservation, index) => {
    const isCheckedIn = reservation.status === "Checked in";
    const statusClass = isCheckedIn ? "status-checked" : "status-arriving";
    const avatarColor = guestColors[index % guestColors.length];
    const arrivalDate = isValidArrivalDate(reservation.arrival) ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${reservation.arrival}T12:00:00`)) : "—";
    return `<tr class="reservation-row"><td><div class="guest-cell"><span class="avatar" style="background:${avatarColor};color:#526458">${escapeHTML(reservation.initials)}</span><span><span class="guest-name">${escapeHTML(reservation.name)}</span><span class="guest-detail">${escapeHTML(reservation.email)}</span></span></div></td><td><span class="room-number">${escapeHTML(reservation.room)}</span></td><td>${escapeHTML(reservation.nights)} night${reservation.nights === 1 ? "" : "s"} <span class="guest-detail">· ${escapeHTML(arrivalDate)}</span></td><td><span class="status-pill ${statusClass}">${escapeHTML(reservation.status)}</span></td><td><button class="row-menu" data-action="${isCheckedIn ? "details" : "check-in"}" data-id="${escapeHTML(reservation.id)}" aria-label="${isCheckedIn ? "View reservation" : "Check in guest"}">${isCheckedIn ? "···" : "↗"}</button></td></tr>`;
  }).join("") : `<tr><td class="empty-state" colspan="5">No records yet. Add a reservation to begin.</td></tr>`;
  document.querySelector("#showing-count").textContent = reservations.length;
  document.querySelector("#table-count").textContent = String(manager.reservations.length).padStart(2, "0");
  document.querySelector("#reservation-count").textContent = String(manager.reservations.length).padStart(2, "0");
  document.querySelector("#all-count").textContent = manager.reservations.length;
  document.querySelector("#arriving-count").textContent = manager.reservations.filter((item) => item.status === "Arriving").length;
  document.querySelector("#in-house-count").textContent = manager.reservations.filter((item) => item.status === "Checked in").length;
  renderMetrics();
  drawArrivalChart();
}

function renderMetrics() {
  const currentDate = new Date();
  const today = new Date(currentDate.getTime() - currentDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const arrivals = manager.reservations.filter((item) => item.arrival === today && item.status === "Arriving").length;
  const checkedIn = manager.reservations.filter((item) => item.status === "Checked in").length;
  const revenue = manager.reservations.filter((item) => item.currency === currentCurrency).reduce((total, item) => total + item.rate * item.nights, 0);
  const occupancy = roomInventory.length ? Math.round((checkedIn / roomInventory.length) * 100) : 0;
  document.querySelector("#occupancy-value").textContent = occupancy;
  document.querySelector("#arrivals-value").textContent = arrivals;
  document.querySelector("#service-value").textContent = roomInventory.filter((room) => room.status === "Cleaning").length;
  document.querySelector("#revenue-value").textContent = formatNumber(revenue);
  document.querySelectorAll("[data-currency-symbol]").forEach((element) => { element.textContent = currencies[currentCurrency].symbol; });
  document.querySelector("#guest-rate-label").textContent = `NIGHTLY RATE (${currencies[currentCurrency].symbol})`;
  document.querySelectorAll(".metrics-grid .metric-card").forEach((card) => { card.querySelector(".metric-change")?.remove(); });
  const notes = [roomInventory.length ? `${checkedIn} of ${roomInventory.length} recorded rooms occupied` : "No room records yet", arrivals ? `${arrivals} arrivals entered for today` : "No arrivals entered for today", "No service tasks entered", revenue ? "Calculated from entered rates and stays" : "No rates entered"];
  document.querySelectorAll(".metrics-grid .metric-note").forEach((note, index) => { note.textContent = notes[index]; });
  document.querySelectorAll(".metric-progress span").forEach((bar, index) => { bar.style.width = `${[occupancy, Math.min(arrivals * 10, 100), 0][index]}%`; });
  document.querySelector(".revenue-sparkline").hidden = true;
  document.querySelector(".hero-side-stat").innerHTML = "<span class=\"stat-ring\"><span>—</span></span><span class=\"stat-label\">GUEST<br />REVIEWS</span><span class=\"stat-review\">No records yet</span>";
  const arrivalCount = manager.reservations.filter((item) => item.status === "Arriving").length;
  document.querySelector(".arrival-summary").innerHTML = `<span><strong>${arrivalCount}</strong> arrivals</span><span class="arrival-summary-divider"></span><span><strong>${manager.reservations.length}</strong> reservations</span>`;
  document.querySelector(".chart-key").textContent = "Reservations by arrival date";
}

function persistReservations() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(manager.reservations)); }
  catch (error) { console.warn("Reservations could not be saved in this browser.", error); showToast("Reservation added for this visit."); }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("visible"), 2600);
}

function setTheme(theme, persist = false) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  const toggle = document.querySelector("#theme-toggle");
  toggle.textContent = isDark ? "☼" : "☾";
  toggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
  toggle.title = `Switch to ${isDark ? "light" : "dark"} mode`;
  if (persist) {
    try { localStorage.setItem(THEME_STORAGE_KEY, isDark ? "dark" : "light"); }
    catch (error) { console.warn("Theme preference could not be saved.", error); }
  }
}

function initializeLogin() {
  let isAuthenticated = false;
  try { isAuthenticated = sessionStorage.getItem(SESSION_KEY) === "true"; }
  catch (error) { console.warn("Session state could not be read.", error); }
  document.querySelector("#login-screen").hidden = isAuthenticated;
  document.querySelector(".app-shell").hidden = !isAuthenticated;
  document.querySelector("#login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    if (!email || !password) {
      document.querySelector("#login-error").textContent = "Enter an email and password to continue.";
      document.querySelector("#login-error").hidden = false;
      return;
    }
    try { sessionStorage.setItem(SESSION_KEY, "true"); }
    catch (error) { console.warn("Session state could not be saved.", error); }
    document.querySelector("#login-error").hidden = true;
    document.querySelector("#login-screen").hidden = true;
    document.querySelector(".app-shell").hidden = false;
    window.dispatchEvent(new Event("resize"));
  });
  document.querySelector("#sign-out-button").addEventListener("click", () => {
    try { sessionStorage.removeItem(SESSION_KEY); }
    catch (error) { console.warn("Session state could not be cleared.", error); }
    document.querySelector("#login-form").reset();
    document.querySelector(".app-shell").hidden = true;
    document.querySelector("#login-screen").hidden = false;
  });
}

function initializeTheme() {
  let savedTheme = "dark";
  try { savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || "dark"; }
  catch (error) { console.warn("Theme preference could not be loaded.", error); }
  setTheme(savedTheme);
}

function formatNumber(amount) {
  return new Intl.NumberFormat(currencies[currentCurrency].locale, { maximumFractionDigits: 2 }).format(amount);
}

function initializeCurrency() {
  try {
    const savedCurrency = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (savedCurrency && currencies[savedCurrency]) currentCurrency = savedCurrency;
  } catch (error) { console.warn("Currency preference could not be loaded.", error); }
  const selector = document.querySelector("#currency-selector");
  const trigger = document.querySelector("#currency-trigger");
  const menu = document.querySelector("#currency-menu");
  selector.value = currentCurrency;
  const syncMenu = () => {
    trigger.setAttribute("aria-label", `Display currency: ${currentCurrency}`);
    menu.querySelectorAll("[data-currency-option]").forEach((option) => {
      option.setAttribute("aria-checked", String(option.dataset.currencyOption === currentCurrency));
    });
  };
  syncMenu();
  const closeMenu = (restoreFocus = false) => {
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    if (restoreFocus) trigger.focus();
  };
  trigger.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    trigger.setAttribute("aria-expanded", String(!menu.hidden));
    if (!menu.hidden) menu.querySelector(`[data-currency-option="${currentCurrency}"]`).focus();
  });
  menu.addEventListener("click", (event) => {
    const option = event.target.closest("[data-currency-option]");
    if (!option) return;
    selector.value = option.dataset.currencyOption;
    selector.dispatchEvent(new Event("change", { bubbles: true }));
    closeMenu(true);
  });
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest("#currency-control")) closeMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menu.hidden) closeMenu(true);
  });
  selector.addEventListener("change", () => {
    if (!currencies[selector.value]) return;
    currentCurrency = selector.value;
    syncMenu();
    try { localStorage.setItem(CURRENCY_STORAGE_KEY, currentCurrency); }
    catch (error) { console.warn("Currency preference could not be saved.", error); }
    renderMetrics();
    if (document.querySelector(".page-body").dataset.view === "analytics") renderWorkspace("analytics", "Analytics");
  });
}

function setActiveView(viewName) {
  const labels = { overview: "Overview", reservations: "Reservations", rooms: "Rooms", guests: "Guests", analytics: "Analytics" };
  document.querySelector("#breadcrumb-current").textContent = labels[viewName] || "Overview";
  document.querySelector(".page-body").dataset.view = viewName;
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === viewName));
  document.querySelector("#sidebar").classList.remove("open");
  const welcomeRow = document.querySelector(".welcome-row");
  welcomeRow.classList.remove("is-active");
  if (viewName === "overview" || viewName === "reservations") requestAnimationFrame(() => welcomeRow.classList.add("is-active"));
  const overviewSections = [".welcome-row", ".metrics-grid", ".hero-strip", ".content-grid", ".page-footer"];
  overviewSections.forEach((selector) => { document.querySelector(selector).hidden = viewName !== "overview"; });
  const workspace = document.querySelector("#workspace-view");
  workspace.hidden = viewName === "overview";
  workspace.dataset.view = viewName;
  if (!workspace.hidden) renderWorkspace(viewName, labels[viewName]);
  document.querySelectorAll(".page-dot").forEach((dot) => dot.classList.toggle("active", dot.dataset.view === viewName));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderPageDots(activeView) {
  const views = ["overview", "reservations", "rooms", "guests", "analytics"];
  return `<nav class="page-nav-dots" aria-label="Page selection">${views.map((view) => `<button class="page-dot${view === activeView ? " active" : ""}" data-view="${view}" aria-label="${view}" title="${view}"></button>`).join("")}</nav>`;
}

function updateDate() {
  const today = new Date();
  const dateText = new Intl.DateTimeFormat("en-GB", { weekday: "long", month: "long", day: "numeric" }).format(today);
  document.querySelector("#today-label").textContent = dateText;
  document.querySelector("#today-heading-date").textContent = dateText.toUpperCase();
}

function renderWorkspace(viewName, title) {
  const workspace = document.querySelector("#workspace-view");
  const subtitles = {
    reservations: "Guest stays and arrival details, in one place.",
    rooms: "Room records linked to the stays you enter.",
    guests: "Guest records created from your reservations.",
    analytics: "A live view calculated only from entered records."
  };
  const heading = `<section class="workspace-heading"><div><span class="panel-eyebrow">BASSEY'S CRIB · HOTEL &amp; RESIDENCE</span><h1>${title}</h1><p>${subtitles[viewName]}</p></div>${viewName === "reservations" ? "<button class=\"primary-button workspace-add-button\" data-open-reservation><span>＋</span> New reservation</button>" : ""}${renderPageDots(viewName)}</section>`;
  let content = "";

  if (viewName === "reservations") {
    content = `<article class="panel workspace-panel scroll-reveal"><div class="panel-header"><div><span class="panel-eyebrow">YOUR FRONT DESK</span><h3>Reservations <span class="heading-count">${manager.reservations.length}</span></h3></div></div><div class="table-tools"><div class="table-tabs" role="tablist" aria-label="Filter reservations"><button class="table-tab active" data-filter="all">All <span>${manager.reservations.length}</span></button><button class="table-tab" data-filter="arriving">Arriving <span>${manager.reservations.filter((item) => item.status === "Arriving").length}</span></button><button class="table-tab" data-filter="in-house">In-house <span>${manager.reservations.filter((item) => item.status === "Checked in").length}</span></button></div></div><div class="table-wrap"><table><thead><tr><th>GUEST</th><th>ROOM</th><th>STAY</th><th>STATUS</th><th></th></tr></thead><tbody id="workspace-reservation-rows"></tbody></table></div><div class="table-footer"><span>Showing <strong>${manager.reservations.length}</strong> reservations</span></div></article>`;
  } else if (viewName === "rooms") {
    const rooms = roomInventory.map((room) => {
      const reservation = manager.reservations.find((guest) => guest.room === room.number);
      return { ...room, status: reservation ? reservation.status === "Checked in" ? "Occupied" : "Reserved" : room.status, guest: reservation?.name || "" };
    });
    const rows = rooms.length ? rooms.map((room) => `<tr><td><span class="room-number">${escapeHTML(room.number)}</span></td><td><span class="guest-name">${escapeHTML(room.guest || "—")}</span></td><td><span class="status-pill ${room.status === "Occupied" ? "status-checked" : "status-arriving"}">${room.status}</span></td></tr>`).join("") : `<tr><td class="empty-state" colspan="3">No room records yet.</td></tr>`;
    content = `<article class="panel workspace-panel scroll-reveal"><div class="panel-header"><div><span class="panel-eyebrow">ROOM RECORDS</span><h3>Rooms <span class="heading-count">${rooms.length}</span></h3></div></div><div class="table-wrap"><table><thead><tr><th>ROOM</th><th>GUEST</th><th>STATUS</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
  } else if (viewName === "guests") {
    const rows = manager.reservations.length ? manager.reservations.map((guest) => `<tr><td><div class="guest-cell"><span class="avatar">${escapeHTML(guest.initials)}</span><span class="guest-name">${escapeHTML(guest.name)}</span></div></td><td><span class="room-number">${escapeHTML(guest.room)}</span></td><td>${guest.nights} night${guest.nights === 1 ? "" : "s"}</td><td><span class="status-pill ${guest.status === "Checked in" ? "status-checked" : "status-arriving"}">${escapeHTML(guest.status)}</span></td></tr>`).join("") : `<tr><td class="empty-state" colspan="4">No guest records yet.</td></tr>`;
    content = `<article class="panel workspace-panel scroll-reveal"><div class="panel-header"><div><span class="panel-eyebrow">GUEST RECORDS</span><h3>Guests <span class="heading-count">${manager.reservations.length}</span></h3></div></div><div class="table-wrap"><table><thead><tr><th>GUEST</th><th>ROOM</th><th>STAY</th><th>STATUS</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
  } else {
    const checkedIn = manager.reservations.filter((item) => item.status === "Checked in").length;
    const occupancy = roomInventory.length ? Math.round((checkedIn / roomInventory.length) * 100) : 0;
    const currentReservations = manager.reservations.filter((item) => item.currency === currentCurrency);
    const revenue = currentReservations.reduce((total, item) => total + item.rate * item.nights, 0);
    const averageRate = currentReservations.length ? Math.round(currentReservations.reduce((total, item) => total + item.rate, 0) / currentReservations.length) : 0;
    const revenueContent = revenue ? `<div class="revenue-bars"><div class="revenue-bar-row"><span>Entered reservation value</span><div class="revenue-bar-track"><i style="width:100%"></i></div><strong>${currencies[currentCurrency].symbol}${formatNumber(revenue)}</strong></div></div>` : `<p class="empty-state">No rate inputs yet in ${currentCurrency}.</p>`;
    content = `<div class="analytics-metrics scroll-reveal"><article class="metric-card"><span class="metric-label">OCCUPANCY</span><div class="metric-number">${occupancy}<small>%</small></div><div class="metric-note">Based on recorded rooms</div></article><article class="metric-card"><span class="metric-label">BOOKED REVENUE</span><div class="metric-number"><small>${currencies[currentCurrency].symbol}</small>${formatNumber(revenue)}</div><div class="metric-note">From ${currentCurrency} reservations</div></article><article class="metric-card"><span class="metric-label">AVERAGE NIGHTLY RATE</span><div class="metric-number"><small>${currencies[currentCurrency].symbol}</small>${formatNumber(averageRate)}</div><div class="metric-note">${currentReservations.length} matching records</div></article></div><article class="panel workspace-panel revenue-breakdown scroll-reveal"><div class="panel-header"><div><span class="panel-eyebrow">${currentCurrency} RESERVATIONS</span><h3>Revenue</h3></div></div>${revenueContent}</article>`;
  }

  workspace.innerHTML = `${heading}<div class="workspace-content">${content}</div>`;
  const pageHeading = workspace.querySelector(".workspace-heading");
  requestAnimationFrame(() => pageHeading.classList.add("is-active"));
  workspace.querySelectorAll(".scroll-reveal").forEach((section) => workspaceScrollObserver.observe(section));
  if (viewName === "reservations") {
    const rows = workspace.querySelector("#workspace-reservation-rows");
    renderReservations(rows);
    workspace.querySelectorAll(".table-tab").forEach((tab) => tab.addEventListener("click", () => {
      manager.activeFilter = tab.dataset.filter;
      workspace.querySelectorAll(".table-tab").forEach((item) => item.classList.toggle("active", item === tab));
      renderReservations(rows);
    }));
    rows.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-action]");
      if (!actionButton) return;
      const guest = manager.checkIn(actionButton.dataset.id);
      if (!guest) return;
      persistReservations();
      renderReservations(rows);
      renderReservations();
      showToast(`${guest.name} has been checked in.`);
    });
    workspace.querySelector("[data-open-reservation]").addEventListener("click", () => document.querySelector("#reservation-dialog").showModal());
  }
  workspace.querySelectorAll(".page-dot").forEach((dot) => dot.addEventListener("click", () => setActiveView(dot.dataset.view)));
}

function handleRoomAction(event) {
  const button = event.target.closest("[data-room]");
  if (!button) return;
  const room = roomInventory.find((item) => item.number === button.dataset.room);
  if (room?.status === "Cleaning") {
    room.status = "Ready";
    renderWorkspace("rooms", "Rooms");
    showToast(`Room ${room.number} is ready for a guest.`);
  } else if (room?.status === "Ready") {
    document.querySelector("#guest-room").value = room.number;
    document.querySelector("#reservation-dialog").showModal();
  } else showToast(`Room ${button.dataset.room} is up to date.`);
}

function renderActivity() {
  document.querySelector("#activity-list").innerHTML = activityItems.length ? activityItems.map(({ icon, tone, title, detail, time }) => `<div class="activity-item"><span class="activity-icon ${tone}">${icon}</span><span class="activity-copy"><strong>${escapeHTML(title)}</strong><small>${escapeHTML(detail)}</small></span><span class="activity-time">${escapeHTML(time)}</span></div>`).join("") : `<div class="empty-state">No activity recorded yet.</div>`;
}

function wireEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setActiveView(button.dataset.view)));
  document.querySelectorAll(".table-tab").forEach((tab) => tab.addEventListener("click", () => {
    document.querySelectorAll(".table-tab").forEach((item) => item.classList.toggle("active", item === tab));
    manager.activeFilter = tab.dataset.filter;
    renderReservations();
  }));
  document.querySelector("#new-reservation-button").addEventListener("click", () => document.querySelector("#reservation-dialog").showModal());
  document.querySelector("#dialog-close").addEventListener("click", () => document.querySelector("#reservation-dialog").close());
  document.querySelector("#reservation-dialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) event.currentTarget.close(); });
  document.querySelector("#reservation-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const formValues = Object.fromEntries(new FormData(form).entries());
    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = true;
    submitButton.innerHTML = "<span>✳</span> Confirming...";
    try {
      await new Promise((resolve) => setTimeout(resolve, 420));
      const reservation = manager.addReservation(formValues);
      persistReservations();
      activityItems.unshift({ icon: "＋", tone: "green", title: `${reservation.name} · reservation added`, detail: `Room ${reservation.room}`, time: "Now" });
      manager.activeFilter = "all";
      document.querySelectorAll(".table-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.filter === "all"));
      renderReservations();
      if (document.querySelector(".page-body").dataset.view === "reservations") renderWorkspace("reservations", "Reservations");
      else if (document.querySelector("#workspace-reservation-rows")) renderReservations(document.querySelector("#workspace-reservation-rows"));
      renderActivity();
      form.reset();
      updateDate();
      document.querySelector("#reservation-dialog").close();
      showToast(`${reservation.name}'s reservation is confirmed.`);
    } catch (error) {
      console.error("Reservation could not be completed.", error);
      showToast("That reservation could not be completed. Please try again.");
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = "<span>＋</span> Confirm reservation";
    }
  });
  reservationRows.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    if (actionButton.dataset.action === "check-in") {
      const guest = manager.checkIn(actionButton.dataset.id);
      persistReservations();
      activityItems.unshift({ icon: "↗", tone: "green", title: `${guest.name} · checked in`, detail: `Room ${guest.room}`, time: "Now" });
      renderReservations();
      renderActivity();
      showToast(`${guest.name} has been checked in.`);
    } else showToast("Reservation details are up to date.");
  });
  const searchField = document.createElement("input");
  searchField.className = "reservation-search-field";
  searchField.type = "search";
  searchField.placeholder = "Guest or room";
  searchField.setAttribute("aria-label", "Search guests or room numbers");
  searchField.hidden = true;
  document.querySelector(".table-tools").insertBefore(searchField, document.querySelector("#table-search-button"));
  searchField.addEventListener("input", () => { manager.query = searchField.value.trim(); renderReservations(); });
  const revealSearch = () => {
    setActiveView("reservations");
    document.querySelector("#reservations-panel").scrollIntoView({ behavior: "smooth", block: "nearest" });
    searchField.hidden = false;
    searchField.focus();
  };
  document.querySelector("#search-trigger").addEventListener("click", revealSearch);
  document.querySelector("#table-search-button").addEventListener("click", () => {
    searchField.hidden = !searchField.hidden;
    if (!searchField.hidden) searchField.focus();
  });
  document.querySelector("#menu-button").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("open"));
  document.querySelector("#notification-button").addEventListener("click", () => showToast("You’re all caught up on house activity."));
  document.querySelector("#theme-toggle").addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(nextTheme, true);
  });
}

function drawArrivalChart() {
  const canvas = document.querySelector("#arrival-chart");
  const context = canvas.getContext("2d");
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.scale(ratio, ratio);
  context.clearRect(0, 0, width, height);
  const bookingsByDate = manager.reservations.reduce((totals, reservation) => {
    totals.set(reservation.arrival, (totals.get(reservation.arrival) || 0) + 1);
    return totals;
  }, new Map());
  const entries = [...bookingsByDate.entries()].sort(([left], [right]) => left.localeCompare(right));
  const labels = document.querySelector(".chart-xlabels");
  labels.innerHTML = entries.slice(-5).map(([date]) => `<span>${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`))}</span>`).join("");
  if (!entries.length) {
    context.fillStyle = "#9ba39d";
    context.font = "9px DM Sans, sans-serif";
    context.textAlign = "center";
    context.fillText("No arrival records yet", width / 2, height / 2);
    return;
  }
  const visibleEntries = entries.slice(-5);
  const maxCount = Math.max(...visibleEntries.map(([, count]) => count), 1);
  const points = visibleEntries.map(([, count], index) => ({
    x: visibleEntries.length === 1 ? width / 2 : 4 + index / (visibleEntries.length - 1) * (width - 8),
    y: height - 6 - count / maxCount * (height - 15)
  }));
  context.beginPath();
  points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y));
  context.strokeStyle = "#668b6b";
  context.lineWidth = 2;
  context.stroke();
  points.forEach((point) => {
    context.beginPath();
    context.arc(point.x, point.y, 3, 0, Math.PI * 2);
    context.fillStyle = "#668b6b";
    context.fill();
  });
}

function createHotelScene() {
  const canvas = document.querySelector("#hotel-canvas");
  if (!window.THREE || !canvas) return;
  const THREE = window.THREE;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
  camera.position.set(0, 2.5, 7.3);
  camera.lookAt(0, 0.6, 0);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene.add(new THREE.AmbientLight(0xf4f5e9, 0.85));
  const keyLight = new THREE.DirectionalLight(0xfff5df, 1.4);
  keyLight.position.set(-3, 5, 5);
  keyLight.castShadow = true;
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x87a897, 0.7);
  rimLight.position.set(3, 3, -3);
  scene.add(rimLight);
  const materials = {
    green: new THREE.MeshStandardMaterial({ color: 0x527d65, roughness: 0.38, metalness: 0.13 }),
    light: new THREE.MeshStandardMaterial({ color: 0xf9f4e8, roughness: 0.5 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc6a365, roughness: 0.34, metalness: 0.68 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x53615a, roughness: 0.42, metalness: 0.48 }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0xc8886e, roughness: 0.48 })
  };
  const icons = new THREE.Group();
  const addBox = (group, material, position, scale) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...scale), material);
    mesh.position.set(...position);
    group.add(mesh);
    return mesh;
  };
  const buildBell = () => {
    const group = new THREE.Group();
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.56, 0.42, 32), materials.gold);
    bell.scale.set(1,1.2,1); bell.position.y = 0.06; group.add(bell);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55,0.55,0.1,32),materials.dark); base.position.y=-0.23; group.add(base);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.12,18,18),materials.gold); knob.position.y=0.37; group.add(knob);
    group.position.set(-2.05,0.77,0.14); group.userData.floatPhase=0; return group;
  };
  const buildSuitcase = () => {
    const group = new THREE.Group();
    addBox(group,materials.green,[0,0,0],[0.75,0.92,0.33]);
    addBox(group,materials.gold,[-0.3,0,0.176],[0.035,0.72,0.026]);
    addBox(group,materials.gold,[0.3,0,0.176],[0.035,0.72,0.026]);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.16,0.034,8,22,Math.PI),materials.gold); handle.position.set(0,0.52,0.02); handle.rotation.z=Math.PI; group.add(handle);
    for (const x of [-0.25,0.25]) { const wheel=new THREE.Mesh(new THREE.CylinderGeometry(0.055,0.055,0.08,14),materials.dark); wheel.rotation.z=Math.PI/2; wheel.position.set(x,-0.49,0.04); group.add(wheel); }
    group.position.set(-0.76,0.76,0.2); group.userData.floatPhase=1.4; return group;
  };
  const buildRoomKey = () => {
    const group = new THREE.Group();
    const fob = new THREE.Mesh(new THREE.BoxGeometry(0.42,0.65,0.12),materials.terracotta); fob.position.y=-0.05; group.add(fob);
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.14,0.026,8,22),materials.gold); loop.position.set(0,0.4,0); group.add(loop);
    const roomNumber = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.08,0.03),materials.gold); roomNumber.position.set(0,0.06,0.07); group.add(roomNumber);
    group.position.set(0.6,0.83,0.26); group.rotation.z=-0.16; group.userData.floatPhase=2.4; return group;
  };
  const buildTray = () => {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(new THREE.CylinderGeometry(0.49,0.46,0.095,32),materials.dark));
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.12,0.36,24),materials.light); cup.position.set(0.1,0.21,0); group.add(cup);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15,0.025,8,24),materials.gold); rim.position.set(0.1,0.39,0); group.add(rim);
    const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.21,0.21,0.026,24),materials.gold); saucer.position.set(0.1,0.055,0); group.add(saucer);
    group.position.set(1.8,0.79,0.15); group.userData.floatPhase=4; return group;
  };
  const items = [buildBell(),buildSuitcase(),buildRoomKey(),buildTray()];
    items.forEach((item)=>{
      item.traverse((part)=>{ if (part.isMesh) { part.castShadow = true; part.receiveShadow = true; } });
      icons.add(item);
    });
  scene.add(icons);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10,5),new THREE.ShadowMaterial({opacity:0.09}));
  floor.rotation.x=-Math.PI/2; floor.position.y=0.1; scene.add(floor);
  let frame;
  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    renderer.setSize(bounds.width,bounds.height,false);
    camera.aspect=bounds.width/bounds.height;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  const clock = new THREE.Clock();
  const animate = () => {
    frame=requestAnimationFrame(animate);
    const time=clock.getElapsedTime();
    items.forEach((item,index)=>{ item.position.y=0.78+Math.sin(time*1.1+item.userData.floatPhase)*0.105; item.rotation.y=Math.sin(time*0.55+item.userData.floatPhase)*0.26; item.rotation.x=Math.sin(time*0.7+index)*0.035; });
    icons.rotation.y=Math.sin(time*0.23)*0.08;
    renderer.render(scene,camera);
  };
  animate();
  window.addEventListener("beforeunload",()=>{ cancelAnimationFrame(frame); observer.disconnect(); renderer.dispose(); },{once:true});
}

function initializeDashboard() {
  initializeLogin();
  initializeTheme();
  initializeCurrency();
  const welcomeRow = document.querySelector(".welcome-row");
  welcomeRow.insertAdjacentHTML("beforeend", renderPageDots("overview"));
  requestAnimationFrame(() => welcomeRow.classList.add("is-active"));
  const workspace = document.createElement("section");
  workspace.id = "workspace-view";
  workspace.hidden = true;
  workspace.addEventListener("click", handleRoomAction);
  document.querySelector(".page-body").append(workspace);
  document.querySelector(".help-line").hidden = true;
  updateDate();
  renderReservations();
  renderActivity();
  document.querySelectorAll(".metrics-grid, .hero-strip, .content-grid").forEach((section) => workspaceScrollObserver.observe(section));
  wireEvents();
  drawArrivalChart();
  createHotelScene();
  window.addEventListener("resize",drawArrivalChart);
}

initializeDashboard();