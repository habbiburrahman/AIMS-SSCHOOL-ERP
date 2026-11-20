

const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";


const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const roleSelect = document.getElementById("roleSelect");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const accountSelect = document.getElementById("accountSelect");
const newPassword = document.getElementById("newPassword");
const confirmPassword = document.getElementById("confirmPassword");
const resetBtn = document.getElementById("resetBtn");
const message = document.getElementById("message");

let accounts = [];
let currentAdminUser = null;

function showMessage(text, type = "error") {
    message.textContent = text;
    message.className = type;
}

function showSelfMessage(text, type = "error") {
    const element = document.getElementById("selfPasswordMessage");
    element.textContent = text;
    element.className = type;
}

async function checkAdminSession() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error || !data.session) {
        window.location.href = "index.html";
        return false;
    }

    currentAdminUser = data.session.user;

    const { data: profile, error: profileError } =
        await supabaseClient
            .from("profiles")
            .select("role")
            .eq("id", currentAdminUser.id)
            .single();

    if (profileError || !profile || profile.role !== "admin") {
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
        return false;
    }

    return true;
}

// Search Teacher, Student or Parent accounts
async function searchAccounts() {
    const role = roleSelect.value;
    const search = searchInput.value.trim().toLowerCase();

    searchBtn.disabled = true;
    accountSelect.innerHTML =
        '<option value="">Loading accounts...</option>';
    showMessage("");

    try {
        let result;

        if (role === "teacher") {
            result = await supabaseClient
                .from("teachers")
                .select("user_id, employee_id, teacher_name");
        } else if (role === "student") {
            result = await supabaseClient
                .from("students")
                .select("user_id, admission_number, student_name, is_active")
                .eq("is_active", true);
        } else {
            result = await supabaseClient
                .from("parents")
                .select("user_id, parent_name, phone, email");
        }

        if (result.error) throw result.error;

        accounts = (result.data || []).filter(account => {
            if (!account.user_id) return false;

            const searchableText = Object.values(account)
                .filter(value => value !== null && value !== undefined)
                .join(" ")
                .toLowerCase();

            return searchableText.includes(search);
        });

        accountSelect.innerHTML = "";

        if (accounts.length === 0) {
            accountSelect.innerHTML =
                '<option value="">No linked accounts found</option>';
            showMessage("No matching linked account found.");
            return;
        }

        accountSelect.innerHTML =
            '<option value="">Choose an account</option>';

        accounts.forEach(account => {
            let name = "";
            let identifier = "";

            if (role === "teacher") {
                name = account.teacher_name || "Teacher";
                identifier = account.employee_id || "";
            } else if (role === "student") {
                name = account.student_name || "Student";
                identifier = account.admission_number || "";
            } else {
                name = account.parent_name || "Parent";
                identifier = account.phone || account.email || "";
            }

            const option = document.createElement("option");
            option.value = account.user_id;
            option.textContent =
                `${name} (${identifier || "No ID"})`;

            accountSelect.appendChild(option);
        });

        showMessage(`${accounts.length} account(s) found.`, "success");

    } catch (error) {
        console.error("Account search error:", error);
        accountSelect.innerHTML =
            '<option value="">Could not load accounts</option>';
        showMessage("Account search failed. Check database permissions.");
    } finally {
        searchBtn.disabled = false;
    }
}

// Reset Teacher, Student or Parent password
async function resetPassword() {
    const targetUserId = accountSelect.value;
    const password = newPassword.value;
    const confirm = confirmPassword.value;

    if (!targetUserId) {
        showMessage("Please select an account.");
        return;
    }

    if (password.length < 8 || password.length > 72) {
        showMessage("Password must be between 8 and 72 characters.");
        return;
    }

    if (password !== confirm) {
        showMessage("Passwords do not match.");
        return;
    }

    if (!window.confirm(
        "Are you sure you want to reset this account's password?"
    )) return;

    resetBtn.disabled = true;
    resetBtn.textContent = "Resetting...";
    showMessage("");

    try {
        const { data, error } = await supabaseClient.functions.invoke(
            "admin-reset-user-password",
            {
                body: {
                    target_user_id: targetUserId,
                    new_password: password
                }
            }
        );

        if (error) throw error;
        if (!data || !data.success) {
            throw new Error(data?.error || "Password reset failed.");
        }

        if (data.audit_logged === false) {
            showMessage(
                "Password updated, but audit log could not be saved."
            );
        } else {
            showMessage(
                "Password reset successfully. Audit record saved.",
                "success"
            );
        }

        newPassword.value = "";
        confirmPassword.value = "";

    } catch (error) {
        console.error("Password reset error:", error);
        showMessage(error.message || "Password reset failed.");
    } finally {
        resetBtn.disabled = false;
        resetBtn.textContent = "Reset Password";
    }
}

// Change the currently logged-in Admin's own password
async function changeMyPassword() {
    const currentPassword =
        document.getElementById("currentAdminPassword").value;

    const newPass =
        document.getElementById("selfNewPassword").value;

    const confirmPass =
        document.getElementById("selfConfirmPassword").value;

    const changeBtn =
        document.getElementById("changeMyPasswordBtn");

    if (!currentPassword || !newPass || !confirmPass) {
        showSelfMessage("Please fill in all password fields.");
        return;
    }

    if (newPass.length < 8 || newPass.length > 72) {
        showSelfMessage("New password must be between 8 and 72 characters.");
        return;
    }

    if (newPass !== confirmPass) {
        showSelfMessage("New passwords do not match.");
        return;
    }

    if (currentPassword === newPass) {
        showSelfMessage("New password must be different from current password.");
        return;
    }

    if (!currentAdminUser || !currentAdminUser.email) {
        showSelfMessage(
            "Your login account does not expose an email for password verification. Contact the system administrator."
        );
        return;
    }

    if (!window.confirm("Change your Admin password now?")) return;

    changeBtn.disabled = true;
    changeBtn.textContent = "Verifying...";

    try {
        // Verify current password by re-authenticating this Admin
        const { error: verifyError } =
            await supabaseClient.auth.signInWithPassword({
                email: currentAdminUser.email,
                password: currentPassword
            });

        if (verifyError) {
            throw new Error("Current password is incorrect.");
        }

        // Update password for the currently authenticated Admin
        const { error: updateError } =
            await supabaseClient.auth.updateUser({
                password: newPass
            });

        if (updateError) throw updateError;

        document.getElementById("currentAdminPassword").value = "";
        document.getElementById("selfNewPassword").value = "";
        document.getElementById("selfConfirmPassword").value = "";

        showSelfMessage(
            "Your Admin password has been changed successfully.",
            "success"
        );

    } catch (error) {
        console.error("Admin password change error:", error);
        showSelfMessage(error.message || "Password change failed.");
    } finally {
        changeBtn.disabled = false;
        changeBtn.textContent = "Change My Password";
    }
}

// Events
searchBtn.addEventListener("click", searchAccounts);

roleSelect.addEventListener("change", () => {
    accounts = [];
    accountSelect.innerHTML =
        '<option value="">Search accounts first</option>';
    showMessage("");
});

resetBtn.addEventListener("click", resetPassword);

document.getElementById("changeMyPasswordBtn")
    .addEventListener("click", changeMyPassword);

document.getElementById("logoutBtn").addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        showMessage("Logout failed: " + error.message);
        return;
    }

    window.location.href = "index.html";
});

// Start page
checkAdminSession();
