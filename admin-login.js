const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";


const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const adminId = document.getElementById("adminId").value.trim();
    const password = document.getElementById("password").value;

    if (!adminId || !password) {
        message.textContent = "Please enter Admin ID and password.";
        message.style.color = "red";
        return;
    }

    message.textContent = "Logging in...";
    message.style.color = "blue";

    try {
        // Verify Admin ID and password through Edge Function.
        const { data, error } = await supabaseClient.functions.invoke(
            "admin-login-by-id",
            {
                body: {
                    adminId: adminId,
                    password: password
                }
            }
        );

        if (error || !data || !data.access_token || !data.refresh_token) {
            message.textContent =
                data?.error || error?.message || "Invalid Admin ID or password.";
            message.style.color = "red";
            return;
        }

        // Create Supabase session.
        const { data: sessionData, error: sessionError } =
            await supabaseClient.auth.setSession({
                access_token: data.access_token,
                refresh_token: data.refresh_token
            });

        if (sessionError || !sessionData.user) {
            message.textContent = "Unable to create login session.";
            message.style.color = "red";
            return;
        }

        // Verify Admin role.
        const { data: profile, error: profileError } =
            await supabaseClient
                .from("profiles")
                .select("full_name, role")
                .eq("id", sessionData.user.id)
                .single();

        if (profileError || !profile || profile.role !== "admin") {
            await supabaseClient.auth.signOut();

            message.textContent = "Admin access not available.";
            message.style.color = "red";
            return;
        }

        message.textContent = "Login successful!";
        message.style.color = "green";

        window.location.href = "dashboard.html";

    } catch (error) {
        console.error("Admin login error:", error);

        message.textContent = "Something went wrong. Please try again.";
        message.style.color = "red";
    }
});
