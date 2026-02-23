
const SUPABASE_URL = window.TASK_TRACKER_SUPABASE_URL || "https://cnfrvxwrovpyiktakuok.supabase.co";
const SUPABASE_ANON_KEY = window.TASK_TRACKER_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuZnJ2eHdyb3ZweWlrdGFrdW9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NzY2MzQsImV4cCI6MjA4NzM1MjYzNH0.D-TJRiiOfhWw0Kohd0zWVYDaATyTVB2T5_XCYj5QMBU";
const DEFAULT_WEEKLY_TARGET = 7;
const LEGACY_KEY_PREFIX = "tasks_";

let supabaseClient = null;
let currentAuthUser = null;
let currentProfile = null;
let viewingUserId = null;
let currentView = "day";
let editingTaskId = null;
let tasksCache = [];
let userProfiles = [];

const path = window.location.pathname;
const isDashboardPage = path.includes("dashboard.html");

function byId(id) {
    return document.getElementById(id);
}

function hasValidSupabaseConfig() {
    const missingUrl = !SUPABASE_URL || SUPABASE_URL.includes("YOUR_PROJECT");
    const missingKey = !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY");
    return !missingUrl && !missingKey;
}

function createSupabaseClient() {
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
        return null;
    }
    if (!hasValidSupabaseConfig()) {
        return null;
    }
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function showToast(message, type = "info") {
    const container = byId("toastContainer");
    if (!container) {
        return;
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 3400);
}

function showSetupError(message) {
    if (isDashboardPage) {
        const target = byId("tasksContainer");
        if (target) {
            target.innerHTML = `
                <div class="empty-state">
                    <h3>Setup Required</h3>
                    <p>${message}</p>
                </div>
            `;
        }
    } else {
        const errorMessage = byId("errorMessage");
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.classList.remove("hidden");
        }
    }
}

function setLoadingState(isLoading) {
    const skeleton = byId("taskSkeleton");
    const tasksContainer = byId("tasksContainer");
    const addTaskBtn = byId("addTaskBtn");

    if (skeleton && tasksContainer) {
        skeleton.classList.toggle("hidden", !isLoading);
        tasksContainer.classList.toggle("hidden", isLoading);
    }

    if (addTaskBtn) {
        addTaskBtn.disabled = isLoading;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    supabaseClient = createSupabaseClient();

    if (isDashboardPage) {
        initializeDashboard();
    } else {
        initializeLogin();
    }
});

async function initializeLogin() {
    const loginForm = byId("loginForm");
    if (!loginForm) {
        return;
    }

    if (!supabaseClient) {
        showSetupError("Supabase keys are missing. Add TASK_TRACKER_SUPABASE_URL and TASK_TRACKER_SUPABASE_ANON_KEY in app.js or global window config.");
    }

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const emailInput = byId("email");
        const passwordInput = byId("password");
        const errorMessage = byId("errorMessage");
        const submitBtn = loginForm.querySelector("button[type='submit']");

        if (!emailInput || !passwordInput || !submitBtn) {
            return;
        }

        if (!supabaseClient) {
            showSetupError("Supabase client is not configured.");
            return;
        }

        const email = emailInput.value.trim().toLowerCase();
        const password = passwordInput.value;

        errorMessage.classList.add("hidden");
        submitBtn.disabled = true;
        submitBtn.textContent = "Signing In...";

        const { error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        submitBtn.disabled = false;
        submitBtn.textContent = "Sign In";

        if (error) {
            errorMessage.textContent = error.message || "Invalid credentials";
            errorMessage.classList.remove("hidden");
            showToast("Login failed. Check app credentials.", "error");
            return;
        }

        showToast("Login successful.", "success");
        window.location.href = "dashboard.html";
    });
}

