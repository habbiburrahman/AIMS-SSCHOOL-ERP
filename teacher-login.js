
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";

const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const loginForm = document.getElementById("teacherLoginForm");
const loginBtn = document.getElementById("loginBtn");
const statusMessage = document.getElementById("statusMessage");

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const teacherId = document.getElementById("teacherId").value.trim();
    const password = document.getElementById("password").value;

    try {
        loginBtn.disabled = true;
        loginBtn.textContent = "Logging in...";
        statusMessage.style.color = "";
        statusMessage.textContent = "";

        // Step 1: Call Teacher Login Edge Function
        const { data, error } = await db.functions.invoke(
            "teacher-login",
            {
                body: {
                    teacher_id: teacherId,
                    password: password
                }
            }
        );

        if (error) {
            let errorMessage = error.message;

            if (error.context) {
                try {
                    const response = await error.context.json();
                    errorMessage = response.error || errorMessage;
                } catch {
                    // Keep original error message
                }
            }

            throw new Error(errorMessage);
        }

        if (
            !data ||
            !data.success ||
            !data.access_token ||
            !data.refresh_token
        ) {
            throw new Error(data?.error || "Teacher login failed.");
        }

        // Step 2: Save Supabase session
        const { error: sessionError } = await db.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token
        });

        if (sessionError) throw sessionError;

        // Step 3: Verify logged-in user
        const { data: userData, error: userError } =
            await db.auth.getUser();

        if (userError || !userData.user) {
            await db.auth.signOut();
            throw new Error("Unable to verify teacher account.");
        }

        // Step 4: Verify teacher role
        const { data: profile, error: profileError } = await db
            .from("profiles")
            .select("role")
            .eq("id", userData.user.id)
            .single();

        if (profileError) throw profileError;

        if (profile.role !== "teacher") {
            await db.auth.signOut();
            throw new Error("Access denied. This account is not a teacher.");
        }

        // Step 5: Verify linked teacher record
        const { data: teacher, error: teacherError } = await db
            .from("teachers")
            .select("id, teacher_name, employee_id")
            .eq("user_id", userData.user.id)
            .single();

        if (teacherError) throw teacherError;

        if (!teacher) {
            await db.auth.signOut();
            throw new Error("Teacher record not found.");
        }

        statusMessage.style.color = "green";
        statusMessage.textContent = "Login successful!";

        window.location.href = "teacher-dashboard.html";

    } catch (error) {
        console.error("Teacher Login Error:", error);

        statusMessage.style.color = "red";
        statusMessage.textContent = error.message;

    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = "Login";
    }
});
