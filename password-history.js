
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const message = document.getElementById("historyMessage");
const tableBody = document.getElementById("historyTableBody");

async function checkAdmin() {
    const { data: { session }, error } =
        await supabaseClient.auth.getSession();

    if (error || !session) {
        window.location.href = "login.html";
        return false;
    }

    const { data: profile, error: profileError } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

    if (profileError || profile?.role !== "admin") {
        message.textContent = "Admin access only.";
        return false;
    }

    return true;
}

async function loadPasswordHistory() {
    message.textContent = "Loading history...";
    tableBody.innerHTML = "";

    const isAdmin = await checkAdmin();
    if (!isAdmin) return;

    const { data, error } = await supabaseClient.functions.invoke(
        "admin-password-reset-history"
    );

    if (error || data?.error) {
        message.textContent =
            data?.error || error?.message || "Unable to load history.";
        return;
    }

    const history = data?.history || [];

    if (history.length === 0) {
        message.textContent = "No password reset records found.";
        return;
    }

    message.textContent = `${history.length} record(s) found.`;

    history.forEach((item) => {
        const row = document.createElement("tr");

        const adminCell = document.createElement("td");
        adminCell.textContent = item.admin_name || "Admin";

        const accountCell = document.createElement("td");
        accountCell.textContent = item.account_name || "Account";

        const roleCell = document.createElement("td");
        roleCell.textContent = item.target_role || "-";

        const dateCell = document.createElement("td");
        const date = new Date(item.created_at);
        dateCell.textContent = isNaN(date.getTime())
            ? "-"
            : date.toLocaleString("en-IN");

        row.append(adminCell, accountCell, roleCell, dateCell);
        tableBody.appendChild(row);
    });
}

document.getElementById("refreshHistoryBtn")
    .addEventListener("click", loadPasswordHistory);

document.getElementById("logoutBtn")
    .addEventListener("click", async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "login.html";
    });

loadPasswordHistory();