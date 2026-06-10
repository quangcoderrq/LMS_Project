import Navbar from "../../components/layout/Navbar";
import Sidebar from "../../components/layout/Sidebar";
import { useTheme } from "../../hooks/useTheme";

const FAQPage = () => {
  const { darkMode } = useTheme();

  return (
    <div
      className="flex h-screen overflow-hidden relative"
      style={{
        backgroundColor: darkMode ? "#1a202c" : "#f8fafc",
        color: darkMode ? "#ffffff" : "#1e293b",
      }}
    >
      <Navbar />
      <Sidebar />

      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <main className="flex-1 relative overflow-y-auto focus:outline-none p-4 mt-16 sm:pl-24 md:pl-28">
          <div className="max-w-6xl mx-auto px-4 pb-10">
            <div
              className="relative overflow-hidden rounded-3xl shadow-xl border"
              style={{
                backgroundColor: darkMode ? "rgba(15,23,42,0.9)" : "rgba(255,255,255,0.92)",
                borderColor: darkMode ? "rgba(51,65,85,0.6)" : "rgba(226,232,240,0.9)",
              }}
            >
              <div className="h-32 bg-gradient-to-r from-indigo-600 via-violet-500 to-fuchsia-500" />

              <div className="relative px-6 sm:px-10 pb-10 -mt-16">
                <div
                  className="inline-flex items-center gap-4 px-5 py-4 rounded-2xl shadow-lg flex-wrap sm:flex-nowrap justify-center text-center sm:text-left"
                  style={{
                    backgroundColor: darkMode ? "rgba(15,23,42,0.92)" : "#ffffff",
                    color: darkMode ? "#e2e8f0" : "#1f2937",
                    border: darkMode ? "1px solid rgba(148,163,184,0.2)" : "1px solid rgba(226,232,240,0.7)",
                    marginLeft: "auto",
                    marginRight: "auto",
                  }}
                >
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-indigo-600 text-white text-2xl shadow-md mx-auto sm:mx-0">
                    ❓
                  </div>
                  <div className="sm:text-left max-w-xl">
                    <h1 className="text-2xl md:text-3xl font-bold">FAQ / Usage Guide</h1>
                    <p className="text-sm md:text-base mt-1" style={{ color: darkMode ? "#cbd5f5" : "#475569" }}>
                      Quick answers and tips to use FStudyMate effectively.
                    </p>
                  </div>
                </div>

                <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <section>
                      <h2 className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">What is FStudyMate?</h2>
                      <p className="mt-2 text-sm md:text-base" style={{ color: darkMode ? "#e2e8f0" : "#334155" }}>
                        FStudyMate is an online learning platform tailored for FPT students and educators, helping you organize studies,
                        assessments, and collaboration in one place.
                      </p>
                    </section>

                    <section>
                      <h2 className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">What do users get?</h2>
                      <ul
                        className="mt-3 text-sm md:text-base list-disc pl-5 space-y-1.5"
                        style={{ color: darkMode ? "#e2e8f0" : "#334155" }}
                      >
                        <li>Students: schedules, lesson materials, mock tests, and progress tracking.</li>
                        <li>Lecturers: class management, forums, material uploads, and assessments.</li>
                        <li>Admins: manage users, courses, announcements, and platform settings.</li>
                      </ul>
                    </section>

                    <section>
                      <h2 className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">External students?</h2>
                      <p className="mt-2 text-sm md:text-base" style={{ color: darkMode ? "#e2e8f0" : "#334155" }}>
                        External learners are supported with limited privileges so they can access shared content safely.
                      </p>
                    </section>

                    <section>
                      <h2 className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">Platforms</h2>
                      <p className="mt-2 text-sm md:text-base" style={{ color: darkMode ? "#e2e8f0" : "#334155" }}>
                        Optimized for desktop/laptop browsers with adaptive layouts for tablets and mobiles.
                      </p>
                    </section>
                  </div>

                  <div className="space-y-6">
                    <div
                      className="rounded-xl p-6 border"
                      style={{
                        backgroundColor: darkMode ? "rgba(15,23,42,0.7)" : "rgba(248,250,252,0.85)",
                        borderColor: darkMode ? "rgba(148,163,184,0.2)" : "rgba(226,232,240,0.9)",
                      }}
                    >
                      <h3 className="text-lg font-semibold" style={{ color: darkMode ? "#f1f5f9" : "#1f2937" }}>
                        Quick Start
                      </h3>
                      <ol
                        className="mt-3 list-decimal pl-5 space-y-1.5 text-sm md:text-base"
                        style={{ color: darkMode ? "#e2e8f0" : "#334155" }}
                      >
                        <li>Register or log in with your FStudyMate account.</li>
                        <li>Browse Courses and enroll in classes assigned to you.</li>
                        <li>Access lesson materials, forums, and assignments.</li>
                        <li>Track your progress and scores in the Profile section.</li>
                      </ol>
                    </div>

                    <div
                      className="rounded-xl p-6 border"
                      style={{
                        backgroundColor: darkMode ? "rgba(15,23,42,0.7)" : "rgba(248,250,252,0.85)",
                        borderColor: darkMode ? "rgba(148,163,184,0.2)" : "rgba(226,232,240,0.9)",
                      }}
                    >
                      <h3 className="text-lg font-semibold" style={{ color: darkMode ? "#f1f5f9" : "#1f2937" }}>
                        Tips & Tricks
                      </h3>
                      <ul
                        className="mt-3 list-disc pl-5 space-y-1.5 text-sm md:text-base"
                        style={{ color: darkMode ? "#e2e8f0" : "#334155" }}
                      >
                        <li>Switch to dark mode for late-night study sessions.</li>
                        <li>Bookmark frequently used courses and materials.</li>
                        <li>Enable notifications so you never miss submission deadlines.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default FAQPage;


