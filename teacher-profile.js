
const SUPABASE_URL = "https://muxooncctasaxdlozmdl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PaBSLg-rBAD8JR6DmYodxA_j1qW5z-2";
const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

async function loadTeacherProfile() {

    const status = document.getElementById("statusMessage");

    try {

        status.textContent = "Loading teacher profile...";

        // 1. Check login session
        const { data: sessionData, error: sessionError } =
            await db.auth.getSession();

        if (sessionError) throw sessionError;

        const user = sessionData.session?.user;

        if (!user) {
            window.location.href = "teacher-login.html";
            return;
        }

        // 2. Verify teacher role
        const { data: profile, error: profileError } = await db
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        if (profileError) throw profileError;

        if (profile.role !== "teacher") {
            throw new Error("Teacher account required.");
        }

        // 3. Get complete teacher record
        const { data: teacher, error: teacherError } = await db
            .from("teachers")
            .select(`
                teacher_name,
                employee_id,
                subject,
                phone,
                email,
                qualification,
                joining_date,
                photo_url
            `)
            .eq("user_id", user.id)
            .single();

        if (teacherError) throw teacherError;

        // 4. Display teacher information
        const name = teacher.teacher_name || "Teacher";

        document.getElementById("teacherName").textContent = name;

        const avatar = document.getElementById("teacherAvatar");
        const photo = document.getElementById("teacherPhoto");

        avatar.textContent = name.charAt(0).toUpperCase();

        // 5. Load teacher profile photo
        if (teacher.photo_url) {

            const { data: photoData, error: photoError } = await db
                .storage
                .from("profile-photos")
                .createSignedUrl(teacher.photo_url, 3600);

            if (photoError) {
                console.error("Profile Photo Error:", photoError);
            } else if (photoData?.signedUrl) {

                photo.src = photoData.signedUrl;
                photo.style.display = "block";
                avatar.style.display = "none";

                photo.onerror = function () {
                    photo.style.display = "none";
                    avatar.style.display = "flex";
                };
            }
        }

        // 6. Display other details
        document.getElementById("employeeId").textContent =
            teacher.employee_id || "Not available";

        document.getElementById("subject").textContent =
            teacher.subject || "Not available";

        document.getElementById("phone").textContent =
            teacher.phone || "Not available";

        document.getElementById("email").textContent =
            teacher.email || user.email || "Not available";

        document.getElementById("qualification").textContent =
            teacher.qualification || "Not available";

        document.getElementById("joiningDate").textContent =
            teacher.joining_date
                ? new Date(teacher.joining_date).toLocaleDateString("en-IN")
                : "Not available";

        status.textContent = "";

    } catch (error) {

        console.error("Teacher Profile Error:", error);

        status.textContent = error.message;
    }
}

// 7. Start profile
loadTeacherProfile();