async function initializeDashboard() {
    if (!supabaseClient) {
        showSetupError("Supabase is not configured. Update URL and anon key before using dashboard.");
        return;
    }

    const {
        data: { user },
        error: authError
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
        window.location.href = "index.html";
        return;
    }

    currentAuthUser = user;
    setupDashboardListeners();

    const currentUserBadge = byId("currentUser");
    if (currentUserBadge) {
        currentUserBadge.textContent = currentAuthUser.email || "Signed in";
    }

    try {
        currentProfile = await fetchProfileById(currentAuthUser.id);
    } catch (error) {
        showSetupError(
            `Profile record not found for this account (${currentAuthUser.email || "unknown email"}). Add this auth user id to public.profiles: ${currentAuthUser.id}`
        );
        showToast("Profile lookup failed.", "error");
        ["addTaskBtn", "dayViewBtn", "weekViewBtn", "exportBtn", "importBtn"].forEach((id) => {
            const button = byId(id);
            if (button) {
                button.disabled = true;
            }
        });
        byId("masterControls")?.classList.add("hidden");
        return;
    }

    viewingUserId = currentProfile.id;

    if (currentUserBadge) {
        currentUserBadge.textContent = `${currentProfile.username} (${currentProfile.role})`;
    }

    if (currentProfile.role === "admin") {
        const masterControls = byId("masterControls");
        if (masterControls) {
            masterControls.classList.remove("hidden");
        }
        await loadUserProfiles();
        if (!userProfiles.some((profile) => profile.id === viewingUserId)) {
            viewingUserId = currentProfile.id;
        }
        populateViewUserOptions();
    }

    renderMigrationBanner();
    await refreshDashboardData();
}

function setupDashboardListeners() {
    byId("logoutBtn")?.addEventListener("click", logout);
    byId("addTaskBtn")?.addEventListener("click", () => openTaskModal());
    byId("closeModal")?.addEventListener("click", closeTaskModal);
    byId("cancelBtn")?.addEventListener("click", closeTaskModal);
    byId("taskForm")?.addEventListener("submit", saveTask);
    byId("dayViewBtn")?.addEventListener("click", () => switchView("day"));
    byId("weekViewBtn")?.addEventListener("click", () => switchView("week"));
    byId("exportBtn")?.addEventListener("click", exportData);
    byId("importBtn")?.addEventListener("click", () => byId("importFile")?.click());
    byId("importFile")?.addEventListener("change", importData);

    byId("taskModal")?.addEventListener("click", (event) => {
        if (event.target.id === "taskModal") {
            closeTaskModal();
        }
    });

    byId("taskType")?.addEventListener("change", (event) => {
        setTargetGroupVisibility(event.target.value === "weekly");
    });

    byId("viewUser")?.addEventListener("change", async (event) => {
        viewingUserId = event.target.value;
        await refreshDashboardData();
    });
}
async function fetchProfileById(profileId) {
    const { data, error } = await supabaseClient
        .from("profiles")
        .select("id,username,display_name,role")
        .eq("id", profileId)
        .single();

    if (error || !data) {
        throw new Error(error?.message || "Profile not found");
    }

    return data;
}

async function loadUserProfiles() {
    const { data, error } = await supabaseClient
        .from("profiles")
        .select("id,username,display_name,role")
        .order("username", { ascending: true });

    if (error) {
        showToast("Could not load user list for admin view.", "error");
        return;
    }

    userProfiles = data || [];
}

function populateViewUserOptions() {
    const select = byId("viewUser");
    if (!select) {
        return;
    }

    select.innerHTML = "";

    const rows = userProfiles.length > 0 ? userProfiles : [currentProfile];
    rows.forEach((profile) => {
        const option = document.createElement("option");
        option.value = profile.id;
        option.textContent = profile.display_name
            ? `${profile.display_name} (${profile.username})`
            : profile.username;
        select.appendChild(option);
    });

    if (rows.some((profile) => profile.id === viewingUserId)) {
        select.value = viewingUserId;
    }
}

async function refreshDashboardData() {
    setLoadingState(true);

    try {
        tasksCache = await fetchTasks(viewingUserId);
        renderStats();
        renderTasks();
        renderSummary();
    } catch (error) {
        showToast(error.message || "Failed to load tasks", "error");
        tasksCache = [];
        renderStats();
        renderTasks();
        renderSummary();
    } finally {
        setLoadingState(false);
    }
}

