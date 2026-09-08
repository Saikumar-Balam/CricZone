import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">

      <Navbar />

      <main className="flex-1 bg-gray-50 px-6 py-8 text-gray-900 dark:bg-gray-950 dark:text-white transition-colors duration-300">
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>

      <Footer  />

    </div>
  );
}
export default MainLayout;