async function fetchTasks(userId) {
    if (!userId) {
        return [];
    }

    const { data, error } = await supabaseClient
        .from("tasks")
        .select("id,user_id,name,type,description,target,completions,created_at,updated_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

    if (error) {
        throw new Error(error.message || "Task fetch failed");
    }

    return (data || []).map((task) => ({
        ...task,
        description: task.description || "",
        completions: task.completions && typeof task.completions === "object" ? task.completions : {}
    }));
}

function setTargetGroupVisibility(show) {
    const targetGroup = byId("targetGroup");
    if (!targetGroup) {
        return;
    }
    targetGroup.classList.toggle("hidden", !show);
}

function openTaskModal(taskId = null) {
    const modal = byId("taskModal");
    const modalTitle = byId("modalTitle");
    const form = byId("taskForm");

    if (!modal || !modalTitle || !form) {
        return;
    }

    form.reset();
    editingTaskId = taskId;
    setTargetGroupVisibility(false);

    if (taskId) {
        modalTitle.textContent = "Edit Task";
        const task = tasksCache.find((item) => item.id === taskId);

        if (task) {
            byId("taskName").value = task.name;
            byId("taskType").value = task.type;
            byId("taskDescription").value = task.description || "";
            if (task.type === "weekly") {
                setTargetGroupVisibility(true);
                byId("targetCount").value = task.target || DEFAULT_WEEKLY_TARGET;
            }
        }
    } else {
        modalTitle.textContent = "Add New Task";
    }

    modal.classList.remove("hidden");
}

function closeTaskModal() {
    byId("taskModal")?.classList.add("hidden");
    editingTaskId = null;
}

async function saveTask(event) {
    event.preventDefault();

    const name = byId("taskName")?.value.trim();
    const type = byId("taskType")?.value;
    const description = byId("taskDescription")?.value.trim() || "";
    const targetCount = Number.parseInt(byId("targetCount")?.value, 10) || DEFAULT_WEEKLY_TARGET;

    if (!name) {
        showToast("Task name is required.", "error");
        return;
    }

    const payload = {
        name,
        type,
        description,
        target: type === "weekly" ? targetCount : null,
        updated_at: new Date().toISOString()
    };

    let error = null;

    if (editingTaskId) {
        const response = await supabaseClient
            .from("tasks")
            .update(payload)
            .eq("id", editingTaskId);
        error = response.error;
    } else {
        const response = await supabaseClient.from("tasks").insert({
            ...payload,
            user_id: viewingUserId,
            completions: {},
            created_at: new Date().toISOString()
        });
        error = response.error;
    }

    if (error) {
        showToast(error.message || "Could not save task", "error");
        return;
    }

    const wasEditing = Boolean(editingTaskId);
    closeTaskModal();
    await refreshDashboardData();
    showToast(wasEditing ? "Task updated." : "Task added.", "success");
}

async function deleteTask(taskId) {
    if (!window.confirm("Delete this task?")) {
        return;
    }

    const { error } = await supabaseClient.from("tasks").delete().eq("id", taskId);

    if (error) {
        showToast(error.message || "Delete failed", "error");
        return;
    }

    await refreshDashboardData();
    showToast("Task deleted.", "success");
}

async function toggleTaskCompletion(taskId, date) {
    const task = tasksCache.find((item) => item.id === taskId);
    if (!task) {
        return;
    }

    const previousCompletions = { ...(task.completions || {}) };
    const nextCompletions = { ...previousCompletions };

    if (nextCompletions[date]) {
        delete nextCompletions[date];
    } else {
        nextCompletions[date] = true;
    }

    task.completions = nextCompletions;
    renderStats();
    renderTasks();
    renderSummary();

    const { error } = await supabaseClient
        .from("tasks")
        .update({ completions: nextCompletions, updated_at: new Date().toISOString() })
        .eq("id", taskId);

    if (error) {
        task.completions = previousCompletions;
        renderStats();
        renderTasks();
        renderSummary();
        showToast("Could not save completion status.", "error");
    }
}

function switchView(view) {
    currentView = view;

    byId("dayViewBtn")?.classList.toggle("active", view === "day");
    byId("weekViewBtn")?.classList.toggle("active", view === "week");

    renderStats();
    renderTasks();
    renderSummary();
}

function updateDateDisplay() {
    const dateElement = byId("currentDate");
    if (!dateElement) {
        return;
    }

    const today = new Date();

    if (currentView === "day") {
        dateElement.textContent = today.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });
        return;
    }

    const start = getStartOfWeek(today);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    dateElement.textContent = `Week of ${start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
    })} - ${end.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    })}`;
}

function getStartOfWeek(date) {
    const copy = new Date(date);
    const day = copy.getDay();
    copy.setDate(copy.getDate() - day);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function getDateString(date) {
    return date.toISOString().split("T")[0];
}

function getDayName(date) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
}
function renderStats() {
    const container = byId("statsGrid");
    if (!container) {
        return;
    }

    const today = getDateString(new Date());
    const weekStart = getStartOfWeek(new Date());

    const totalTasks = tasksCache.length;
    const completedToday = tasksCache.filter((task) => task.completions && task.completions[today]).length;

    let weeklyProgressSum = 0;
    let weeklyCount = 0;

    tasksCache.forEach((task) => {
        if (task.type !== "weekly") {
            return;
        }

        weeklyCount += 1;
        let completedInWeek = 0;

        for (let index = 0; index < 7; index += 1) {
            const day = new Date(weekStart);
            day.setDate(day.getDate() + index);
            const dayString = getDateString(day);
            if (task.completions && task.completions[dayString]) {
                completedInWeek += 1;
            }
        }

        const target = task.target || DEFAULT_WEEKLY_TARGET;
        weeklyProgressSum += (completedInWeek / target) * 100;
    });

    const weeklyProgress = weeklyCount > 0 ? Math.round(weeklyProgressSum / weeklyCount) : 0;
    const todayRate = totalTasks > 0 ? Math.round((completedToday / totalTasks) * 100) : 0;

    container.innerHTML = `
        <article class="stat-card glass-card">
            <h3>Total Tasks</h3>
            <div class="stat-value">${totalTasks}</div>
            <p class="stat-description">Active goals being tracked</p>
        </article>
        <article class="stat-card glass-card">
            <h3>Done Today</h3>
            <div class="stat-value">${completedToday}</div>
            <p class="stat-description">${todayRate}% completion for today</p>
        </article>
        <article class="stat-card warning glass-card">
            <h3>Weekly Progress</h3>
            <div class="stat-value">${weeklyProgress}%</div>
            <p class="stat-description">Average weekly goal progress</p>
        </article>
    `;
}

function renderSummary() {
    const summaryGrid = byId("summaryGrid");
    if (!summaryGrid) {
        return;
    }

    const weekStart = getStartOfWeek(new Date());

    let totalCompletions = 0;
    let possibleCompletions = 0;
    let currentStreak = 0;

    tasksCache.forEach((task) => {
        if (task.type === "daily") {
            for (let index = 0; index < 7; index += 1) {
                const day = new Date(weekStart);
                day.setDate(day.getDate() + index);
                const dayString = getDateString(day);
                possibleCompletions += 1;
                if (task.completions && task.completions[dayString]) {
                    totalCompletions += 1;
                }
            }
            return;
        }

        const target = task.target || DEFAULT_WEEKLY_TARGET;
        possibleCompletions += target;
        for (let index = 0; index < 7; index += 1) {
            const day = new Date(weekStart);
            day.setDate(day.getDate() + index);
            const dayString = getDateString(day);
            if (task.completions && task.completions[dayString]) {
                totalCompletions += 1;
            }
        }
    });

    for (let index = 0; index < 30; index += 1) {
        const day = new Date();
        day.setDate(day.getDate() - index);
        const dayString = getDateString(day);
        const completedAny = tasksCache.some((task) => task.completions && task.completions[dayString]);

        if (completedAny) {
            currentStreak += 1;
        } else if (index > 0) {
            break;
        }
    }

    const completionRate = possibleCompletions > 0 ? Math.round((totalCompletions / possibleCompletions) * 100) : 0;

    summaryGrid.innerHTML = `
        <div class="summary-card">
            <div class="summary-card-value">${totalCompletions}</div>
            <div class="summary-card-label">Tasks Completed</div>
        </div>
        <div class="summary-card">
            <div class="summary-card-value">${completionRate}%</div>
            <div class="summary-card-label">Completion Rate</div>
        </div>
        <div class="summary-card">
            <div class="summary-card-value">${currentStreak}</div>
            <div class="summary-card-label">Current Streak</div>
        </div>
        <div class="summary-card">
            <div class="summary-card-value">${tasksCache.length}</div>
            <div class="summary-card-label">Active Goals</div>
        </div>
    `;
}

function renderTasks() {
    updateDateDisplay();

    const container = byId("tasksContainer");
    if (!container) {
        return;
    }

    if (tasksCache.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No tasks yet</h3>
                <p>Add your first task to begin tracking.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = tasksCache.map((task) => renderTaskCard(task)).join("");

    container.querySelectorAll(".task-checkbox").forEach((checkbox) => {
        checkbox.addEventListener("change", (event) => {
            const taskId = event.target.dataset.taskId;
            const date = event.target.dataset.date;
            toggleTaskCompletion(taskId, date);
        });
    });
}

function renderTaskCard(task) {
    const canEdit = currentProfile.role === "admin" || viewingUserId === currentProfile.id;
    const today = new Date();
    const todayString = getDateString(today);
    const taskTypeClass = task.type === "daily" ? "daily-task" : "weekly-task";
    const taskTypeLabel = task.type === "daily" ? "Daily" : "Weekly Goal";

    let progressHtml = "";
    let progressInfo = "";

    if (currentView === "day") {
        const isCompleted = Boolean(task.completions && task.completions[todayString]);
        progressHtml = `
            <div class="progress-label">Mark completion for today</div>
            <div class="progress-days">
                <div class="day-checkbox">
                    <span class="day-label">Today</span>
                    <div class="checkbox-wrapper">
                        <input type="checkbox" class="task-checkbox" data-task-id="${task.id}" data-date="${todayString}" ${isCompleted ? "checked" : ""}>
                    </div>
                </div>
            </div>
        `;
    } else {
        const start = getStartOfWeek(today);
        const days = [];
        let completedCount = 0;

        for (let index = 0; index < 7; index += 1) {
            const day = new Date(start);
            day.setDate(day.getDate() + index);
            const dayString = getDateString(day);
            const isCompleted = Boolean(task.completions && task.completions[dayString]);

            if (isCompleted) {
                completedCount += 1;
            }

            days.push(`
                <div class="day-checkbox">
                    <span class="day-label">${getDayName(day)}</span>
                    <div class="checkbox-wrapper">
                        <input type="checkbox" class="task-checkbox" data-task-id="${task.id}" data-date="${dayString}" ${isCompleted ? "checked" : ""}>
                    </div>
                </div>
            `);
        }

        progressHtml = `
            <div class="progress-label">This week</div>
            <div class="progress-days">${days.join("")}</div>
        `;

        if (task.type === "weekly") {
            const target = task.target || DEFAULT_WEEKLY_TARGET;
            const percentage = Math.min(Math.round((completedCount / target) * 100), 100);
            progressInfo = `
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${percentage}%"></div>
                </div>
                <div class="progress-text">
                    <span>${completedCount} / ${target}</span>
                    <span class="progress-percentage">${percentage}%</span>
                </div>
            `;
        }
    }

    return `
        <article class="task-card ${taskTypeClass}">
            <div class="task-header">
                <div class="task-info">
                    <span class="task-type-badge task-type-${task.type}">${taskTypeLabel}</span>
                    <h3>${escapeHtml(task.name)}</h3>
                    ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ""}
                </div>
                ${canEdit
        ? `<div class="task-actions">
                        <button class="btn-icon" onclick="openTaskModal('${task.id}')" title="Edit">Edit</button>
                        <button class="btn-icon" onclick="deleteTask('${task.id}')" title="Delete">Del</button>
                    </div>`
        : ""}
            </div>
            <div class="task-progress">
                ${progressHtml}
                ${progressInfo}
            </div>
        </article>
    `;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
}

function taskShapeForExport(task) {
    return {
        id: task.id,
        name: task.name,
        type: task.type,
        description: task.description || "",
        target: task.type === "weekly" ? task.target || DEFAULT_WEEKLY_TARGET : null,
        completions: task.completions || {},
        created_at: task.created_at || new Date().toISOString()
    };
}

async function exportData() {
    try {
        const exportBlob = {
            exported_at: new Date().toISOString(),
            users: {}
        };

        if (currentProfile.role === "admin") {
            if (userProfiles.length === 0) {
                await loadUserProfiles();
            }

            for (const profile of userProfiles) {
                const rows = await fetchTasks(profile.id);
                exportBlob.users[profile.username] = rows.map(taskShapeForExport);
            }
        } else {
            exportBlob.users[currentProfile.username] = tasksCache.map(taskShapeForExport);
        }

        const payload = JSON.stringify(exportBlob, null, 2);
        const blob = new Blob([payload], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `task-tracker-backup-${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);

        showToast("Backup exported.", "success");
    } catch (error) {
        showToast(error.message || "Export failed.", "error");
    }
}
async function importData(event) {
    const file = event.target.files[0];
    event.target.value = "";

    if (!file) {
        return;
    }

    try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        if (!window.confirm("Import will replace cloud tasks for selected users. Continue?")) {
            return;
        }

        const replacedUsers = await processImportPayload(parsed);
        await refreshDashboardData();
        showToast(`Import complete for ${replacedUsers} user(s).`, "success");
    } catch (error) {
        showToast(error.message || "Import failed.", "error");
    }
}

async function processImportPayload(payload) {
    const usersPayload = payload?.users;

    if (!usersPayload || typeof usersPayload !== "object") {
        throw new Error("Invalid backup format. Expected { users: { ... } }.");
    }

    const profileMap = await getProfileMapByUsername();
    let replacedUsers = 0;

    if (currentProfile.role === "admin") {
        for (const username of Object.keys(usersPayload)) {
            const profile = profileMap.get(username);
            if (!profile) {
                continue;
            }

            const normalized = normalizeImportedTasks(usersPayload[username]);
            await replaceUserTasks(profile.id, normalized);
            replacedUsers += 1;
        }

        return replacedUsers;
    }

    const ownData = usersPayload[currentProfile.username];
    if (!Array.isArray(ownData)) {
        throw new Error(`No task array found for user '${currentProfile.username}' in import file.`);
    }

    const normalized = normalizeImportedTasks(ownData);
    await replaceUserTasks(currentProfile.id, normalized);
    return 1;
}

function normalizeImportedTasks(rawTasks) {
    if (!Array.isArray(rawTasks)) {
        return [];
    }

    return rawTasks
        .map((task) => {
            const name = String(task?.name || "").trim();
            if (!name) {
                return null;
            }

            const type = task?.type === "weekly" ? "weekly" : "daily";
            const target = type === "weekly"
                ? Number.parseInt(task?.target, 10) || DEFAULT_WEEKLY_TARGET
                : null;

            const createdAt = task?.created_at || task?.createdAt;
            const createdAtIso = Number.isNaN(Date.parse(createdAt))
                ? new Date().toISOString()
                : new Date(createdAt).toISOString();

            return {
                name,
                type,
                description: String(task?.description || ""),
                target,
                completions: sanitizeCompletions(task?.completions),
                created_at: createdAtIso,
                updated_at: new Date().toISOString()
            };
        })
        .filter(Boolean);
}

function sanitizeCompletions(rawCompletions) {
    if (!rawCompletions || typeof rawCompletions !== "object") {
        return {};
    }

    const next = {};
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;

    Object.keys(rawCompletions).forEach((key) => {
        if (datePattern.test(key) && rawCompletions[key]) {
            next[key] = true;
        }
    });

    return next;
}

async function replaceUserTasks(userId, normalizedTasks) {
    const deleteResult = await supabaseClient.from("tasks").delete().eq("user_id", userId);
    if (deleteResult.error) {
        throw new Error(deleteResult.error.message || "Failed to clear existing tasks");
    }

    if (normalizedTasks.length === 0) {
        return;
    }

    const rows = normalizedTasks.map((task) => ({ ...task, user_id: userId }));
    const insertResult = await supabaseClient.from("tasks").insert(rows);
    if (insertResult.error) {
        throw new Error(insertResult.error.message || "Failed to insert imported tasks");
    }
}

async function getProfileMapByUsername() {
    if (userProfiles.length === 0) {
        await loadUserProfiles();
    }

    const map = new Map();
    userProfiles.forEach((profile) => map.set(profile.username, profile));
    map.set(currentProfile.username, currentProfile);
    return map;
}

function getLegacyTasks(username) {
    if (!username) {
        return [];
    }

    const key = `${LEGACY_KEY_PREFIX}${username}`;
    const raw = localStorage.getItem(key);

    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function getLegacyUsersWithData() {
    const usernames = [];

    for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (!key || !key.startsWith(LEGACY_KEY_PREFIX)) {
            continue;
        }

        const username = key.replace(LEGACY_KEY_PREFIX, "");
        const alreadyMigrated = localStorage.getItem(`migrated_to_cloud_${username}`) === "1";
        const tasks = getLegacyTasks(username);

        if (!alreadyMigrated && tasks.length > 0) {
            usernames.push(username);
        }
    }

    return usernames;
}

function renderMigrationBanner() {
    const banner = byId("migrationBanner");
    if (!banner || !currentProfile) {
        return;
    }

    const legacyUsers = getLegacyUsersWithData();
    if (legacyUsers.length === 0) {
        banner.classList.add("hidden");
        return;
    }

    if (currentProfile.role === "admin") {
        banner.innerHTML = `
            <p>Legacy browser data detected for ${legacyUsers.length} user(s). Migrate now to cloud sync.</p>
            <button id="migrateLegacyBtn" type="button" class="btn btn-secondary">Migrate Legacy Data</button>
        `;

        banner.classList.remove("hidden");
        byId("migrateLegacyBtn")?.addEventListener("click", () => migrateLegacyData(true));
        return;
    }

    const ownLegacy = legacyUsers.includes(currentProfile.username);
    if (!ownLegacy) {
        banner.classList.add("hidden");
        return;
    }

    banner.innerHTML = `
        <p>Legacy tasks found in this browser for your account. Import them to cloud?</p>
        <button id="migrateLegacyBtn" type="button" class="btn btn-secondary">Migrate My Tasks</button>
    `;

    banner.classList.remove("hidden");
    byId("migrateLegacyBtn")?.addEventListener("click", () => migrateLegacyData(false));
}

async function migrateLegacyData(allUsers) {
    if (!window.confirm("Migration will replace existing cloud tasks for selected users. Continue?")) {
        return;
    }

    const legacyUsers = allUsers ? getLegacyUsersWithData() : [currentProfile.username];
    const profileMap = await getProfileMapByUsername();

    let migratedCount = 0;

    for (const username of legacyUsers) {
        const tasks = getLegacyTasks(username);
        if (tasks.length === 0) {
            continue;
        }

        const profile = profileMap.get(username);
        if (!profile) {
            continue;
        }

        try {
            const normalized = normalizeImportedTasks(tasks);
            await replaceUserTasks(profile.id, normalized);
            localStorage.setItem(`migrated_to_cloud_${username}`, "1");
            migratedCount += 1;
        } catch (error) {
            showToast(`Migration failed for ${username}: ${error.message || "unknown error"}`, "error");
        }
    }

    await refreshDashboardData();
    renderMigrationBanner();

    if (migratedCount > 0) {
        showToast(`Migrated ${migratedCount} user(s) from local browser data.`, "success");
    } else {
        showToast("No eligible legacy data found.", "info");
    }
}

window.openTaskModal = openTaskModal;
window.deleteTask = deleteTask;
